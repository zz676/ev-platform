"""BYD (比亚迪) official news scraper."""

from datetime import datetime
from typing import Optional
from bs4 import Tag

from .base import BaseSource, Article


class BYDSource(BaseSource):
    """Scraper for BYD official news page."""

    name = "BYD"
    source_type = "OFFICIAL"
    base_url = "https://www.byd.com"
    news_url = "https://www.byd.com/en/news"

    def fetch_articles(self, limit: int = 10) -> list[Article]:
        """Fetch news from BYD official website."""
        articles = []

        try:
            soup = self._get_soup(self.news_url)

            # BYD news page structure
            items = soup.select(".news-list .news-item, .news-card, article")

            if not items:
                # Alternative: look for any news-like structure
                items = soup.select("[class*='news'], [class*='article']")

            for item in items[:limit]:
                article = self._parse_article(item)
                if article:
                    articles.append(article)

        except Exception as e:
            print(f"Error fetching BYD articles: {e}")

        return articles

    def _parse_article(self, item: Tag) -> Optional[Article]:
        """Parse a single article item."""
        try:
            # Find title and link
            title_elem = item.select_one("a, h2, h3, .title")
            if not title_elem:
                return None

            # If title element is a link, get href; otherwise find nearby link
            if title_elem.name == "a":
                title = self._clean_text(title_elem.get_text())
                link = title_elem.get("href", "")
            else:
                title = self._clean_text(title_elem.get_text())
                link_elem = item.select_one("a")
                link = link_elem.get("href", "") if link_elem else ""

            if not title:
                return None

            if link and not link.startswith("http"):
                link = f"{self.base_url}{link}"

            # Find date
            date_elem = item.select_one(".date, time, [class*='date'], [class*='time']")
            date_str = date_elem.get_text() if date_elem else ""
            pub_date = self._parse_date(date_str)

            # Generate source ID
            source_id = self._generate_source_id(link or title, pub_date)

            # Find summary/excerpt
            summary_elem = item.select_one(".summary, .excerpt, .desc, p")
            summary = self._clean_text(summary_elem.get_text()) if summary_elem else ""

            # Get full content if we have a link
            content = summary
            media_urls = []

            if link:
                full_content, media_urls = self._fetch_full_article(link)
                if full_content:
                    content = full_content

            # Extract image from the item itself
            img_elem = item.select_one("img")
            if img_elem:
                img_src = img_elem.get("src") or img_elem.get("data-src")
                if img_src and not img_src.startswith("data:"):
                    if not img_src.startswith("http"):
                        img_src = f"{self.base_url}{img_src}"
                    media_urls.append(img_src)

            return Article(
                source_id=source_id,
                source=self.source_type,
                source_url=link or self.news_url,
                source_author=self.name,
                source_date=pub_date,
                original_title=title,
                original_content=content or title,
                original_media_urls=list(set(media_urls)),  # Deduplicate
                categories=[self.name],
            )

        except Exception as e:
            print(f"Error parsing BYD article: {e}")
            return None

    def _fetch_full_article(self, url: str) -> tuple[str, list[str]]:
        """Fetch full article content."""
        try:
            soup = self._get_soup(url)

            # Look for article body
            body = soup.select_one(
                ".article-content, .news-content, .content, article, main"
            )

            if body:
                paragraphs = body.find_all("p")
                content = "\n\n".join(
                    self._clean_text(p.get_text()) for p in paragraphs if p.get_text().strip()
                )

                images = body.find_all("img")
                media_urls = []
                for img in images:
                    src = img.get("src") or img.get("data-src")
                    if src and not src.startswith("data:"):
                        if not src.startswith("http"):
                            src = f"{self.base_url}{src}"
                        media_urls.append(src)

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
