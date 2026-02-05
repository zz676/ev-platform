#!/usr/bin/env python3
"""Backfill historical data from CnEVData.

This script scrapes historical articles from cnevdata.com and extracts
EV sales/delivery metrics. It supports:
- Batch processing with configurable delays
- Checkpoint resume from interruptions
- Dry-run mode for testing
- Progress logging

Usage:
    # Test with first 2 pages
    python backfill_cnevdata.py --pages 1-2 --dry-run

    # Backfill pages 1-5
    python backfill_cnevdata.py --pages 1-5

    # Backfill with custom batch size
    python backfill_cnevdata.py --pages 1-20 --batch-size 5

    # Resume from last checkpoint
    python backfill_cnevdata.py --resume
"""

import argparse
import hashlib
import json
import os
import random
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Optional

import httpx
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sources.cnevdata import CnEVDataSource, CnEVDataArticle
from extractors import TitleParser, SummaryParser, ArticleClassifier, ImageOCR
from extractors.industry_extractor import IndustryDataExtractor
from api_client import EVPlatformAPI
from config import BACKFILL_CONFIG, WEBHOOK_URL, WEBHOOK_SECRET, API_BASE_URL

load_dotenv()

# Checkpoint file
CHECKPOINT_FILE = os.path.join(os.path.dirname(__file__), ".cnevdata_checkpoint.json")


class BackfillStats:
    """Track backfill statistics."""

    def __init__(self):
        self.start_time = datetime.now()
        self.pages_processed = 0
        self.articles_found = 0
        self.articles_processed = 0
        self.metrics_extracted = 0
        self.metrics_submitted = 0
        self.metrics_failed = 0
        self.ocr_needed = 0
        self.ocr_processed = 0
        self.errors = []
        # Industry data stats
        self.industry_classified = 0
        self.industry_extracted = 0
        self.industry_submitted = 0
        self.industry_failed = 0
        self.industry_by_table = {}

    def to_dict(self) -> dict:
        return {
            "start_time": self.start_time.isoformat(),
            "pages_processed": self.pages_processed,
            "articles_found": self.articles_found,
            "articles_processed": self.articles_processed,
            "metrics_extracted": self.metrics_extracted,
            "metrics_submitted": self.metrics_submitted,
            "metrics_failed": self.metrics_failed,
            "ocr_needed": self.ocr_needed,
            "ocr_processed": self.ocr_processed,
            "industry_classified": self.industry_classified,
            "industry_extracted": self.industry_extracted,
            "industry_submitted": self.industry_submitted,
            "industry_failed": self.industry_failed,
            "industry_by_table": self.industry_by_table,
            "errors": self.errors[:10],  # Keep last 10 errors
        }

    def print_summary(self):
        duration = (datetime.now() - self.start_time).total_seconds()
        print("\n" + "=" * 50)
        print("BACKFILL SUMMARY")
        print("=" * 50)
        print(f"Duration: {duration:.1f}s")
        print(f"Pages processed: {self.pages_processed}")
        print(f"Articles found: {self.articles_found}")
        print(f"Articles processed: {self.articles_processed}")
        print(f"Metrics extracted: {self.metrics_extracted}")
        print(f"Metrics submitted: {self.metrics_submitted}")
        print(f"Metrics failed: {self.metrics_failed}")
        print(f"OCR needed: {self.ocr_needed}")
        print(f"OCR processed: {self.ocr_processed}")
        print(f"Errors: {len(self.errors)}")
        # Industry data summary
        print("\n--- Industry Data ---")
        print(f"Classified: {self.industry_classified}")
        print(f"Extracted: {self.industry_extracted}")
        print(f"Submitted: {self.industry_submitted}")
        print(f"Failed: {self.industry_failed}")
        if self.industry_by_table:
            print("By table:")
            for table, count in sorted(self.industry_by_table.items()):
                print(f"  {table}: {count}")
        if self.errors:
            print("\nRecent errors:")
            for err in self.errors[-5:]:
                print(f"  - {err}")
        print("=" * 50)


