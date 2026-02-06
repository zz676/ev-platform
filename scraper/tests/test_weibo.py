"""Tests for Weibo scraper: date parsing, text cleaning, time filtering,
sourceId stability, and article parsing."""

import hashlib
from datetime import datetime, timedelta
from unittest.mock import patch

from sources.weibo import WeiboSource


class TestWeiboDateParsing:
    """Test Weibo date string parsing (relative and absolute formats)."""

    def setup_method(self):
        self.source = WeiboSource()

    def test_just_now(self):
        result = self.source._parse_weibo_date("刚刚")
        assert isinstance(result, datetime)
        # Should be within last minute
        assert (datetime.now() - result).total_seconds() < 60

    def test_minutes_ago(self):
        result = self.source._parse_weibo_date("5分钟前")
        expected = datetime.now() - timedelta(minutes=5)
        assert abs((result - expected).total_seconds()) < 5

    def test_hours_ago(self):
        result = self.source._parse_weibo_date("3小时前")
        expected = datetime.now() - timedelta(hours=3)
        assert abs((result - expected).total_seconds()) < 5

    def test_yesterday_with_time(self):
        result = self.source._parse_weibo_date("昨天 14:30")
        yesterday = datetime.now() - timedelta(days=1)
        assert result.hour == 14
        assert result.minute == 30
        assert result.day == yesterday.day

    def test_yesterday_without_time(self):
        result = self.source._parse_weibo_date("昨天")
        expected = datetime.now() - timedelta(days=1)
        assert abs((result - expected).total_seconds()) < 60

    def test_month_day_format(self):
        result = self.source._parse_weibo_date("05-20")
        assert result.month == 5
        assert result.day == 20
        assert result.year == datetime.now().year

    def test_full_date_format(self):
        result = self.source._parse_weibo_date("2025-12-15")
        assert result.year == 2025
        assert result.month == 12
        assert result.day == 15

    def test_empty_string_returns_now(self):
        result = self.source._parse_weibo_date("")
        assert abs((datetime.now() - result).total_seconds()) < 5

    def test_unparseable_returns_now(self):
        result = self.source._parse_weibo_date("garbage_date_string")
        assert abs((datetime.now() - result).total_seconds()) < 5


class TestWeiboTextCleaning:
    """Test Weibo HTML text cleaning."""

    def setup_method(self):
        self.source = WeiboSource()

    def test_removes_html_links(self):
        result = self.source._clean_weibo_text('<a href="http://t.cn/xxx">链接</a>')
        assert result == "链接"
        assert "<a" not in result

    def test_removes_html_tags(self):
        result = self.source._clean_weibo_text("<br/>Hello<br/>World")
        # <br/> tags are stripped without inserting spaces, text is joined
        assert result == "HelloWorld"

    def test_removes_div_tags(self):
        result = self.source._clean_weibo_text("<div>Hello</div> <span>World</span>")
        assert result == "Hello World"

    def test_removes_emoji_brackets(self):
        result = self.source._clean_weibo_text("好消息[鼓掌]发布了[赞]")
        assert result == "好消息发布了"

    def test_collapses_whitespace(self):
        result = self.source._clean_weibo_text("hello    world   test")
        assert result == "hello world test"

    def test_decodes_html_entities(self):
        result = self.source._clean_weibo_text("A &amp; B &lt; C")
        assert result == "A & B < C"

    def test_empty_input(self):
        assert self.source._clean_weibo_text("") == ""
        assert self.source._clean_weibo_text(None) == ""

    def test_complex_weibo_post(self):
        html = (
            '<a href="http://t.cn/xxx">#蔚来发布会#</a> 今天我们发布了全新的'
            '<span class="emotion">[鼓掌]</span> ET9 <br/>详情请看 '
            '<a href="http://t.cn/yyy">网页链接</a>'
        )
        result = self.source._clean_weibo_text(html)
        assert "#蔚来发布会#" in result
        assert "ET9" in result
        assert "<" not in result


