"""CnEVData source adapter for scraping EV sales data from cnevdata.com."""

import hashlib
import random
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
import re

import httpx
from bs4 import BeautifulSoup

import sys
sys.path.append("..")
from config import REQUEST_TIMEOUT
from extractors import TitleParser, SummaryParser, ArticleClassifier, ArticleType


@dataclass
class CnEVDataArticle:
    """Represents a scraped article from CnEVData."""
    url: str
    url_hash: str
    title: str
    summary: Optional[str] = None
    published_at: Optional[datetime] = None
    preview_image: Optional[str] = None
    article_type: Optional[str] = None
    needs_ocr: bool = False
    ocr_data_type: Optional[str] = None  # "rankings", "trend", "metrics", "specs"

    def to_dict(self) -> dict:
        """Convert to dictionary for database storage."""
        return {
            "sourceUrl": self.url,
            "urlHash": self.url_hash,
            "title": self.title,
            "summary": self.summary,
            "publishedAt": self.published_at.isoformat() if self.published_at else None,
            "previewImage": self.preview_image,
            "articleType": self.article_type,
            "needsOcr": self.needs_ocr,
            "ocrDataType": self.ocr_data_type,
        }


class CnEVDataSource:
    """Source adapter for cnevdata.com EV sales data."""

    name = "CnEVData"
    source_type = "MEDIA"
    base_url = "https://cnevdata.com"

    # Anti-detection configuration
    USER_AGENTS = [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    ]

    # Request delay range (seconds)
    MIN_DELAY = 3
    MAX_DELAY = 8

    def __init__(self):
        self.title_parser = TitleParser()
        self.summary_parser = SummaryParser()
        self.classifier = ArticleClassifier()

        # Initialize HTTP client with random user agent
        self.client = httpx.Client(
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
            headers=self._get_headers(),
        )

    def _get_headers(self) -> dict:
        """Get request headers with random user agent."""
        return {
            "User-Agent": random.choice(self.USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "max-age=0",
        }

    def _random_delay(self):
        """Add random delay between requests."""
        delay = random.uniform(self.MIN_DELAY, self.MAX_DELAY)
        time.sleep(delay)

    def _generate_url_hash(self, url: str) -> str:
        """Generate MD5 hash of URL for deduplication."""
        return hashlib.md5(url.encode()).hexdigest()

    def fetch_article_list(self, page: int = 1) -> list[CnEVDataArticle]:
        """Fetch list of articles from a specific page.

        Args:
            page: Page number (1-indexed)

        Returns:
            List of CnEVDataArticle objects
        """
        # CnEVData uses WordPress-style pagination
        url = f"{self.base_url}/page/{page}/"

        print(f"  Fetching page {page}: {url}")

        try:
            # Rotate user agent
            self.client.headers.update(self._get_headers())

            response = self.client.get(url)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, "lxml")
            articles = []

            # Find article entries - cnevdata uses list-item blocks
            article_elements = soup.select('div.list-item.block')

            # Fallback: try date-based URL patterns (WordPress style)
            if not article_elements:
                article_elements = soup.select('a[href*="/20"]')

            for elem in article_elements:
                article = self._parse_article_element(elem)
                if article:
                    articles.append(article)

            print(f"  Found {len(articles)} articles on page {page}")
            return articles

        except httpx.HTTPStatusError as e:
            print(f"  HTTP error fetching page {page}: {e.response.status_code}")
            return []
        except Exception as e:
            print(f"  Error fetching page {page}: {e}")
            return []

    def _parse_article_element(self, elem) -> Optional[CnEVDataArticle]:
        """Parse an article element from the page.

        Args:
            elem: BeautifulSoup element

        Returns:
            CnEVDataArticle or None
        """
        try:
            # Find the link
            link = elem.find('a', href=True)
            if elem.name == 'a' and elem.get('href'):
                link = elem

            if not link:
                return None

            href = link.get('href', '')
            # WordPress-style date URLs: /YYYY/MM/DD/slug/
            if not re.search(r'/\d{4}/\d{2}/\d{2}/', href):
                return None

            # Build full URL
            if href.startswith('/'):
                url = f"{self.base_url}{href}"
            elif href.startswith('http'):
                url = href
            else:
                url = f"{self.base_url}/{href}"

            # Extract title
            title_elem = elem.select_one('h2, h3, .post-title, [class*="title"]')
            if title_elem:
                title = title_elem.get_text(strip=True)
            else:
                title = link.get_text(strip=True)

            if not title:
                return None

            # Extract summary/preview
            summary_elem = elem.select_one('p, .post-subtitle, [class*="subtitle"], [class*="preview"]')
            summary = summary_elem.get_text(strip=True) if summary_elem else None

            # Extract date - try HTML element first, fall back to URL date
            date_elem = elem.select_one('time, [class*="date"], [datetime]')
            published_at = None
            if date_elem:
                date_str = date_elem.get('datetime') or date_elem.get_text(strip=True)
                published_at = self._parse_date(date_str)

            # Fallback: extract date from URL (/YYYY/MM/DD/)
            if published_at is None:
                url_date_match = re.search(r'/(\d{4})/(\d{2})/(\d{2})/', url)
                if url_date_match:
                    try:
                        published_at = datetime(
                            int(url_date_match.group(1)),
                            int(url_date_match.group(2)),
                            int(url_date_match.group(3)),
                        )
                    except ValueError:
                        pass

            # Extract preview image
            img_elem = elem.select_one('img')
            preview_image = None
            if img_elem:
                preview_image = img_elem.get('src') or img_elem.get('data-src')

            # Classify the article
            classification = self.classifier.classify(title, summary or "")
            needs_ocr = classification.needs_ocr
            article_type = classification.article_type.value

            return CnEVDataArticle(
                url=url,
                url_hash=self._generate_url_hash(url),
                title=title,
                summary=summary,
                published_at=published_at,
                preview_image=preview_image,
                article_type=article_type,
                needs_ocr=needs_ocr,
                ocr_data_type=classification.ocr_data_type,
            )

        except Exception as e:
            print(f"  Error parsing article element: {e}")
            return None

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date string to datetime."""
        if not date_str:
            return None

        date_str = date_str.strip()

        # Try ISO format first
        try:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except ValueError:
            pass

        # Try common formats
        formats = [
            "%Y-%m-%d",
            "%B %d, %Y",
            "%b %d, %Y",
            "%d %B %Y",
            "%d %b %Y",
            "%m/%d/%Y",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        # Try relative dates
        date_lower = date_str.lower()
        if 'today' in date_lower:
            return datetime.now()
        elif 'yesterday' in date_lower:
            from datetime import timedelta
            return datetime.now() - timedelta(days=1)

        return None

    def fetch_articles(self, limit: int = 10, pages: int = 1) -> list[CnEVDataArticle]:
        """Fetch articles from multiple pages.

        Args:
            limit: Maximum total articles to fetch
            pages: Number of pages to scrape

        Returns:
            List of CnEVDataArticle objects
        """
        all_articles = []

        for page in range(1, pages + 1):
            if len(all_articles) >= limit:
                break

            articles = self.fetch_article_list(page)
            all_articles.extend(articles)

            # Rate limiting
            if page < pages:
                self._random_delay()

        return all_articles[:limit]

    def extract_metrics(self, article: CnEVDataArticle) -> list[dict]:
        """Extract EV metrics from an article.

        Args:
            article: CnEVDataArticle to process

        Returns:
            List of metric dictionaries ready for database
        """
        metrics = []

        # Try to parse metrics from title
        parsed = self.title_parser.parse(article.title, article.published_at)

        if parsed:
            # Enrich with summary data
            if article.summary:
                self.summary_parser.enrich_metric(parsed, article.summary)

            metrics.append({
                "brand": parsed.brand,
                "metric": parsed.metric_type,
                "periodType": parsed.period_type,
                "year": parsed.year,
                "period": parsed.month or parsed.quarter or 1,
                "value": parsed.value,
                "unit": parsed.unit,
                "yoyChange": parsed.yoy_change,
                "momChange": parsed.mom_change,
                "vehicleModel": parsed.vehicle_model,
                "region": parsed.region,
                "category": parsed.category,
                "sourceUrl": article.url,
                "sourceTitle": article.title,
                "confidence": parsed.confidence,
            })

        return metrics

    def close(self):
        """Close the HTTP client."""
        self.client.close()


# Test function
def test_cnevdata():
    """Test the CnEVData source adapter."""
    source = CnEVDataSource()

    print("Testing CnEVData scraper...")
    print(f"Base URL: {source.base_url}")

    try:
        # Fetch first page
        articles = source.fetch_article_list(page=1)

        print(f"\nFound {len(articles)} articles:")
        for article in articles[:5]:  # Show first 5
            print(f"\n  Title: {article.title}")
            print(f"  URL: {article.url}")
            print(f"  Type: {article.article_type}")
            print(f"  Needs OCR: {article.needs_ocr}")
            if article.published_at:
                print(f"  Date: {article.published_at}")

            # Try to extract metrics
            metrics = source.extract_metrics(article)
            if metrics:
                print(f"  Extracted {len(metrics)} metrics:")
                for m in metrics:
                    print(f"    {m['brand']} {m['metric']}: {m['value']}")

    finally:
        source.close()


if __name__ == "__main__":
    test_cnevdata()
