#!/usr/bin/env python3
"""Backfill source dates for existing posts by re-scraping their source URLs.

This script fetches all posts from the database, visits each source URL,
extracts the publication date using the improved date extraction methods,
and updates the sourceDate field if a valid date is found.

Usage:
    python backfill_dates.py              # Process all posts
    python backfill_dates.py --dry-run    # Preview without updating
    python backfill_dates.py --limit 10   # Process only first 10 posts
    python backfill_dates.py --source NIO # Process only NIO posts
"""

import argparse
from datetime import datetime, timedelta
from typing import Optional
import httpx
from bs4 import BeautifulSoup
from supabase import create_client, Client

from config import SUPABASE_URL, SUPABASE_KEY, REQUEST_TIMEOUT
from sources.base import BaseSource


class DateExtractor(BaseSource):
    """Helper class to use base class date extraction methods."""

    name = "DateExtractor"

    def __init__(self):
        super().__init__()

    def fetch_articles(self, limit: int = 10):
        """Not used - required by abstract base class."""
        return []

    def extract_date_from_url_pattern(self, url: str) -> Optional[datetime]:
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

    def extract_date_from_url(self, url: str) -> Optional[datetime]:
        """Visit a URL and extract the publication date.

        Args:
            url: The article URL to visit

        Returns:
            Extracted datetime or None if extraction fails
        """
        # First, try to extract date from URL pattern (fast, no network request needed)
        url_date = self.extract_date_from_url_pattern(url)
        if url_date:
            print(f"    (extracted from URL pattern)")
            return url_date

        try:
            soup = self._get_soup(url)

            # Try meta tags first (most reliable)
            date = self._extract_date_from_meta(soup)
            if date:
                return date

            # Try common selectors for article dates
            selectors = [
                # NIR widget selectors (XPeng, Li Auto)
                ".nir-widget--news-date",
                ".nir-widget--field-date",
                ".nir-widget--news-header time",
                "[class*='nir'] time",
                "[class*='nir'] [class*='date']",
                # Generic article selectors
                ".article-date",
                ".news-date",
                ".publish-date",
                ".post-date",
                "[class*='article'] [class*='date']",
                "[class*='news'] [class*='date']",
                "[class*='publish']",
                "time[datetime]",
                "time",
                ".date",
                "[class*='date']",
            ]
            date = self._extract_date_from_selectors(soup, selectors)
            if date:
                return date

            return None

        except Exception as e:
            print(f"    Error fetching {url}: {e}")
            return None


