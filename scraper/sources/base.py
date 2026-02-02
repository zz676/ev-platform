"""Base class for all source adapters."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import httpx
from bs4 import BeautifulSoup

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
