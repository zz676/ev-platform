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

from config import WEBHOOK_URL, WEBHOOK_SECRET, SOURCES, API_BASE_URL
from sources import NIOSource, XPengSource, LiAutoSource, BYDSource, WeiboSource, CnEVDataSource
from processors import AIService, process_article
from extractors.classifier import ArticleClassifier
from extractors.industry_extractor import IndustryDataExtractor
from api_client import EVPlatformAPI


# Map source names to classes
SOURCE_CLASSES = {
    "nio": NIOSource,
    "xpeng": XPengSource,
    "li_auto": LiAutoSource,
    "byd": BYDSource,
    "weibo": WeiboSource,
    "cnevdata": CnEVDataSource,
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
            "updated": 0,
            "duplicates": 0,
            "errors": 0,
            "error_details": [],
            "error": None,
        },
        "x_publish": {
            "status": None,
            "posts_published": 0,
            "error": None,
        },
        "industry_data": {
            "status": None,
            "classified": 0,
            "extracted": 0,
            "submitted": 0,
            "errors": 0,
            "by_table": {},  # {table_name: count}
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
            print(f"  Created: {webhook['created']} new, {webhook['updated']} updated, {webhook['duplicates']} unchanged")
            if webhook["errors"] > 0:
                print(f"  Errors: {webhook['errors']}")
                for err in webhook["error_details"][:5]:
                    print(f"    - {err}")
                if webhook["errors"] > 5:
                    print(f"    ... and {webhook['errors'] - 5} more")
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
    print()

    # Industry Data section
    industry = stats.get("industry_data", {})
    print("Industry Data:")
    if dry_run:
        print("  Status: DRY RUN")
    elif industry.get("status"):
        print(f"  Status: {industry['status']}")
        print(f"  Classified: {industry.get('classified', 0)} articles")
        print(f"  Extracted: {industry.get('extracted', 0)} articles")
        print(f"  Submitted: {industry.get('submitted', 0)} records")
        if industry.get('errors', 0) > 0:
            print(f"  Errors: {industry['errors']}")
        by_table = industry.get("by_table", {})
        if by_table:
            print(f"  By Table: {by_table}")
    else:
        print("  Status: NOT RUN")

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


def _get_article_field(article, field_name: str, default=None):
    """Get a field from an article, handling different article types.

    Supports both standard Article and CnEVDataArticle objects.
    """
    # Field mapping for different article types
    field_mappings = {
        "original_title": ["original_title", "title"],
        "translated_summary": ["translated_summary", "summary"],
        "original_content": ["original_content", "summary"],
        "source_url": ["source_url", "url"],
        "original_media_urls": ["original_media_urls", "preview_image"],
        "published_at": ["published_at", "source_date"],
    }

    # Get the list of possible field names
    possible_fields = field_mappings.get(field_name, [field_name])

    for fname in possible_fields:
        if hasattr(article, fname):
            val = getattr(article, fname)
            if val is not None:
                # Special handling for original_media_urls -> preview_image
                if field_name == "original_media_urls" and fname == "preview_image":
                    # preview_image is a single string, wrap in list
                    return [val] if val else []
                return val

    return default


def process_industry_data(
    articles: list,
    api_client: EVPlatformAPI,
    stats: dict = None,
    dry_run: bool = False,
) -> None:
    """Process articles for new industry tables (dual-write).

    This runs AFTER regular webhook submission. It classifies articles
    and routes data to specialized industry tables.

    Args:
        articles: List of Article or CnEVDataArticle objects
        api_client: EVPlatformAPI client instance
        stats: Stats dictionary for tracking
        dry_run: If True, don't actually submit data
    """
    classifier = ArticleClassifier()
    extractor = IndustryDataExtractor()

    classified_count = 0
    extracted_count = 0
    submitted_count = 0
    errors_count = 0
    by_table: dict[str, int] = {}

    print(f"\n{'='*50}")
    print("Processing Industry Data")
    print(f"{'='*50}")

    for article in articles:
        try:
            # Get article fields using helper function
            title = _get_article_field(article, "original_title", "")
            summary = _get_article_field(article, "translated_summary", "")
            if not summary:
                summary = _get_article_field(article, "original_content", "")

            if not title:
                continue

            # Classify the article
            classification = classifier.classify(title, summary)

            # Skip if not targeting an industry table
            if not classification.target_table:
                continue
            if not EVPlatformAPI.is_industry_table(classification.target_table):
                continue

            classified_count += 1

            # Get source URL and image
            source_url = _get_article_field(article, "source_url", "")
            media_urls = _get_article_field(article, "original_media_urls", [])
            image_url = media_urls[0] if media_urls else None
            published_at = _get_article_field(article, "published_at")

            # Extract structured data
            result = extractor.extract(
                title=title,
                summary=summary,
                classification=classification,
                source_url=source_url,
                source_title=title,
                image_url=image_url,
                published_date=published_at,
            )

            if not result or not result.success:
                if result and result.error:
                    print(f"  Extraction failed for '{title[:50]}...': {result.error}")
                continue

            extracted_count += 1

            # Check if OCR is needed (for rankings tables)
            if result.data.get("_needs_ocr"):
                # TODO: Integrate OCR processing for rankings tables
                # For now, log and skip
                print(f"  Skipping OCR-required article: {title[:50]}...")
                continue

            # Submit to API
            if dry_run:
                print(f"  [DRY RUN] Would submit to {classification.target_table}:")
                print(f"    Data: {result.data}")
            else:
                response = api_client.submit(classification.target_table, result.data)
                if response.success:
                    submitted_count += 1
                    by_table[classification.target_table] = by_table.get(classification.target_table, 0) + 1
                    print(f"  Submitted to {classification.target_table}: {title[:50]}...")
                else:
                    errors_count += 1
                    print(f"  Failed to submit to {classification.target_table}: {response.error}")

        except Exception as e:
            errors_count += 1
            print(f"  Error processing article: {e}")
            continue

    # Update stats
    if stats is not None:
        stats["industry_data"]["classified"] = classified_count
        stats["industry_data"]["extracted"] = extracted_count
        stats["industry_data"]["submitted"] = submitted_count
        stats["industry_data"]["errors"] = errors_count
        stats["industry_data"]["by_table"] = by_table
        stats["industry_data"]["status"] = "SUCCESS" if errors_count == 0 else "PARTIAL"

    print(f"\nIndustry Data Summary:")
    print(f"  Classified:  {classified_count} articles")
    print(f"  Extracted:   {extracted_count} articles")
    print(f"  Submitted:   {submitted_count} records")
    print(f"  Errors:      {errors_count}")
    if by_table:
        print(f"  By Table:")
        for table, count in sorted(by_table.items()):
            print(f"    {table}: {count}")


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
                # Extract stats from webhook response (nested under "results" key)
                if isinstance(result, dict):
                    results = result.get("results", result)
                    stats["webhook"]["created"] = results.get("created", results.get("inserted", 0))
                    stats["webhook"]["updated"] = results.get("updated", 0)
                    stats["webhook"]["duplicates"] = results.get("duplicates", results.get("skipped", 0))
                    errors = results.get("errors", [])
                    stats["webhook"]["errors"] = len(errors) if isinstance(errors, list) else 0
                    stats["webhook"]["error_details"] = errors if isinstance(errors, list) else []

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

    # Initialize API client for industry data
    api_client = EVPlatformAPI(API_BASE_URL)

    # Scrape each source
    all_articles = []  # List of dicts for webhook
    raw_articles = []  # List of Article objects for industry data processing
    for source_name in sources_to_scrape:
        articles = scrape_source(source_name, limit=limit, stats=stats)
        raw_articles.extend(articles)  # Keep raw articles for industry data

        if skip_ai:
            # Convert to dicts without AI processing
            processed_count = 0
            for article in articles:
                # Handle different article types (Article vs CnEVDataArticle)
                if hasattr(article, 'relevance_score'):
                    article.relevance_score = 50
                if hasattr(article, 'translated_title'):
                    title = _get_article_field(article, "original_title", "EV News")
                    article.translated_title = title
                if hasattr(article, 'translated_content'):
                    content = _get_article_field(article, "original_content", "")
                    article.translated_content = content
                if hasattr(article, 'translated_summary'):
                    title = _get_article_field(article, "original_title", "EV News")
                    article.translated_summary = title

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

        # Process industry data (dry run)
        process_industry_data(raw_articles, api_client, stats, dry_run=True)

        # Print summary
        print_summary(stats, dry_run=True)
    else:
        batch_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        success = submit_to_webhook(all_articles, batch_id, stats)

        # Process industry data (dual-write to specialized tables)
        # This runs regardless of webhook success - industry data is independent
        process_industry_data(raw_articles, api_client, stats, dry_run=False)

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
