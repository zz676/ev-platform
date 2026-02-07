"""Tests for CnEVData image URL normalization and post submission."""

import json
from datetime import datetime
from unittest.mock import patch, MagicMock

import pytest

from sources.cnevdata import CnEVDataSource, CnEVDataArticle
from backfill_cnevdata import submit_as_post, BackfillStats, CHART_ARTICLE_TYPES


class TestImageUrlNormalization:
    """Test that _parse_article_element normalizes image URLs correctly."""

    def _make_source_and_parse(self, img_html: str) -> str | None:
        """Helper: build a minimal article element with the given <img> tag and parse it."""
        from bs4 import BeautifulSoup

        html = f"""
        <div class="list-item block">
            <a href="/2025/01/15/test-article/">
                <h2>Test Title 2025年1月</h2>
            </a>
            <p>Some summary</p>
            {img_html}
        </div>
        """
        soup = BeautifulSoup(html, "html.parser")
        elem = soup.select_one("div.list-item.block")
        source = CnEVDataSource.__new__(CnEVDataSource)
        source.base_url = "https://cnevdata.com"
        source.classifier = MagicMock()
        source.classifier.classify.return_value = MagicMock(
            needs_ocr=False,
            article_type=MagicMock(value="OTHER"),
            ocr_data_type=None,
        )
        article = source._parse_article_element(elem)
        return article.preview_image if article else None

    def test_relative_url_gets_base_url_prepended(self):
        url = self._make_source_and_parse('<img src="/uploads/chart.jpg">')
        assert url == "https://cnevdata.com/uploads/chart.jpg"

    def test_absolute_url_kept_as_is(self):
        url = self._make_source_and_parse(
            '<img src="https://cdn.example.com/img.png">'
        )
        assert url == "https://cdn.example.com/img.png"

    def test_bare_relative_url_gets_base_url_with_slash(self):
        url = self._make_source_and_parse('<img src="uploads/chart.jpg">')
        assert url == "https://cnevdata.com/uploads/chart.jpg"

    def test_data_src_attribute_used_as_fallback(self):
        url = self._make_source_and_parse('<img data-src="/lazy/img.png">')
        assert url == "https://cnevdata.com/lazy/img.png"

    def test_no_img_returns_none(self):
        url = self._make_source_and_parse("")
        assert url is None

    def test_http_url_kept_as_is(self):
        url = self._make_source_and_parse('<img src="http://example.com/img.jpg">')
        assert url == "http://example.com/img.jpg"


class TestSubmitAsPost:
    """Test submit_as_post sends correct payloads and handles errors."""

    def _make_article(self, **overrides) -> CnEVDataArticle:
        defaults = dict(
            url="https://cnevdata.com/2025/01/15/test/",
            url_hash="abc123",
            title="Test Article",
            summary="Test summary",
            published_at=datetime(2025, 1, 15),
            preview_image="https://cnevdata.com/uploads/chart.jpg",
            article_type="PLANT_EXPORTS",
            needs_ocr=False,
            ocr_data_type=None,
        )
        defaults.update(overrides)
        return CnEVDataArticle(**defaults)

    def test_skips_article_without_preview_image(self):
        stats = BackfillStats()
        article = self._make_article(preview_image=None)
        result = submit_as_post(article, stats)
        assert result is False
        assert stats.posts_submitted == 0

    def test_skips_non_chart_article_type(self):
        stats = BackfillStats()
        article = self._make_article(article_type="OTHER")
        result = submit_as_post(article, stats)
        assert result is False
        assert stats.posts_submitted == 0

    @patch("backfill_cnevdata.WEBHOOK_SECRET", "test-secret")
    @patch("backfill_cnevdata.WEBHOOK_URL", "https://example.com/api/webhook")
    @patch("backfill_cnevdata.httpx.post")
    def test_sends_correct_payload(self, mock_post):
        mock_response = MagicMock()
        mock_response.is_success = True
        mock_response.json.return_value = {"results": {"created": 1, "skipped": 0}}
        mock_post.return_value = mock_response

        stats = BackfillStats()
        article = self._make_article()
        result = submit_as_post(article, stats)

        assert result is True
        assert stats.posts_submitted == 1

        # Verify the payload structure
        call_kwargs = mock_post.call_args
        payload = json.loads(call_kwargs.kwargs["content"])
        post = payload["posts"][0]
        assert post["source"] == "MEDIA"
        assert post["sourceAuthor"] == "CnEVData"
        assert post["originalMediaUrls"] == ["https://cnevdata.com/uploads/chart.jpg"]
        assert post["sourceUrl"] == "https://cnevdata.com/2025/01/15/test/"

    @patch("backfill_cnevdata.WEBHOOK_SECRET", None)
    @patch("backfill_cnevdata.WEBHOOK_URL", "https://example.com/api/webhook")
    @patch("backfill_cnevdata.httpx.post")
    def test_logs_error_on_400(self, mock_post, capsys):
        mock_response = MagicMock()
        mock_response.is_success = False
        mock_response.status_code = 400
        mock_response.text = '{"error":"Invalid URL in originalMediaUrls"}'
        mock_post.return_value = mock_response

        stats = BackfillStats()
        article = self._make_article()
        result = submit_as_post(article, stats)

        assert result is False
        assert stats.posts_failed == 1

        captured = capsys.readouterr()
        assert "400" in captured.out
        assert "Invalid URL" in captured.out

    def test_dry_run_does_not_call_webhook(self):
        stats = BackfillStats()
        article = self._make_article()
        result = submit_as_post(article, stats, dry_run=True)
        assert result is True
        assert stats.posts_submitted == 1
