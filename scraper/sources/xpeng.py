"""XPeng (小鹏) official news scraper."""

from datetime import datetime
from typing import Optional
from bs4 import Tag

from .base import BaseSource, Article


class XPengSource(BaseSource):
    """Scraper for XPeng Investor Relations news releases."""

    name = "XPeng"
    source_type = "OFFICIAL"
    base_url = "https://ir.xiaopeng.com"
    news_url = "https://ir.xiaopeng.com/"

    def fetch_articles(self, limit: int = 10) -> list[Article]:
        """Fetch news releases from XPeng IR homepage."""
        articles = []

        try:
            soup = self._get_soup(self.news_url)

            # XPeng IR homepage shows news releases with links to detail pages
            # Find links that point to news release details
            items = soup.select("a[href*='/news-releases/news-release-details/']")

            if not items:
                # Alternative: look for news widget sections
                items = soup.select(".nir-widget--list .nir-widget--field a")

            # Deduplicate by href
            seen_hrefs = set()
            unique_items = []
            for item in items:
                href = item.get("href", "")
                if href and href not in seen_hrefs:
                    seen_hrefs.add(href)
                    unique_items.append(item)

            for item in unique_items[:limit]:
                article = self._parse_article(item)
                if article:
                    articles.append(article)

        except Exception as e:
            print(f"Error fetching XPeng articles: {e}")

        return articles

    def _parse_article(self, item: Tag) -> Optional[Article]:
        """Parse a single article item (anchor tag)."""
        try:
            # The item is the anchor tag itself
            title = self._clean_text(item.get_text())
            if not title:
                return None

            link = item.get("href", "")

            if link and not link.startswith("http"):
                link = f"{self.base_url}{link}"

            # Date is typically in a sibling or parent element
            parent = item.find_parent()
            date_elem = parent.select_one(".date, time, [class*='date']") if parent else None
            date_str = date_elem.get_text() if date_elem else ""
            pub_date = self._parse_date(date_str)

            # Generate source ID
            source_id = self._generate_source_id(link, pub_date)

            # Fetch full content
            content = ""
            media_urls = []
            if link:
                content, media_urls = self._fetch_full_article(link)

            return Article(
                source_id=source_id,
                source=self.source_type,
                source_url=link,
                source_author=self.name,
                source_date=pub_date,
                original_title=title,
                original_content=content or title,
                original_media_urls=media_urls,
                categories=[self.name],
            )

        except Exception as e:
            print(f"Error parsing XPeng article: {e}")
            return None

    def _fetch_full_article(self, url: str) -> tuple[str, list[str]]:
        """Fetch full article content."""
        try:
            soup = self._get_soup(url)

            body = soup.select_one(
                ".nir-widget--news-body, .article-body, article"
            )

            if body:
                paragraphs = body.find_all("p")
                content = "\n\n".join(
                    self._clean_text(p.get_text()) for p in paragraphs if p.get_text().strip()
                )

                images = body.find_all("img")
                media_urls = [
                    img.get("src")
                    for img in images
                    if img.get("src") and not img.get("src").startswith("data:")
                ]

                return content, media_urls

        except Exception as e:
            print(f"Error fetching full article: {e}")

        return "", []

    def _parse_date(self, date_str: str) -> datetime:
        """Parse date string."""
        from dateutil import parser

        try:
            return parser.parse(date_str)
        except Exception:
            return datetime.now()
