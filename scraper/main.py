#!/usr/bin/env python3
"""Main entry point for the EV Platform scraper."""

import argparse
import hashlib
import hmac
import json
import sys
from datetime import datetime

import requests

from config import WEBHOOK_URL, WEBHOOK_SECRET, SOURCES
from sources import NIOSource, XPengSource, LiAutoSource, BYDSource
from processors import AIService, process_article


# Map source names to classes
SOURCE_CLASSES = {
    "nio": NIOSource,
    "xpeng": XPengSource,
    "li_auto": LiAutoSource,
    "byd": BYDSource,
}


def get_enabled_sources() -> list[str]:
    """Get list of enabled source names."""
    return [name for name, config in SOURCES.items() if config.get("enabled", False)]


def scrape_source(source_name: str, limit: int = 10) -> list[dict]:
    """Scrape articles from a single source.

    Returns:
        List of article dicts ready for webhook submission.
    """
    if source_name not in SOURCE_CLASSES:
        print(f"Unknown source: {source_name}")
        return []

    source_class = SOURCE_CLASSES[source_name]
    source = source_class()

    print(f"\n{'='*50}")
    print(f"Scraping {source.name}...")
    print(f"{'='*50}")

    try:
        articles = source.fetch_articles(limit=limit)
        print(f"Found {len(articles)} articles")
        return articles
    except Exception as e:
        print(f"Error scraping {source_name}: {e}")
        return []


def process_articles(articles: list, ai_service: AIService) -> list[dict]:
    """Process articles through AI and return ready-to-submit dicts."""
    processed = []

    for article in articles:
        try:
            result = process_article(article, ai_service)
            if result:
                processed.append(result.to_dict())
        except Exception as e:
            print(f"Error processing article: {e}")
            continue

    return processed


def submit_to_webhook(articles: list[dict], batch_id: str = None) -> bool:
    """Submit articles to the webhook endpoint.

    Returns:
        True if successful, False otherwise.
    """
    if not articles:
        print("No articles to submit")
        return True

    if not batch_id:
        batch_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    payload = {
        "posts": articles,
        "batchId": batch_id,
    }

    payload_json = json.dumps(payload)

    # Generate signature
    headers = {"Content-Type": "application/json"}
    if WEBHOOK_SECRET:
        signature = hmac.new(
            WEBHOOK_SECRET.encode(),
            payload_json.encode(),
            hashlib.sha256
        ).hexdigest()
        headers["x-webhook-signature"] = signature

    print(f"\nSubmitting {len(articles)} articles to webhook...")

    try:
        response = requests.post(
            WEBHOOK_URL,
            data=payload_json,
            headers=headers,
            timeout=60,
        )

        if response.ok:
            result = response.json()
            print(f"Webhook response: {result}")
            return True
        else:
            print(f"Webhook error: {response.status_code} - {response.text}")
            return False

    except Exception as e:
        print(f"Failed to submit to webhook: {e}")
        return False


def run_scraper(
    sources: list[str] = None,
    limit: int = 10,
    skip_ai: bool = False,
    dry_run: bool = False,
):
    """Run the scraper for specified sources.

    Args:
        sources: List of source names to scrape. If None, scrape all enabled.
        limit: Max articles per source.
        skip_ai: Skip AI processing (for testing).
        dry_run: Don't submit to webhook (for testing).
    """
    print(f"\n{'#'*60}")
    print(f"# EV Platform Scraper")
    print(f"# Started: {datetime.now().isoformat()}")
    print(f"{'#'*60}")

    # Determine sources to scrape
    if sources:
        sources_to_scrape = sources
    else:
        sources_to_scrape = get_enabled_sources()

    print(f"\nSources: {', '.join(sources_to_scrape)}")
    print(f"Limit per source: {limit}")
    print(f"Skip AI: {skip_ai}")
    print(f"Dry run: {dry_run}")

    # Initialize AI service if needed
    ai_service = None
    if not skip_ai:
        try:
            ai_service = AIService()
            print("AI service initialized")
        except Exception as e:
            print(f"Warning: AI service not available: {e}")
            skip_ai = True

    # Scrape each source
    all_articles = []
    for source_name in sources_to_scrape:
        articles = scrape_source(source_name, limit=limit)

        if skip_ai:
            # Convert to dicts without AI processing
            for article in articles:
                article.relevance_score = 50  # Default score
                article.translated_title = article.original_title
                article.translated_summary = article.original_title or "EV News"
                all_articles.append(article.to_dict())
        else:
            # Process through AI
            processed = process_articles(articles, ai_service)
            all_articles.extend(processed)

    print(f"\n{'='*50}")
    print(f"Total processed: {len(all_articles)} articles")
    print(f"{'='*50}")

    # Submit to webhook
    if dry_run:
        print("\n[DRY RUN] Would submit the following articles:")
        for article in all_articles:
            print(f"  - {article.get('translatedTitle', article.get('originalTitle', 'Untitled'))}")
            print(f"    Score: {article.get('relevanceScore', 0)}, Categories: {article.get('categories', [])}")
    else:
        batch_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        success = submit_to_webhook(all_articles, batch_id)
        if success:
            print("\nScraper run completed successfully!")
        else:
            print("\nScraper run completed with errors")
            sys.exit(1)


def main():
    """Main entry point with CLI argument parsing."""
    parser = argparse.ArgumentParser(
        description="EV Platform News Scraper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py                    # Scrape all enabled sources
  python main.py --sources nio byd  # Scrape specific sources
  python main.py --dry-run          # Test without submitting
  python main.py --skip-ai          # Skip AI processing (testing)
  python main.py --limit 5          # Limit articles per source
        """
    )

    parser.add_argument(
        "--sources",
        nargs="+",
        choices=list(SOURCE_CLASSES.keys()),
        help="Sources to scrape (default: all enabled)",
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Max articles per source (default: 10)",
    )

    parser.add_argument(
        "--skip-ai",
        action="store_true",
        help="Skip AI processing (for testing)",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Don't submit to webhook (for testing)",
    )

    args = parser.parse_args()

    run_scraper(
        sources=args.sources,
        limit=args.limit,
        skip_ai=args.skip_ai,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
