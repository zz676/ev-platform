"""Li Auto (理想) official news scraper."""

from datetime import datetime
from typing import Optional
from bs4 import Tag

from .base import BaseSource, Article


class LiAutoSource(BaseSource):
    """Scraper for Li Auto Investor Relations news releases."""

    name = "Li Auto"
    source_type = "OFFICIAL"
    base_url = "https://ir.lixiang.com"
    news_url = "https://ir.lixiang.com/news-releases"

    def fetch_articles(self, limit: int = 10) -> list[Article]:
        """Fetch news releases from Li Auto IR page."""
        articles = []

        try:
            soup = self._get_soup(self.news_url)

            # Li Auto IR page structure (similar to other Nasdaq IR sites)
            items = soup.select(".nir-widget--list .nir-widget--field")

            if not items:
                items = soup.select("article, .news-item, .press-release-item")

            for item in items[:limit]:
                article = self._parse_article(item)
                if article:
                    articles.append(article)

        except Exception as e:
            print(f"Error fetching Li Auto articles: {e}")

        return articles

    def _parse_article(self, item: Tag) -> Optional[Article]:
        """Parse a single article item."""
        try:
            title_elem = item.select_one("a, .title, h3")
            if not title_elem:
                return None

            title = self._clean_text(title_elem.get_text())
            link = title_elem.get("href", "")

            if link and not link.startswith("http"):
                link = f"{self.base_url}{link}"

            date_elem = item.select_one(".date, time, .nir-widget--field--date")
            date_str = date_elem.get_text() if date_elem else ""
            pub_date = self._parse_date(date_str)

            source_id = self._generate_source_id(link, pub_date)

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
            print(f"Error parsing Li Auto article: {e}")
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
