"""Base class for all source adapters."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Tuple
import httpx
from bs4 import BeautifulSoup
from dateutil import parser as date_parser

import sys
sys.path.append("..")
from config import USER_AGENT, REQUEST_TIMEOUT


@dataclass
class Article:
    """Represents a scraped article."""

    source_id: str
    source: str  # OFFICIAL, MEDIA, WEIBO, MANUAL
    source_url: str
    source_author: str
    source_date: datetime

    # Original content
    original_title: Optional[str] = None
    original_content: str = ""
    original_media_urls: list[str] = field(default_factory=list)

    # Translated content (filled by AI processor)
    translated_title: Optional[str] = None
    translated_content: Optional[str] = None
    translated_summary: Optional[str] = None

    # Metadata (filled by AI processor)
    categories: list[str] = field(default_factory=list)
    relevance_score: int = 50

    def to_dict(self) -> dict:
        """Convert to dictionary for API submission."""
        return {
            "sourceId": self.source_id,
            "source": self.source,
            "sourceUrl": self.source_url,
            "sourceAuthor": self.source_author,
            "sourceDate": self.source_date.isoformat(),
            "originalTitle": self.original_title,
            "originalContent": self.original_content,
            "originalMediaUrls": self.original_media_urls,
            "translatedTitle": self.translated_title,
            "translatedContent": self.translated_content,
            "translatedSummary": self.translated_summary,
            "categories": self.categories,
            "relevanceScore": self.relevance_score,
        }


class BaseSource(ABC):
    """Abstract base class for source adapters."""

    name: str = "Unknown"
    source_type: str = "OFFICIAL"

    def __init__(self):
        # Use default httpx client with default headers
        # Some IR sites have bot protection that blocks custom Chrome-like user agents
        self.client = httpx.Client(
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
        )

    @abstractmethod
    def fetch_articles(self, limit: int = 10) -> list[Article]:
        """Fetch articles from the source.

        Args:
            limit: Maximum number of articles to fetch

        Returns:
            List of Article objects
        """
        pass

    def _get_soup(self, url: str) -> BeautifulSoup:
        """Fetch URL and return BeautifulSoup object."""
        response = self.client.get(url)
        response.raise_for_status()
        return BeautifulSoup(response.content, "lxml")

    def _clean_text(self, text: str) -> str:
        """Clean and normalize text content."""
        if not text:
            return ""
        # Remove extra whitespace
        text = " ".join(text.split())
        return text.strip()

    def _generate_source_id(self, url: str, date: datetime) -> str:
        """Generate a unique source ID."""
        import hashlib
        unique = f"{self.name}_{url}_{date.isoformat()}"
        return hashlib.md5(unique.encode()).hexdigest()[:16]

    def _extract_date_from_meta(self, soup: BeautifulSoup) -> Optional[datetime]:
        """Extract date from standard meta tags.

        Checks common meta tag formats used for article publication dates.

        Args:
            soup: BeautifulSoup object of the page

        Returns:
            Parsed datetime or None if not found
        """
        meta_selectors = [
            ('meta[property="article:published_time"]', 'content'),
            ('meta[name="datePublished"]', 'content'),
            ('meta[name="pubdate"]', 'content'),
            ('meta[name="publish_date"]', 'content'),
            ('meta[itemprop="datePublished"]', 'content'),
            ('meta[property="og:article:published_time"]', 'content'),
            ('time[datetime]', 'datetime'),
            ('time[pubdate]', 'datetime'),
        ]
        for selector, attr in meta_selectors:
            elem = soup.select_one(selector)
            if elem:
                date_value = elem.get(attr)
                if date_value:
                    parsed = self._parse_date_robust(date_value)
                    if parsed:
                        return parsed
        return None

    def _extract_date_from_selectors(self, soup: BeautifulSoup, selectors: list[str]) -> Optional[datetime]:
        """Extract date using a list of CSS selectors.

        Args:
            soup: BeautifulSoup object of the page
            selectors: List of CSS selectors to try

        Returns:
            Parsed datetime or None if not found
        """
        for selector in selectors:
            elem = soup.select_one(selector)
            if elem:
                # Try datetime attribute first (for <time> elements)
                date_value = elem.get('datetime') or elem.get_text()
                if date_value:
                    parsed = self._parse_date_robust(date_value.strip())
                    if parsed:
                        return parsed
        return None

    def _parse_date_robust(self, date_str: str) -> Optional[datetime]:
        """Parse date string with better error handling.

        Args:
            date_str: Date string to parse

        Returns:
            Parsed datetime or None if parsing fails
        """
        if not date_str or not date_str.strip():
            return None

        date_str = date_str.strip()

        try:
            return date_parser.parse(date_str)
        except Exception:
            pass

        # Try common date formats explicitly
        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%B %d, %Y",
            "%b %d, %Y",
            "%d %B %Y",
            "%d %b %Y",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S%z",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        return None

    def _parse_date_with_fallback(self, date_str: str, url: str) -> datetime:
        """Parse date string with fallback to current time and warning.

        Args:
            date_str: Date string to parse
            url: URL of the article (for logging)

        Returns:
            Parsed datetime or current time as fallback
        """
        parsed = self._parse_date_robust(date_str)
        if parsed:
            return parsed

        print(f"  WARNING: Could not extract date for {url}, using current time")
        return datetime.now()

    def _extract_date_from_url(self, url: str) -> Optional[datetime]:
        """Try to extract date from URL patterns.

        Many sites embed dates in URLs like:
        - /news/20250920001 (NIO format: YYYYMMDD)
        - /2025/09/20/article-title
        - /article-2025-09-20

        Args:
            url: The article URL

        Returns:
            Extracted datetime or None
        """
        import re

        # Pattern 1: NIO style - /news/YYYYMMDD followed by digits
        # e.g., https://www.nio.com/news/20250920001
        nio_match = re.search(r'/news/(\d{4})(\d{2})(\d{2})\d+', url)
        if nio_match:
            try:
                year, month, day = int(nio_match.group(1)), int(nio_match.group(2)), int(nio_match.group(3))
                if 2020 <= year <= 2030 and 1 <= month <= 12 and 1 <= day <= 31:
                    return datetime(year, month, day)
            except ValueError:
                pass

        # Pattern 2: Path date - /YYYY/MM/DD/
        path_match = re.search(r'/(\d{4})/(\d{2})/(\d{2})/', url)
        if path_match:
            try:
                year, month, day = int(path_match.group(1)), int(path_match.group(2)), int(path_match.group(3))
                if 2020 <= year <= 2030 and 1 <= month <= 12 and 1 <= day <= 31:
                    return datetime(year, month, day)
            except ValueError:
                pass

        # Pattern 3: Hyphenated date in URL - YYYY-MM-DD
        hyphen_match = re.search(r'(\d{4})-(\d{2})-(\d{2})', url)
        if hyphen_match:
            try:
                year, month, day = int(hyphen_match.group(1)), int(hyphen_match.group(2)), int(hyphen_match.group(3))
                if 2020 <= year <= 2030 and 1 <= month <= 12 and 1 <= day <= 31:
                    return datetime(year, month, day)
            except ValueError:
                pass

        return None
