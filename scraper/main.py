#!/usr/bin/env python3
"""Main entry point for the EV Platform scraper."""

import argparse
import hashlib
import hmac
import json
import os
import sys
from datetime import datetime
from typing import Any

import requests

from config import WEBHOOK_URL, WEBHOOK_SECRET, SOURCES
from sources import NIOSource, XPengSource, LiAutoSource, BYDSource, WeiboSource
from processors import AIService, process_article


# Map source names to classes
SOURCE_CLASSES = {
    "nio": NIOSource,
    "xpeng": XPengSource,
    "li_auto": LiAutoSource,
    "byd": BYDSource,
    "weibo": WeiboSource,
}


def format_duration(seconds: float) -> str:
    """Format seconds into a human-readable duration string."""
    if seconds < 60:
        return f"{seconds:.1f}s"
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    if minutes < 60:
        return f"{minutes}m {secs}s"
    hours = int(minutes // 60)
    mins = minutes % 60
    return f"{hours}h {mins}m {secs}s"


def create_stats() -> dict[str, Any]:
    """Create a new stats dictionary for tracking scraper metrics."""
    return {
        "start_time": datetime.now(),
        "end_time": None,
        "sources": {},  # Per-source stats: {source_name: {fetched, processed, errors, error_msg}}
        "total_fetched": 0,
        "total_processed": 0,
        "filtered_low_relevance": 0,
        "final_to_webhook": 0,
        "webhook": {
            "status": None,
            "status_code": None,
            "created": 0,
            "duplicates": 0,
            "error": None,
        },
        "x_publish": {
            "status": None,
            "posts_published": 0,
            "error": None,
        },
    }


def print_summary(stats: dict[str, Any], dry_run: bool = False) -> None:
    """Print a formatted summary of the scraper run."""
    stats["end_time"] = datetime.now()
    duration = (stats["end_time"] - stats["start_time"]).total_seconds()

    print("\n")
    print("=" * 44)
    print("          SCRAPE SUMMARY")
    print("=" * 44)
    print(f"Started:    {stats['start_time'].strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Finished:   {stats['end_time'].strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Duration:   {format_duration(duration)}")
    print()

    # Sources section
    print("Sources:")
    for source_name, source_stats in stats["sources"].items():
        fetched = source_stats.get("fetched", 0)
        processed = source_stats.get("processed", 0)
        errors = source_stats.get("errors", 0)
        error_msg = source_stats.get("error_msg")

        # Format source name with padding
        name_display = f"  {source_name.upper()}:".ljust(14)

        if error_msg:
            print(f"{name_display}{fetched} fetched ({error_msg})")
        elif errors > 0:
            print(f"{name_display}{fetched} fetched, {processed} processed, {errors} error(s)")
        else:
            print(f"{name_display}{fetched} fetched, {processed} processed, 0 errors")
    print()

    # Processing section
    print("Processing:")
    print(f"  Total fetched:          {stats['total_fetched']} articles")
    print(f"  AI processed:           {stats['total_processed']} articles")
    print(f"  Filtered (low score):   {stats['filtered_low_relevance']} articles")
    print(f"  Final to webhook:       {stats['final_to_webhook']} articles")
    print()

    # Webhook section
    if dry_run:
        print("Webhook:")
        print("  Status: DRY RUN (skipped)")
    else:
        webhook = stats["webhook"]
        print("Webhook:")
        if webhook["status"] == "SUCCESS":
            print(f"  Status: SUCCESS ({webhook['status_code']})")
            print(f"  Created: {webhook['created']} new, {webhook['duplicates']} duplicates")
        elif webhook["status"] == "SKIPPED":
            print("  Status: SKIPPED (no articles to submit)")
        elif webhook["status"] == "ERROR":
            print(f"  Status: ERROR ({webhook['status_code']})")
            if webhook["error"]:
                print(f"  Error: {webhook['error']}")
        else:
            print(f"  Status: {webhook['status'] or 'NOT RUN'}")
    print()

    # X/Twitter section
    if dry_run:
        print("X/Twitter:")
        print("  Status: DRY RUN (skipped)")
    else:
        x_pub = stats["x_publish"]
        print("X/Twitter:")
        if x_pub["status"] == "SUCCESS":
            print(f"  Status: SUCCESS - Published {x_pub['posts_published']} posts")
        elif x_pub["status"] == "SKIPPED":
            print("  Status: SKIPPED (webhook failed)")
        elif x_pub["status"] == "ERROR":
            print(f"  Status: ERROR")
            if x_pub["error"]:
                print(f"  Error: {x_pub['error']}")
        else:
            print(f"  Status: {x_pub['status'] or 'NOT RUN'}")

    print("=" * 44)


def get_enabled_sources() -> list[str]:
    """Get list of enabled source names."""
    return [name for name, config in SOURCES.items() if config.get("enabled", False)]


def scrape_source(source_name: str, limit: int = 10, stats: dict = None) -> list[dict]:
    """Scrape articles from a single source.

    Returns:
        List of article dicts ready for webhook submission.
    """
    # Initialize source stats
    if stats is not None:
        stats["sources"][source_name] = {
            "fetched": 0,
            "processed": 0,
            "errors": 0,
            "error_msg": None,
        }

    if source_name not in SOURCE_CLASSES:
        print(f"Unknown source: {source_name}")
        if stats is not None:
            stats["sources"][source_name]["error_msg"] = "unknown source"
            stats["sources"][source_name]["errors"] = 1
        return []

    source_class = SOURCE_CLASSES[source_name]
    source = source_class()

    print(f"\n{'='*50}")
    print(f"Scraping {source.name}...")
    print(f"{'='*50}")

    try:
        articles = source.fetch_articles(limit=limit)
        print(f"Found {len(articles)} articles")
        if stats is not None:
            stats["sources"][source_name]["fetched"] = len(articles)
            stats["total_fetched"] += len(articles)
        return articles
    except requests.exceptions.Timeout:
        print(f"Timeout scraping {source_name}")
        if stats is not None:
            stats["sources"][source_name]["error_msg"] = "timeout"
            stats["sources"][source_name]["errors"] = 1
        return []
    except Exception as e:
        print(f"Error scraping {source_name}: {e}")
        if stats is not None:
            stats["sources"][source_name]["error_msg"] = str(e)[:50]
            stats["sources"][source_name]["errors"] = 1
        return []


def process_articles(
    articles: list,
    ai_service: AIService,
    source_name: str = None,
    stats: dict = None,
) -> list[dict]:
    """Process articles through AI and return ready-to-submit dicts."""
    processed = []
    errors = 0

    for article in articles:
        try:
            result = process_article(article, ai_service)
            if result:
                processed.append(result.to_dict())
        except Exception as e:
            print(f"Error processing article: {e}")
            errors += 1
            continue

    # Update stats
    if stats is not None:
        stats["total_processed"] += len(processed)
        if source_name and source_name in stats["sources"]:
            stats["sources"][source_name]["processed"] = len(processed)
            stats["sources"][source_name]["errors"] += errors

    return processed


def submit_to_webhook(articles: list[dict], batch_id: str = None, stats: dict = None) -> bool:
    """Submit articles to the webhook endpoint.

    Returns:
        True if successful, False otherwise.
    """
    if not articles:
        print("No articles to submit")
        if stats is not None:
            stats["webhook"]["status"] = "SKIPPED"
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

            # Parse webhook response for stats
            if stats is not None:
                stats["webhook"]["status"] = "SUCCESS"
                stats["webhook"]["status_code"] = response.status_code
                # Try to extract created/duplicates from response
                if isinstance(result, dict):
                    stats["webhook"]["created"] = result.get("created", result.get("inserted", 0))
                    stats["webhook"]["duplicates"] = result.get("duplicates", result.get("skipped", 0))

            return True
        else:
            print(f"Webhook error: {response.status_code} - {response.text}")
            if stats is not None:
                stats["webhook"]["status"] = "ERROR"
                stats["webhook"]["status_code"] = response.status_code
                stats["webhook"]["error"] = response.text[:100]
            return False

    except Exception as e:
        print(f"Failed to submit to webhook: {e}")
        if stats is not None:
            stats["webhook"]["status"] = "ERROR"
            stats["webhook"]["error"] = str(e)[:100]
        return False


def trigger_x_publish(stats: dict = None) -> bool:
    """Trigger X/Twitter auto-publish via the cron endpoint.

    Returns:
        True if successful, False otherwise.
    """
    publish_url = WEBHOOK_URL.replace("/api/webhook", "/api/cron/publish")
    cron_secret = os.getenv("CRON_SECRET", "")

    print(f"\nTriggering X publish at {publish_url}...")

    try:
        headers = {}
        if cron_secret:
            headers["Authorization"] = f"Bearer {cron_secret}"

        response = requests.post(
            publish_url,
            headers=headers,
            timeout=120,  # Publishing can take time
        )

        if response.ok:
            result = response.json()
            print(f"X publish response: {result}")

            # Parse response for stats
            if stats is not None:
                stats["x_publish"]["status"] = "SUCCESS"
                if isinstance(result, dict):
                    # Try to extract published count from response
                    stats["x_publish"]["posts_published"] = result.get(
                        "published", result.get("count", result.get("postsPublished", 0))
                    )

            return True
        else:
            print(f"X publish error: {response.status_code} - {response.text}")
            if stats is not None:
                stats["x_publish"]["status"] = "ERROR"
                stats["x_publish"]["error"] = f"{response.status_code}: {response.text[:50]}"
            return False

    except Exception as e:
        print(f"Failed to trigger X publish: {e}")
        if stats is not None:
            stats["x_publish"]["status"] = "ERROR"
            stats["x_publish"]["error"] = str(e)[:100]
        return False


def run_scraper(
    sources: list[str] = None,
    limit: int = 10,
    skip_ai: bool = False,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Run the scraper for specified sources.

    Args:
        sources: List of source names to scrape. If None, scrape all enabled.
        limit: Max articles per source.
        skip_ai: Skip AI processing (for testing).
        dry_run: Don't submit to webhook (for testing).

    Returns:
        Stats dictionary with metrics from the run.
    """
    # Initialize stats tracking
    stats = create_stats()

    print(f"\n{'#'*60}")
    print(f"# EV Platform Scraper")
    print(f"# Started: {stats['start_time'].isoformat()}")
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
        articles = scrape_source(source_name, limit=limit, stats=stats)

        if skip_ai:
            # Convert to dicts without AI processing
            processed_count = 0
            for article in articles:
                article.relevance_score = 50  # Default score
                article.translated_title = article.original_title
                article.translated_content = article.original_content  # Avoid null in webhook
                article.translated_summary = article.original_title or "EV News"
                all_articles.append(article.to_dict())
                processed_count += 1

            # Update stats for non-AI processing
            stats["total_processed"] += processed_count
            if source_name in stats["sources"]:
                stats["sources"][source_name]["processed"] = processed_count
        else:
            # Process through AI
            processed = process_articles(articles, ai_service, source_name, stats)
            all_articles.extend(processed)

    # Track final articles to webhook
    stats["final_to_webhook"] = len(all_articles)

    print(f"\n{'='*50}")
    print(f"Total processed: {len(all_articles)} articles")
    print(f"{'='*50}")

    # Submit to webhook
    if dry_run:
        print("\n[DRY RUN] Would submit the following articles:")
        for article in all_articles:
            print(f"  - {article.get('translatedTitle', article.get('originalTitle', 'Untitled'))}")
            print(f"    Score: {article.get('relevanceScore', 0)}, Categories: {article.get('categories', [])}")

        # Print summary
        print_summary(stats, dry_run=True)
    else:
        batch_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        success = submit_to_webhook(all_articles, batch_id, stats)
        if success:
            print("\nScraper run completed successfully!")
            # Trigger X publishing after successful scrape (unless disabled)
            if os.getenv("SKIP_X_PUBLISH", "").lower() == "true":
                print("\n[SKIP_X_PUBLISH=true] Skipping X/Twitter auto-publish")
                stats["x_publish"]["status"] = "SKIPPED (disabled)"
            else:
                print("\n" + "="*50)
                print("Triggering X/Twitter auto-publish...")
                print("="*50)
                trigger_x_publish(stats)
        else:
            print("\nScraper run completed with errors")
            stats["x_publish"]["status"] = "SKIPPED"

        # Print summary
        print_summary(stats, dry_run=False)

    return stats


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

    stats = run_scraper(
        sources=args.sources,
        limit=args.limit,
        skip_ai=args.skip_ai,
        dry_run=args.dry_run,
    )

    # Exit with error code if webhook failed (only for CLI usage)
    if not args.dry_run and stats.get("webhook", {}).get("status") == "ERROR":
        sys.exit(1)


if __name__ == "__main__":
    main()