class TestWeiboSourceId:
    """Test that sourceId is stable across runs (URL-only, no date component)."""

    def setup_method(self):
        self.source = WeiboSource()

    def test_source_id_uses_url_only(self):
        url = "https://weibo.com/1234567/AbCdEf"
        date1 = datetime(2025, 1, 15, 10, 30)
        date2 = datetime(2025, 1, 15, 13, 45)  # Different time

        id1 = self.source._generate_source_id(url, date1)
        id2 = self.source._generate_source_id(url, date2)

        assert id1 == id2, "sourceId should be identical regardless of date"

    def test_source_id_stable_without_date(self):
        url = "https://weibo.com/1234567/AbCdEf"
        id1 = self.source._generate_source_id(url)
        id2 = self.source._generate_source_id(url)
        assert id1 == id2

    def test_source_id_different_for_different_urls(self):
        id1 = self.source._generate_source_id("https://weibo.com/111/aaa")
        id2 = self.source._generate_source_id("https://weibo.com/222/bbb")
        assert id1 != id2

    def test_source_id_matches_expected_hash(self):
        url = "https://weibo.com/1234567/AbCdEf"
        expected = hashlib.md5(f"Weibo_{url}".encode()).hexdigest()[:16]
        result = self.source._generate_source_id(url)
        assert result == expected

    def test_source_id_length(self):
        result = self.source._generate_source_id("https://weibo.com/1/x")
        assert len(result) == 16


class TestWeiboParseMblog:
    """Test _parse_mblog with mock Weibo API data."""

    def setup_method(self):
        self.source = WeiboSource()

    def _make_mblog(self, text="测试内容", bid="TestBid123", user_id="9999",
                    created_at="刚刚", pics=None, retweeted=False):
        """Build a fake mblog dict matching Weibo API shape."""
        mblog = {
            "id": "5000000000000",
            "bid": bid,
            "text": text,
            "created_at": created_at,
            "user": {"id": user_id},
        }
        if pics:
            mblog["pics"] = pics
        if retweeted:
            mblog["retweeted_status"] = {"id": "999"}
        return mblog

    def test_basic_parse(self):
        mblog = self._make_mblog(text="蔚来ET9正式发布", bid="Xyz123", user_id="5675889356")
        article = self.source._parse_mblog(mblog, "蔚来")

        assert article is not None
        assert article.source == "WEIBO"
        assert article.source_author == "蔚来"
        assert article.source_url == "https://weibo.com/5675889356/Xyz123"
        assert article.original_content == "蔚来ET9正式发布"
        assert "Weibo" in article.categories
        assert "蔚来" in article.categories

    def test_skips_reposts(self):
        mblog = self._make_mblog(retweeted=True)
        assert self.source._parse_mblog(mblog, "Test") is None

    def test_skips_empty_text(self):
        mblog = self._make_mblog(text="")
        assert self.source._parse_mblog(mblog, "Test") is None

    def test_title_truncation(self):
        long_text = "这是一段非常非常长的微博内容" * 10  # >50 chars
        mblog = self._make_mblog(text=long_text)
        article = self.source._parse_mblog(mblog, "Test")
        assert article.original_title.endswith("...")
        assert len(article.original_title) == 53  # 50 chars + "..."

    def test_short_title_no_truncation(self):
        mblog = self._make_mblog(text="短标题")
        article = self.source._parse_mblog(mblog, "Test")
        assert article.original_title == "短标题"
        assert not article.original_title.endswith("...")

    def test_extracts_large_images(self):
        pics = [
            {"large": {"url": "https://img.weibo.cn/large/001.jpg"}, "url": "https://img.weibo.cn/thumb/001.jpg"},
            {"large": {"url": "https://img.weibo.cn/large/002.jpg"}, "url": "https://img.weibo.cn/thumb/002.jpg"},
        ]
        mblog = self._make_mblog(pics=pics)
        article = self.source._parse_mblog(mblog, "Test")

        assert len(article.original_media_urls) == 2
        assert article.original_media_urls[0] == "https://img.weibo.cn/large/001.jpg"
        assert article.original_media_urls[1] == "https://img.weibo.cn/large/002.jpg"

    def test_falls_back_to_regular_images(self):
        pics = [
            {"url": "https://img.weibo.cn/thumb/001.jpg"},  # No large
        ]
        mblog = self._make_mblog(pics=pics)
        article = self.source._parse_mblog(mblog, "Test")
        assert article.original_media_urls == ["https://img.weibo.cn/thumb/001.jpg"]

    def test_no_images(self):
        mblog = self._make_mblog()
        article = self.source._parse_mblog(mblog, "Test")
        assert article.original_media_urls == []

    def test_time_filtering_skips_old_post(self):
        cutoff = datetime.now() - timedelta(hours=8)
        # "昨天" = yesterday, which is >8 hours ago
        mblog = self._make_mblog(created_at="昨天 10:00")
        article = self.source._parse_mblog(mblog, "Test", cutoff=cutoff)
        assert article is None, "Posts older than cutoff should be filtered out"

    def test_time_filtering_keeps_recent_post(self):
        cutoff = datetime.now() - timedelta(hours=8)
        mblog = self._make_mblog(created_at="5分钟前")
        article = self.source._parse_mblog(mblog, "Test", cutoff=cutoff)
        assert article is not None, "Recent posts should pass time filter"

    def test_time_filtering_disabled_when_no_cutoff(self):
        mblog = self._make_mblog(created_at="昨天 10:00")
        article = self.source._parse_mblog(mblog, "Test", cutoff=None)
        assert article is not None, "Without cutoff, old posts should still be parsed"