def load_checkpoint() -> Optional[dict]:
    """Load checkpoint from file."""
    if os.path.exists(CHECKPOINT_FILE):
        try:
            with open(CHECKPOINT_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Could not load checkpoint: {e}")
    return None


def save_checkpoint(last_page: int, processed_urls: list[str]):
    """Save checkpoint to file."""
    checkpoint = {
        "last_page": last_page,
        "processed_urls": processed_urls[-1000:],  # Keep last 1000
        "saved_at": datetime.now().isoformat(),
    }
    try:
        with open(CHECKPOINT_FILE, "w") as f:
            json.dump(checkpoint, f, indent=2)
    except Exception as e:
        print(f"Warning: Could not save checkpoint: {e}")


def submit_metrics_to_api(metrics: list[dict], dry_run: bool = False, stats: BackfillStats = None) -> tuple[int, int]:
    """Submit extracted metrics to the API.

    Args:
        metrics: List of metric dictionaries
        dry_run: If True, don't actually submit
        stats: Optional stats tracker to update

    Returns:
        Tuple of (success_count, fail_count)
    """
    if dry_run:
        print(f"  [DRY RUN] Would submit {len(metrics)} metrics")
        return (len(metrics), 0)

    api_url = os.getenv("API_URL", "http://localhost:3000") + "/api/ev-metrics"
    print(f"  Submitting {len(metrics)} metrics to: {api_url}")

    # Warn if using localhost (indicates missing API_URL secret)
    if "localhost" in api_url:
        print("  ⚠️  WARNING: Using localhost - API_URL secret may not be set!")

    success_count = 0
    fail_count = 0

    for metric in metrics:
        try:
            response = httpx.post(api_url, json=metric, timeout=30)
            if response.is_success:
                success_count += 1
            else:
                fail_count += 1
                brand = metric.get('brand', 'unknown')
                # Parse and log the error response
                try:
                    error_body = response.json()
                    error_msg = error_body.get('error', response.text[:100])
                except Exception:
                    error_msg = response.text[:100] if response.text else "No response body"
                print(f"    Failed: {response.status_code} - {brand}: {error_msg}")

                # Log first failed payload for debugging
                if fail_count == 1:
                    print(f"    First failed payload: {json.dumps(metric, indent=2, default=str)}")
        except Exception as e:
            fail_count += 1
            print(f"    Error: {str(e)[:50]}")

    print(f"  Submitted: {success_count} success, {fail_count} failed")

    # Update stats if provided
    if stats:
        stats.metrics_submitted += success_count
        stats.metrics_failed += fail_count

    return (success_count, fail_count)


def process_industry_data(
    article: CnEVDataArticle,
    classifier: ArticleClassifier,
    extractor: IndustryDataExtractor,
    api_client: EVPlatformAPI,
    stats: BackfillStats,
    dry_run: bool = False,
) -> bool:
    """Process an article for industry data tables.

    Args:
        article: CnEVDataArticle to process
        classifier: ArticleClassifier instance
        extractor: IndustryDataExtractor instance
        api_client: EVPlatformAPI client
        stats: BackfillStats tracker
        dry_run: If True, don't submit to API

    Returns:
        True if data was extracted and submitted, False otherwise
    """
    title = article.title or ""
    summary = article.summary or ""

    # Classify the article
    classification = classifier.classify(title, summary)

    # Skip if not targeting an industry table
    if not classification.target_table:
        return False
    if not EVPlatformAPI.is_industry_table(classification.target_table):
        return False

    stats.industry_classified += 1

    # Extract structured data
    result = extractor.extract(
        title=title,
        summary=summary,
        classification=classification,
        source_url=article.url,
        source_title=title,
        image_url=article.preview_image,
        published_date=article.published_at,
    )

    if not result or not result.success:
        return False

    stats.industry_extracted += 1

    # Skip OCR-required articles (rankings tables)
    if result.data.get("_needs_ocr"):
        return False

    # Submit to API
    if dry_run:
        print(f"    [DRY RUN] Would submit to {classification.target_table}")
        return True

    response = api_client.submit(classification.target_table, result.data)
    if response.success:
        stats.industry_submitted += 1
        stats.industry_by_table[classification.target_table] = (
            stats.industry_by_table.get(classification.target_table, 0) + 1
        )
        print(f"    -> Submitted to {classification.target_table}")
        return True
    else:
        stats.industry_failed += 1
        print(f"    -> Failed to submit to {classification.target_table}: {response.error}")
        return False


def process_ocr_batch(ocr, articles: list, stats: BackfillStats, dry_run: bool = False) -> dict:
    """Process multiple OCR calls in parallel.

    Args:
        ocr: ImageOCR instance
        articles: List of CnEVDataArticle objects needing OCR
        stats: BackfillStats tracker
        dry_run: If True, don't submit results to API

    Returns:
        Dict mapping article URL to OCR results
    """
    if not articles:
        return {}

    ocr_concurrency = BACKFILL_CONFIG.get("ocr_concurrency", 5)
    results = {}

    print(f"\n  Processing OCR batch of {len(articles)} articles (concurrency: {ocr_concurrency})...")

    with ThreadPoolExecutor(max_workers=ocr_concurrency) as executor:
        futures = {}
        for article in articles:
            # Determine OCR type based on article type
            ocr_type = "rankings" if article.article_type == "RANKINGS_TABLE" else "metrics"
            future = executor.submit(
                ocr.extract_from_url_sync,
                article.preview_image,
                ocr_type
            )
            futures[future] = article

        for future in as_completed(futures):
            article = futures[future]
            try:
                result = future.result()
                if result.success and result.data:
                    stats.ocr_processed += 1
                    results[article.url] = result.data
                    print(f"    OCR extracted {len(result.data)} rows from {article.title[:40]}...")
                else:
                    print(f"    OCR returned no data for {article.title[:40]}...")
            except Exception as e:
                stats.errors.append(f"OCR error for {article.url}: {str(e)[:50]}")
                print(f"    OCR error for {article.title[:40]}: {str(e)[:50]}")

    return results


def backfill_pages(
    start_page: int,
    end_page: int,
    batch_size: int = 5,
    dry_run: bool = False,
    enable_ocr: bool = False,
    stats: BackfillStats = None,
) -> list[str]:
    """Backfill articles from specified page range.

    Args:
        start_page: Starting page number (1-indexed)
        end_page: Ending page number (inclusive)
        batch_size: Pages per batch
        dry_run: If True, don't submit to API
        enable_ocr: If True, process images with OCR
        stats: Stats tracker

    Returns:
        List of processed URLs
    """
    if stats is None:
        stats = BackfillStats()

    source = CnEVDataSource()
    processed_urls = []

    # Initialize industry data components
    classifier = ArticleClassifier()
    industry_extractor = IndustryDataExtractor()
    api_client = EVPlatformAPI(API_BASE_URL)
    print(f"Industry data API initialized: {API_BASE_URL}")

    # Initialize OCR if enabled
    ocr = None
    if enable_ocr:
        try:
            ocr = ImageOCR()
            print("OCR service initialized")
        except Exception as e:
            print(f"Warning: Could not initialize OCR: {e}")
            enable_ocr = False

    try:
        current_batch = []
        batch_num = 0
        ocr_queue = []  # Queue for batch OCR processing

        for page in range(start_page, end_page + 1):
            print(f"\n--- Page {page}/{end_page} ---")

            try:
                articles = source.fetch_article_list(page)
                stats.articles_found += len(articles)
                stats.pages_processed += 1

                for article in articles:
                    # Skip if already processed
                    if article.url in processed_urls:
                        continue

                    print(f"\n  Processing: {article.title[:60]}...")

                    # Extract metrics from title
                    metrics = source.extract_metrics(article)

                    if metrics:
                        stats.metrics_extracted += len(metrics)
                        print(f"    Extracted {len(metrics)} metrics from title")

                        # Submit to API
                        submit_metrics_to_api(metrics, dry_run, stats)

                    # Also try to extract industry data (dual-write)
                    industry_extracted = process_industry_data(
                        article=article,
                        classifier=classifier,
                        extractor=industry_extractor,
                        api_client=api_client,
                        stats=stats,
                        dry_run=dry_run,
                    )

                    # If no metrics or industry data, check if OCR is needed
                    if not metrics and not industry_extracted:
                        if article.needs_ocr and enable_ocr and ocr and article.preview_image:
                            # Queue for batch OCR processing
                            stats.ocr_needed += 1
                            ocr_queue.append(article)
                            print(f"    Queued for OCR batch processing")
                        else:
                            print(f"    No data extracted (needs_ocr={article.needs_ocr})")

                    processed_urls.append(article.url)
                    stats.articles_processed += 1

                    # Delay between articles
                    delay = random.uniform(*BACKFILL_CONFIG["article_delay"])
                    time.sleep(delay)

                # Process OCR batch after each page if queue has items
                if ocr_queue:
                    process_ocr_batch(ocr, ocr_queue, stats, dry_run)
                    ocr_queue = []

            except Exception as e:
                print(f"  Error on page {page}: {e}")
                stats.errors.append(f"Page {page}: {str(e)[:50]}")

            current_batch.append(page)

            # Check if batch is complete
            if len(current_batch) >= batch_size:
                batch_num += 1
                print(f"\n=== Batch {batch_num} complete (pages {current_batch[0]}-{current_batch[-1]}) ===")

                # Save checkpoint
                save_checkpoint(page, processed_urls)

                # Delay between batches
                if page < end_page:
                    batch_delay = BACKFILL_CONFIG["batch_delay"]
                    print(f"Waiting {batch_delay}s before next batch...")
                    time.sleep(batch_delay)

                current_batch = []

            else:
                # Delay between pages
                delay = random.uniform(*BACKFILL_CONFIG["page_delay"])
                time.sleep(delay)

    finally:
        source.close()
        save_checkpoint(end_page, processed_urls)

    return processed_urls


def main():
    parser = argparse.ArgumentParser(
        description="Backfill historical EV data from CnEVData",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--pages",
        type=str,
        default="1-5",
        help="Page range to scrape (e.g., '1-10', '5-20'). Default: 1-5",
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=BACKFILL_CONFIG["batch_size"],
        help=f"Pages per batch. Default: {BACKFILL_CONFIG['batch_size']}",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Don't submit to API (for testing)",
    )

    parser.add_argument(
        "--enable-ocr",
        action="store_true",
        help="Enable OCR for image tables (requires OpenAI API key)",
    )

    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from last checkpoint",
    )

    args = parser.parse_args()

    # Parse page range
    if args.resume:
        checkpoint = load_checkpoint()
        if checkpoint:
            start_page = checkpoint["last_page"] + 1
            end_page = BACKFILL_CONFIG["total_pages"]
            print(f"Resuming from page {start_page}")
        else:
            print("No checkpoint found, starting from page 1")
            start_page = 1
            end_page = BACKFILL_CONFIG["total_pages"]
    else:
        try:
            parts = args.pages.split("-")
            start_page = int(parts[0])
            end_page = int(parts[1]) if len(parts) > 1 else start_page
        except ValueError:
            print(f"Invalid page range: {args.pages}")
            sys.exit(1)

    print(f"\n{'#'*50}")
    print(f"# CnEVData Backfill")
    print(f"# Pages: {start_page} to {end_page}")
    print(f"# Batch size: {args.batch_size}")
    print(f"# Dry run: {args.dry_run}")
    print(f"# OCR enabled: {args.enable_ocr}")
    print(f"{'#'*50}\n")

    stats = BackfillStats()

    try:
        processed = backfill_pages(
            start_page=start_page,
            end_page=end_page,
            batch_size=args.batch_size,
            dry_run=args.dry_run,
            enable_ocr=args.enable_ocr,
            stats=stats,
        )

        print(f"\nProcessed {len(processed)} articles")

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")

    finally:
        stats.print_summary()


if __name__ == "__main__":
    main()
