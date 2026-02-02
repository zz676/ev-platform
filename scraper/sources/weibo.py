"""Weibo (微博) social media scraper for EV-related content."""

import re
import time
import json
import random
from datetime import datetime, timedelta
from typing import Optional

from .base import BaseSource, Article

# Weibo user IDs and display names (verified IDs as of Feb 2026)
WEIBO_USER_IDS = {
    # Official Brands
    "5675889356": "蔚来",
    "5710264970": "小鹏汽车",
    "6001272153": "理想汽车",
    "1746221281": "比亚迪汽车",
    "7871239944": "小米汽车",
    # Founders/Executives
    "1679013335": "李斌",      # NIO CEO
    "2455476364": "何小鹏",    # XPeng Chairman
    "1243861097": "李想",      # Li Auto CEO
    "1749127163": "雷军",      # Xiaomi CEO
}


class WeiboSource(BaseSource):
    """Scraper for Weibo posts from EV companies and executives.

    Uses Playwright to handle Weibo's visitor authentication system.
    """

    name = "Weibo"
    source_type = "WEIBO"

    # Mobile API endpoint
    API_URL = "https://m.weibo.cn/api/container/getIndex"

    def __init__(self):
        super().__init__()
        self._browser = None
        self._context = None
        self._page = None

    def _init_browser(self):
        """Initialize Playwright browser with visitor cookies."""
        if self._page is not None:
            return

        from playwright.sync_api import sync_playwright

        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(headless=True)
        self._context = self._browser.new_context(
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
            viewport={"width": 375, "height": 812},
            locale="zh-CN",
        )
        self._page = self._context.new_page()

        # Visit m.weibo.cn to get visitor cookies
        print("  Initializing Weibo visitor session...")
        self._page.goto("https://m.weibo.cn/", wait_until="networkidle", timeout=30000)
        time.sleep(2)  # Allow visitor system to complete

    def _cleanup_browser(self):
        """Clean up Playwright resources."""
        if self._page:
            self._page.close()
            self._page = None
        if self._context:
            self._context.close()
            self._context = None
        if self._browser:
            self._browser.close()
            self._browser = None
        if hasattr(self, '_playwright') and self._playwright:
            self._playwright.stop()
            self._playwright = None

    def fetch_articles(self, limit: int = 10) -> list[Article]:
        """Fetch posts from configured Weibo accounts.

        Args:
            limit: Maximum total number of posts to return

        Returns:
            List of Article objects
        """
        articles = []
        posts_per_user = max(3, limit // len(WEIBO_USER_IDS))

        try:
            self._init_browser()

            for user_id, user_name in WEIBO_USER_IDS.items():
                try:
                    print(f"  Fetching Weibo posts from {user_name} ({user_id})...")
                    posts = self._fetch_user_posts(user_id, user_name, limit=posts_per_user)
                    articles.extend(posts)
                    print(f"    Found {len(posts)} posts")

                    # Rate limiting: random delay between 1-3 seconds
                    time.sleep(random.uniform(1, 3))

                except Exception as e:
                    print(f"  Error fetching {user_name}: {e}")
                    continue

        finally:
            self._cleanup_browser()

        # Sort by date (newest first) and limit
        articles.sort(key=lambda x: x.source_date, reverse=True)
        return articles[:limit]

    def _fetch_user_posts(self, user_id: str, user_name: str, limit: int) -> list[Article]:
        """Fetch posts from a specific Weibo user using Playwright.

        Args:
            user_id: Weibo user ID
            user_name: Display name for the user
            limit: Maximum posts to fetch

        Returns:
            List of Article objects
        """
        # Container ID format for user's weibo tab
        container_id = f"107603{user_id}"
        api_url = f"{self.API_URL}?type=uid&value={user_id}&containerid={container_id}"

        # Use Playwright to fetch the API with proper cookies
        response = self._page.evaluate(f"""
            async () => {{
                const response = await fetch("{api_url}", {{
                    headers: {{
                        'Accept': 'application/json, text/plain, */*',
                        'X-Requested-With': 'XMLHttpRequest'
                    }},
                    credentials: 'include'
                }});
                return await response.text();
            }}
        """)

        try:
            data = json.loads(response)
        except json.JSONDecodeError as e:
            print(f"    Failed to parse JSON response: {e}")
            return []

        if data.get("ok") != 1:
            print(f"    API returned error: {data.get('msg', 'Unknown error')}")
            return []

        articles = []
        cards = data.get("data", {}).get("cards", [])

        for card in cards:
            # card_type 9 = weibo post
            if card.get("card_type") != 9:
                continue

            mblog = card.get("mblog", {})
            if not mblog:
                continue

            article = self._parse_mblog(mblog, user_name)
            if article:
                articles.append(article)

            if len(articles) >= limit:
                break

        return articles

    def _parse_mblog(self, mblog: dict, user_name: str) -> Optional[Article]:
        """Parse a Weibo mblog (post) into an Article.

        Args:
            mblog: Weibo post data from API
            user_name: Display name of the user

        Returns:
            Article object or None if parsing fails
        """
        try:
            weibo_id = mblog.get("id", "")
            bid = mblog.get("bid", weibo_id)  # Base62 encoded ID for URL

            # Get text content and clean it
            text = self._clean_weibo_text(mblog.get("text", ""))
            if not text:
                return None

            # Parse date
            created_at = self._parse_weibo_date(mblog.get("created_at", ""))

            # Extract images
            pics = mblog.get("pics", [])
            media_urls = []
            for pic in pics:
                # Prefer large image, fallback to regular
                large_url = pic.get("large", {}).get("url", "")
                regular_url = pic.get("url", "")
                if large_url:
                    media_urls.append(large_url)
                elif regular_url:
                    media_urls.append(regular_url)

            # Generate URL
            user = mblog.get("user", {})
            post_user_id = user.get("id", "")
            source_url = f"https://weibo.com/{post_user_id}/{bid}"

            # Generate title from text (first 50 chars)
            title = text[:50] + "..." if len(text) > 50 else text

            return Article(
                source_id=self._generate_source_id(source_url, created_at),
                source=self.source_type,
                source_url=source_url,
                source_author=user_name,
                source_date=created_at,
                original_title=title,
                original_content=text,
                original_media_urls=media_urls,
                categories=["Weibo", user_name],
            )

        except Exception as e:
            print(f"    Error parsing mblog: {e}")
            return None

    def _clean_weibo_text(self, html_text: str) -> str:
        """Clean Weibo text content by removing HTML and special elements.

        Args:
            html_text: Raw HTML text from Weibo API

        Returns:
            Cleaned plain text
        """
        if not html_text:
            return ""

        # Remove HTML tags but keep link text
        text = re.sub(r'<a[^>]*>([^<]*)</a>', r'\1', html_text)

        # Remove remaining HTML tags
        text = re.sub(r'<[^>]+>', '', text)

        # Remove emoji spans that have alt text
        text = re.sub(r'\[([^\]]+)\]', '', text)

        # Clean up whitespace
        text = ' '.join(text.split())

        # Decode HTML entities
        import html
        text = html.unescape(text)

        return text.strip()

    def _parse_weibo_date(self, date_str: str) -> datetime:
        """Parse Weibo's various date formats.

        Weibo uses relative formats like:
        - "刚刚" (just now)
        - "5分钟前" (5 minutes ago)
        - "1小时前" (1 hour ago)
        - "昨天 14:30" (yesterday)
        - "05-20" (May 20, current year)
        - "2024-05-20" (full date)

        Args:
            date_str: Date string from Weibo API

        Returns:
            Parsed datetime object
        """
        now = datetime.now()

        if not date_str:
            return now

        # Just now
        if "刚刚" in date_str:
            return now

        # X minutes ago
        minutes_match = re.match(r'(\d+)分钟前', date_str)
        if minutes_match:
            minutes = int(minutes_match.group(1))
            return now - timedelta(minutes=minutes)

        # X hours ago
        hours_match = re.match(r'(\d+)小时前', date_str)
        if hours_match:
            hours = int(hours_match.group(1))
            return now - timedelta(hours=hours)

        # Yesterday
        if "昨天" in date_str:
            time_match = re.search(r'(\d{1,2}):(\d{2})', date_str)
            if time_match:
                hour, minute = int(time_match.group(1)), int(time_match.group(2))
                yesterday = now - timedelta(days=1)
                return yesterday.replace(hour=hour, minute=minute, second=0, microsecond=0)
            return now - timedelta(days=1)

        # Month-day format (current year)
        md_match = re.match(r'(\d{1,2})-(\d{1,2})', date_str)
        if md_match and '-' in date_str and len(date_str) <= 5:
            month, day = int(md_match.group(1)), int(md_match.group(2))
            return datetime(now.year, month, day)

        # Full date format
        try:
            from dateutil import parser
            return parser.parse(date_str)
        except Exception:
            pass

        return now