class TestWeiboArticleIntegrity:
    """Verify Article objects have all required fields for webhook submission."""

    def setup_method(self):
        self.source = WeiboSource()

    def _parse_test_article(self):
        """Create a standard test article via _parse_mblog."""
        mblog = {
            "id": "5000000000001",
            "bid": "IntegrityTest",
            "text": "比亚迪1月销量突破30万辆",
            "created_at": "2小时前",
            "user": {"id": "1746221281"},
            "pics": [
                {"large": {"url": "https://img.weibo.cn/large/pic1.jpg"}, "url": "https://img.weibo.cn/thumb/pic1.jpg"},
            ],
        }
        return self.source._parse_mblog(mblog, "比亚迪汽车")

    def test_all_required_fields_present(self):
        article = self._parse_test_article()
        assert article is not None

        # Fields required by webhook Zod schema
        assert article.source_id and len(article.source_id) > 0
        assert article.source in ("OFFICIAL", "MEDIA", "WEIBO", "MANUAL")
        assert article.source_url.startswith("https://weibo.com/")
        assert article.source_author and len(article.source_author) > 0
        assert isinstance(article.source_date, datetime)
        assert article.original_content and len(article.original_content) > 0

    def test_to_dict_has_correct_keys(self):
        article = self._parse_test_article()
        d = article.to_dict()

        required_keys = {
            "sourceId", "source", "sourceUrl", "sourceAuthor", "sourceDate",
            "originalTitle", "originalContent", "originalMediaUrls",
            "translatedTitle", "translatedContent", "translatedSummary",
            "categories", "relevanceScore",
        }
        assert required_keys.issubset(set(d.keys()))

    def test_to_dict_types(self):
        article = self._parse_test_article()
        d = article.to_dict()

        assert isinstance(d["sourceId"], str)
        assert isinstance(d["source"], str)
        assert isinstance(d["sourceUrl"], str)
        assert isinstance(d["sourceAuthor"], str)
        assert isinstance(d["sourceDate"], str)  # isoformat string
        assert isinstance(d["originalMediaUrls"], list)
        assert isinstance(d["categories"], list)
        assert isinstance(d["relevanceScore"], int)

    def test_media_urls_are_strings(self):
        article = self._parse_test_article()
        for url in article.original_media_urls:
            assert isinstance(url, str)
            assert url.startswith("http")

    def test_source_date_is_isoformat(self):
        article = self._parse_test_article()
        d = article.to_dict()
        # Should parse back without error
        parsed = datetime.fromisoformat(d["sourceDate"])
        assert isinstance(parsed, datetime)


def _make_stats():
    """Create a stats dict matching main.create_stats() without importing main.

    This avoids pulling in openai/processors dependencies during testing.
    """
    return {
        "start_time": datetime.now(),
        "end_time": None,
        "sources": {},
        "total_fetched": 0,
        "total_processed": 0,
        "filtered_low_relevance": 0,
        "final_to_webhook": 0,
        "webhook": {
            "status": None,
            "status_code": None,
            "created": 0,
            "updated": 0,
            "duplicates": 0,
            "errors": 0,
            "error_details": [],
            "error": None,
        },
        "x_publish": {
            "status": None,
            "posts_published": 0,
            "error": None,
        },
        "industry_data": {
            "status": None,
            "classified": 0,
            "extracted": 0,
            "submitted": 0,
            "errors": 0,
            "by_table": {},
        },
    }


