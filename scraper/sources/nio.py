"""NIO (蔚来) official news scraper."""

from datetime import datetime
from typing import Optional
from bs4 import Tag

from .base import BaseSource, Article


class NIOSource(BaseSource):
    """Scraper for NIO official news page."""

    name = "NIO"
    source_type = "OFFICIAL"
    base_url = "https://www.nio.com"
    news_url = "https://www.nio.com/news"

    def fetch_articles(self, limit: int = 10) -> list[Article]:
        """Fetch news from NIO news page."""
        articles = []

        try:
            soup = self._get_soup(self.news_url)

            # NIO news page uses React CSS modules with class names like news_newsItem__xxx
            items = soup.select("[class*='news_newsItem']")

            if not items:
                # Try alternative selectors
                items = soup.select("article, .news-item, [class*='newsItem']")

            for item in items[:limit]:
                article = self._parse_article(item)
                if article:
                    articles.append(article)

        except Exception as e:
            print(f"Error fetching NIO articles: {e}")

        return articles

    def _parse_article(self, item: Tag) -> Optional[Article]:
        """Parse a single article item."""
        try:
            # Find title and link - NIO uses anchor tags containing the news item
            title_elem = item.select_one("a")
            if not title_elem:
                # The item itself might be the link
                title_elem = item if item.name == "a" else None
            if not title_elem:
                return None

            # Find the title text - look for heading or text content
            title_text_elem = item.select_one("h2, h3, h4, [class*='title']")
            title = self._clean_text(title_text_elem.get_text()) if title_text_elem else self._clean_text(title_elem.get_text())

            link = title_elem.get("href", "")

            if link and not link.startswith("http"):
                link = f"{self.base_url}{link}"

            # Find date - NIO uses YYYY-MM-DD format
            date_elem = item.select_one("[class*='date'], time, span")
            date_str = date_elem.get_text() if date_elem else ""
            pub_date = self._parse_date(date_str)

            # Generate source ID
            source_id = self._generate_source_id(link, pub_date)

            # Fetch full article content if we have a link
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
            print(f"Error parsing NIO article: {e}")
            return None

    def _fetch_full_article(self, url: str) -> tuple[str, list[str]]:
        """Fetch full article content from detail page."""
        try:
            soup = self._get_soup(url)

            # Find article body - NIO uses React CSS modules
            body = soup.select_one(
                "[class*='article'], [class*='content'], article, .content"
            )

            if body:
                # Extract text
                paragraphs = body.find_all("p")
                content = "\n\n".join(
                    self._clean_text(p.get_text()) for p in paragraphs if p.get_text().strip()
                )

                # Extract images
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
        """Parse date string to datetime."""
        from dateutil import parser

        try:
            return parser.parse(date_str)
        except Exception:
            return datetime.now()