def get_supabase_client() -> Client:
    """Create and return a Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_posts(
    client: Client,
    source_filter: Optional[str] = None,
    limit: Optional[int] = None,
) -> list[dict]:
    """Fetch posts from the database.

    Args:
        client: Supabase client
        source_filter: Optional source name to filter by (e.g., "NIO")
        limit: Optional limit on number of posts to fetch

    Returns:
        List of post dictionaries
    """
    query = client.table("Post").select("id, sourceUrl, sourceDate, sourceAuthor, source, translatedTitle")

    # Filter by source if specified
    if source_filter:
        query = query.ilike("sourceAuthor", f"%{source_filter}%")

    # Order by creation date (newest first)
    query = query.order("createdAt", desc=True)

    # Apply limit if specified
    if limit:
        query = query.limit(limit)

    response = query.execute()
    return response.data


def update_post_date(client: Client, post_id: str, new_date: datetime) -> bool:
    """Update a post's sourceDate in the database.

    Args:
        client: Supabase client
        post_id: The post ID to update
        new_date: The new source date

    Returns:
        True if successful, False otherwise
    """
    try:
        client.table("Post").update({
            "sourceDate": new_date.isoformat(),
            "updatedAt": datetime.now().isoformat(),
        }).eq("id", post_id).execute()
        return True
    except Exception as e:
        print(f"    Error updating post {post_id}: {e}")
        return False


def is_likely_fallback_date(date: datetime) -> bool:
    """Check if a date is likely a fallback (today or very recent).

    Posts with dates exactly today are likely using datetime.now() fallback.

    Args:
        date: The date to check

    Returns:
        True if the date is likely a fallback
    """
    today = datetime.now().date()
    post_date = date.date() if isinstance(date, datetime) else date

    # Consider dates within the last day as potential fallbacks
    return post_date >= today - timedelta(days=1)


def main():
    parser = argparse.ArgumentParser(
        description="Backfill source dates for existing posts",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python backfill_dates.py                    # Process all posts
    python backfill_dates.py --dry-run          # Preview without updating
    python backfill_dates.py --limit 10         # Process only 10 posts
    python backfill_dates.py --source NIO       # Process only NIO posts
    python backfill_dates.py --all              # Process all, not just fallback dates
        """
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without updating the database",
    )

    parser.add_argument(
        "--limit",
        type=int,
        help="Maximum number of posts to process",
    )

    parser.add_argument(
        "--source",
        type=str,
        help="Filter by source author (e.g., NIO, XPeng, Li Auto)",
    )

    parser.add_argument(
        "--all",
        action="store_true",
        help="Process all posts, not just those with likely fallback dates",
    )

    args = parser.parse_args()

    print("=" * 60)
    print("  Date Backfill Script")
    print("=" * 60)
    print(f"  Dry run: {args.dry_run}")
    print(f"  Source filter: {args.source or 'All'}")
    print(f"  Limit: {args.limit or 'None'}")
    print(f"  Process all: {args.all}")
    print("=" * 60)

    # Initialize clients
    print("\nConnecting to Supabase...")
    client = get_supabase_client()
    extractor = DateExtractor()

    # Fetch posts
    print("Fetching posts...")
    posts = fetch_posts(client, source_filter=args.source, limit=args.limit)
    print(f"Found {len(posts)} posts")

    # Process each post
    stats = {
        "total": len(posts),
        "skipped_no_url": 0,
        "skipped_not_fallback": 0,
        "skipped_weibo": 0,
        "extracted": 0,
        "failed": 0,
        "updated": 0,
    }

    for i, post in enumerate(posts, 1):
        post_id = post["id"]
        source_url = post.get("sourceUrl", "")
        current_date = post.get("sourceDate")
        source = post.get("source", "")
        author = post.get("sourceAuthor", "")
        title = post.get("translatedTitle", "")[:50]

        print(f"\n[{i}/{len(posts)}] {author}: {title}...")

        # Skip Weibo posts (they have their own date parsing)
        if source == "WEIBO":
            print("    Skipping (Weibo has its own date parsing)")
            stats["skipped_weibo"] += 1
            continue

        # Skip posts without source URL
        if not source_url or not source_url.startswith("http"):
            print(f"    Skipping (no valid URL)")
            stats["skipped_no_url"] += 1
            continue

        # Parse current date
        if current_date:
            if isinstance(current_date, str):
                try:
                    current_dt = datetime.fromisoformat(current_date.replace("Z", "+00:00"))
                except:
                    current_dt = None
            else:
                current_dt = current_date
        else:
            current_dt = None

        # Skip if not a likely fallback date (unless --all flag)
        if not args.all and current_dt and not is_likely_fallback_date(current_dt):
            print(f"    Skipping (date {current_dt.date()} doesn't look like a fallback)")
            stats["skipped_not_fallback"] += 1
            continue

        # Extract date from URL
        print(f"    Fetching: {source_url[:60]}...")
        new_date = extractor.extract_date_from_url(source_url)

        if new_date:
            print(f"    Extracted date: {new_date.date()}")
            print(f"    Current date:   {current_dt.date() if current_dt else 'None'}")

            # Check if the new date is different and not today
            if current_dt and new_date.date() == current_dt.date():
                print("    No change needed (same date)")
                stats["extracted"] += 1
                continue

            if is_likely_fallback_date(new_date):
                print("    Warning: Extracted date is also today, might be fallback")

            stats["extracted"] += 1

            if args.dry_run:
                print(f"    [DRY RUN] Would update to: {new_date.date()}")
            else:
                if update_post_date(client, post_id, new_date):
                    print(f"    Updated successfully")
                    stats["updated"] += 1
                else:
                    print(f"    Update failed")
                    stats["failed"] += 1
        else:
            print(f"    Could not extract date")
            stats["failed"] += 1

    # Print summary
    print("\n")
    print("=" * 60)
    print("  BACKFILL SUMMARY")
    print("=" * 60)
    print(f"  Total posts:           {stats['total']}")
    print(f"  Skipped (no URL):      {stats['skipped_no_url']}")
    print(f"  Skipped (Weibo):       {stats['skipped_weibo']}")
    print(f"  Skipped (not fallback):{stats['skipped_not_fallback']}")
    print(f"  Dates extracted:       {stats['extracted']}")
    print(f"  Extraction failed:     {stats['failed']}")
    if not args.dry_run:
        print(f"  Updated in DB:         {stats['updated']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
