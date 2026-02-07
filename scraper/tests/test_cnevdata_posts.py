"""Tests for CnEVData image URL normalization."""

from unittest.mock import MagicMock

import pytest

from sources.cnevdata import CnEVDataSource, CnEVDataArticle


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