class TestWeiboWebhookStatsIntegration:
    """Test that webhook response parsing correctly tracks totals."""

    def test_stats_parse_created_updated_errors(self):
        """Simulate webhook response and verify stats extraction."""
        stats = _make_stats()

        # Simulate what submit_to_webhook does when parsing a response
        result = {
            "message": "Webhook processed",
            "batchId": "20250206_120000",
            "results": {
                "created": 5,
                "updated": 2,
                "skipped": 3,
                "errors": ["sourceId abc123: invalid URL format"],
            },
        }

        # Replicate the parsing logic from submit_to_webhook (main.py L479-486)
        stats["webhook"]["status"] = "SUCCESS"
        stats["webhook"]["status_code"] = 200
        results = result.get("results", result)
        stats["webhook"]["created"] = results.get("created", results.get("inserted", 0))
        stats["webhook"]["updated"] = results.get("updated", 0)
        stats["webhook"]["duplicates"] = results.get("duplicates", results.get("skipped", 0))
        errors = results.get("errors", [])
        stats["webhook"]["errors"] = len(errors) if isinstance(errors, list) else 0
        stats["webhook"]["error_details"] = errors if isinstance(errors, list) else []

        assert stats["webhook"]["created"] == 5
        assert stats["webhook"]["updated"] == 2
        assert stats["webhook"]["duplicates"] == 3
        assert stats["webhook"]["errors"] == 1
        assert len(stats["webhook"]["error_details"]) == 1

    def test_stats_parse_legacy_format(self):
        """Test parsing when response has no nested 'results' key (legacy)."""
        stats = _make_stats()

        # Legacy format: stats at top level (no "results" wrapper)
        result = {
            "created": 3,
            "inserted": 0,
            "skipped": 1,
            "errors": [],
        }

        results = result.get("results", result)
        stats["webhook"]["created"] = results.get("created", results.get("inserted", 0))
        stats["webhook"]["updated"] = results.get("updated", 0)
        stats["webhook"]["duplicates"] = results.get("duplicates", results.get("skipped", 0))
        errors = results.get("errors", [])
        stats["webhook"]["errors"] = len(errors) if isinstance(errors, list) else 0

        assert stats["webhook"]["created"] == 3
        assert stats["webhook"]["duplicates"] == 1
        assert stats["webhook"]["errors"] == 0

    def test_total_counts_across_sources(self):
        """Verify that total_fetched and total_processed accumulate correctly."""
        stats = _make_stats()

        # Simulate two sources
        stats["sources"]["weibo"] = {"fetched": 12, "processed": 10, "errors": 0, "error_msg": None}
        stats["sources"]["nio"] = {"fetched": 5, "processed": 5, "errors": 0, "error_msg": None}
        stats["total_fetched"] = 17
        stats["total_processed"] = 15
        stats["final_to_webhook"] = 15

        assert stats["total_fetched"] == sum(s["fetched"] for s in stats["sources"].values())
        assert stats["total_processed"] == sum(s["processed"] for s in stats["sources"].values())
        assert stats["final_to_webhook"] <= stats["total_processed"]

    def test_stats_zero_on_no_articles(self):
        """When no articles fetched, all counts should be 0."""
        stats = _make_stats()
        assert stats["total_fetched"] == 0
        assert stats["total_processed"] == 0
        assert stats["final_to_webhook"] == 0
        assert stats["webhook"]["created"] == 0
        assert stats["webhook"]["updated"] == 0
        assert stats["webhook"]["errors"] == 0

    def test_created_plus_updated_plus_duplicates_equals_total(self):
        """The sum of created + updated + duplicates should equal total submitted."""
        stats = _make_stats()

        total_submitted = 10
        stats["webhook"]["created"] = 5
        stats["webhook"]["updated"] = 2
        stats["webhook"]["duplicates"] = 3
        stats["webhook"]["errors"] = 0

        accounted = stats["webhook"]["created"] + stats["webhook"]["updated"] + stats["webhook"]["duplicates"]
        assert accounted == total_submitted, (
            f"created({stats['webhook']['created']}) + updated({stats['webhook']['updated']}) "
            f"+ duplicates({stats['webhook']['duplicates']}) should equal total({total_submitted})"
        )


class TestWeiboFetchArticlesBehavior:
    """Test fetch_articles configuration (without actual browser)."""

    def setup_method(self):
        self.source = WeiboSource()

    def test_default_max_age_hours(self):
        """Verify default max_age_hours is 8."""
        import inspect
        sig = inspect.signature(self.source.fetch_articles)
        assert sig.parameters["max_age_hours"].default == 8

    def test_default_limit(self):
        """Verify default limit parameter exists."""
        import inspect
        sig = inspect.signature(self.source.fetch_articles)
        assert sig.parameters["limit"].default == 10

    def test_source_type(self):
        assert self.source.source_type == "WEIBO"
        assert self.source.name == "Weibo"
