"""Integration tests for the CnEVData scraper hitting real pages.

All tests are marked @pytest.mark.integration and skipped by default.
Run with: cd scraper && python -m pytest tests/test_cnevdata_scraper.py -v -m integration
"""

import re

import pytest

from extractors.classifier import ArticleClassifier, ArticleType


pytestmark = pytest.mark.integration


class TestFetchPages:
    """Test fetching article lists from real cnevdata.com pages."""

    def test_fetch_page_1_returns_articles(self, page_1_articles):
        assert len(page_1_articles) >= 8, (
            f"Expected >= 8 articles on page 1, got {len(page_1_articles)}"
        )

    def test_fetch_page_2_returns_articles(self, page_2_articles):
        assert len(page_2_articles) >= 8, (
            f"Expected >= 8 articles on page 2, got {len(page_2_articles)}"
        )


class TestArticleFields:
    """Test that scraped articles have required fields."""

    def test_article_has_required_fields(self, page_1_articles):
        for article in page_1_articles:
            assert article.url, f"Article missing url: {article}"
            assert article.url_hash, f"Article missing url_hash: {article}"
            assert article.title, f"Article missing title: {article}"
            assert len(article.title.strip()) > 0, (
                f"Article has empty title: {article}"
            )

    def test_article_urls_are_valid(self, page_1_articles):
        for article in page_1_articles:
            assert article.url.startswith("https://cnevdata.com/"), (
                f"Invalid URL: {article.url}"
            )

    def test_article_urls_have_date_pattern(self, page_1_articles):
        date_pattern = re.compile(r"/\d{4}/\d{2}/\d{2}/")
        for article in page_1_articles:
            assert date_pattern.search(article.url), (
                f"URL missing date pattern: {article.url}"
            )

    def test_url_hash_is_md5(self, page_1_articles):
        md5_pattern = re.compile(r"^[a-f0-9]{32}$")
        for article in page_1_articles:
            assert md5_pattern.match(article.url_hash), (
                f"url_hash not MD5 format: {article.url_hash}"
            )

    def test_article_type_is_set(self, page_1_articles):
        for article in page_1_articles:
            assert article.article_type is not None, (
                f"article_type is None for: {article.title}"
            )


class TestClassification:
    """Test classification of real scraped articles."""

    def test_article_classification_not_all_skip(self, page_1_articles):
        """At least 50% of articles should NOT be classified as SKIP."""
        non_skip = [a for a in page_1_articles if a.article_type != "SKIP"]
        skip_ratio = 1 - (len(non_skip) / len(page_1_articles))
        assert skip_ratio < 0.5, (
            f"Too many SKIP articles: {len(page_1_articles) - len(non_skip)}"
            f" out of {len(page_1_articles)} ({skip_ratio:.0%})"
        )

    def test_page_1_contains_known_brand(self, page_1_articles):
        """Page 1 should contain at least one article about a known brand."""
        known_brands = ["tesla", "byd", "nio", "xpeng", "li auto", "geely", "leapmotor"]
        titles_lower = [a.title.lower() for a in page_1_articles]
        found = any(
            brand in title for title in titles_lower for brand in known_brands
        )
        assert found, (
            f"No known brand found in page 1 titles: "
            f"{[a.title for a in page_1_articles]}"
        )


class TestMetricExtraction:
    """Test extracting metrics from real scraped articles."""

    def test_extract_metrics_from_brand_article(self, cnevdata_source, page_1_articles):
        """Find a brand metric article and verify extraction works."""
        brand_articles = [
            a for a in page_1_articles if a.article_type == "BRAND_METRIC"
        ]
        if not brand_articles:
            pytest.skip("No brand metric articles found on page 1")

        article = brand_articles[0]
        metrics = cnevdata_source.extract_metrics(article)
        assert len(metrics) > 0, (
            f"No metrics extracted from: {article.title}"
        )
        metric = metrics[0]
        assert "brand" in metric
        assert "value" in metric
        assert metric["value"] is not None
        assert metric["value"] > 0


class TestFullPipeline:
    """Test the full scrape -> classify -> extract pipeline."""

    def test_full_pipeline_page(self, cnevdata_source, page_1_articles):
        """For each article on page 1: classify type, check structure."""
        classifier = ArticleClassifier()
        for article in page_1_articles:
            classification = classifier.classify(article.title, article.summary or "")
            # Every article should have a classification
            assert classification is not None
            assert classification.article_type is not None

            # Non-SKIP articles should have a target table
            if classification.article_type != ArticleType.SKIP:
                assert classification.target_table is not None, (
                    f"Non-SKIP article has no target table: {article.title}"
                )

    def test_multiple_pages_no_duplicates(self, page_1_articles, page_2_articles):
        """Pages 1 and 2 should have no duplicate URLs."""
        urls_1 = {a.url for a in page_1_articles}
        urls_2 = {a.url for a in page_2_articles}
        duplicates = urls_1 & urls_2
        assert len(duplicates) == 0, (
            f"Found {len(duplicates)} duplicate URLs: {duplicates}"
        )


class TestDateParsing:
    """Test that date parsing works on real articles."""

    def test_some_articles_have_dates(self, page_1_articles):
        """At least some articles should have parsed dates."""
        with_dates = [a for a in page_1_articles if a.published_at is not None]
        # Allow for some articles without dates, but at least some should have them
        assert len(with_dates) >= 1 or len(page_1_articles) == 0, (
            f"No articles have parsed dates out of {len(page_1_articles)} articles"
        )
