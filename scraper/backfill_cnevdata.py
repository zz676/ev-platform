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
import json
import os
import random
import sys
import threading
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
from config import BACKFILL_CONFIG, API_BASE_URL

load_dotenv()

# Checkpoint file
CHECKPOINT_FILE = os.path.join(os.path.dirname(__file__), ".cnevdata_checkpoint.json")


class BackfillStats:
    """Track backfill statistics (thread-safe)."""

    def __init__(self):
        self._lock = threading.Lock()
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

    def increment(self, field: str, amount: int = 1):
        """Thread-safe increment of a counter field."""
        with self._lock:
            setattr(self, field, getattr(self, field) + amount)

    def increment_table(self, table: str, amount: int = 1):
        """Thread-safe increment of industry_by_table counter."""
        with self._lock:
            self.industry_by_table[table] = self.industry_by_table.get(table, 0) + amount

    def add_error(self, error: str):
        """Thread-safe append to errors list."""
        with self._lock:
            self.errors.append(error)

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
        stats.increment("metrics_submitted", success_count)
        stats.increment("metrics_failed", fail_count)

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

    stats.increment("industry_classified")

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

    stats.increment("industry_extracted")

    # Skip OCR-required articles (rankings tables)
    if result.data.get("_needs_ocr"):
        return False

    # Submit to API
    if dry_run:
        print(f"    [DRY RUN] Would submit to {classification.target_table}")
        return True

    response = api_client.submit(classification.target_table, result.data)
    if response.success:
        stats.increment("industry_submitted")
        stats.increment_table(classification.target_table)
        print(f"    -> Submitted to {classification.target_table}")
        return True
    else:
        stats.increment("industry_failed")
        print(f"    -> Failed to submit to {classification.target_table}: {response.error}")
        return False


def process_ocr_batch(
    ocr,
    articles: list,
    stats: BackfillStats,
    api_client: EVPlatformAPI,
    dry_run: bool = False
) -> dict:
    """Process multiple OCR calls in parallel.

    Args:
        ocr: ImageOCR instance
        articles: List of CnEVDataArticle objects needing OCR
        stats: BackfillStats tracker
        api_client: EVPlatformAPI client for tracking usage
        dry_run: If True, don't submit results to API

    Returns:
        Dict mapping article URL to OCR results
    """
    if not articles:
        return {}

    # Filter out chart/trend diagram articles — OCR is inaccurate for line/bar charts.
    # Only OCR articles with table-like data (rankings tables, specs tables).
    OCR_ELIGIBLE_TYPES = {"rankings", "specs"}
    ocr_articles = [a for a in articles if a.ocr_data_type in OCR_ELIGIBLE_TYPES]
    skipped = len(articles) - len(ocr_articles)
    if skipped > 0:
        print(f"\n  Skipping OCR for {skipped} chart-type articles (inaccurate for charts)")

    if not ocr_articles:
        return {}

    ocr_concurrency = BACKFILL_CONFIG.get("ocr_concurrency", 5)
    results = {}

    print(f"\n  Processing OCR batch of {len(ocr_articles)} articles (concurrency: {ocr_concurrency})...")

    with ThreadPoolExecutor(max_workers=ocr_concurrency) as executor:
        futures = {}
        for article in ocr_articles:
            ocr_type = article.ocr_data_type or "metrics"
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

                # Track OCR usage (even if no data extracted)
                if not dry_run and (result.input_tokens > 0 or result.output_tokens > 0):
                    api_client.track_ocr_usage(
                        input_tokens=result.input_tokens,
                        output_tokens=result.output_tokens,
                        cost=result.cost,
                        success=result.success,
                        error_msg=result.error,
                        source="ocr_backfill",
                        duration_ms=result.duration_ms if result.duration_ms > 0 else None,
                    )
                    duration_str = f", {result.duration_ms}ms" if result.duration_ms > 0 else ""
                    print(f"    OCR usage tracked: {result.input_tokens}+{result.output_tokens} tokens, ${result.cost:.4f}{duration_str}")

                if result.success and result.data:
                    stats.increment("ocr_processed")
                    results[article.url] = result.data
                    print(f"    OCR extracted {len(result.data)} rows from {article.title[:40]}...")
                else:
                    print(f"    OCR returned no data for {article.title[:40]}...")
            except Exception as e:
                stats.add_error(f"OCR error for {article.url}: {str(e)[:50]}")
                print(f"    OCR error for {article.title[:40]}: {str(e)[:50]}")

    return results


def process_single_article(
    article: CnEVDataArticle,
    source: CnEVDataSource,
    classifier: ArticleClassifier,
    industry_extractor: IndustryDataExtractor,
    api_client: EVPlatformAPI,
    stats: BackfillStats,
    dry_run: bool,
    enable_ocr: bool,
) -> Optional[CnEVDataArticle]:
    """Process a single article: extract metrics, submit data, check OCR need.

    Returns the article if it needs OCR (for batch queue), else None.
    """
    try:
        print(f"\n  Processing: {article.title[:60]}...")

        # Extract metrics from title
        metrics = source.extract_metrics(article)

        if metrics:
            stats.increment("metrics_extracted", len(metrics))
            print(f"    Extracted {len(metrics)} metrics from title")

            # Filter out industry-level metrics (they go to dedicated tables now)
            brand_metrics = [m for m in metrics if m.get("brand") != "INDUSTRY"]
            industry_metrics = [m for m in metrics if m.get("brand") == "INDUSTRY"]

            if industry_metrics:
                print(f"    Skipping {len(industry_metrics)} industry metrics (using dedicated tables)")

            # Submit only brand-level metrics to EVMetric API
            if brand_metrics:
                submit_metrics_to_api(brand_metrics, dry_run, stats)

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
        needs_ocr = False
        if not metrics and not industry_extracted:
            if article.needs_ocr and enable_ocr and article.preview_image:
                stats.increment("ocr_needed")
                needs_ocr = True
                print(f"    Queued for OCR batch processing")
            else:
                print(f"    No data extracted (needs_ocr={article.needs_ocr})")

        stats.increment("articles_processed")
        return article if needs_ocr else None

    except Exception as e:
        stats.add_error(f"Article {article.url}: {str(e)[:50]}")
        print(f"    Error processing {article.title[:40]}: {str(e)[:50]}")
        return None


def backfill_pages(
    start_page: int,
    end_page: int,
    batch_size: int = 5,
    dry_run: bool = False,
    enable_ocr: bool = False,
    stats: BackfillStats = None,
    concurrency: int = None,
) -> list[str]:
    """Backfill articles from specified page range.

    Args:
        start_page: Starting page number (1-indexed)
        end_page: Ending page number (inclusive)
        batch_size: Pages per batch
        dry_run: If True, don't submit to API
        enable_ocr: If True, process images with OCR
        stats: Stats tracker
        concurrency: Number of parallel article processing workers

    Returns:
        List of processed URLs
    """
    if stats is None:
        stats = BackfillStats()

    if concurrency is None:
        concurrency = BACKFILL_CONFIG.get("article_concurrency", 10)

    source = CnEVDataSource()
    processed_set = set()

    # Initialize industry data components
    classifier = ArticleClassifier()
    industry_extractor = IndustryDataExtractor()
    api_client = EVPlatformAPI(API_BASE_URL)
    print(f"Industry data API initialized: {API_BASE_URL}")
    print(f"Article processing concurrency: {concurrency}")

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
                stats.increment("articles_found", len(articles))
                stats.increment("pages_processed")

                # Deduplicate against already-processed URLs
                new_articles = [a for a in articles if a.url not in processed_set]

                if not new_articles:
                    print(f"  All {len(articles)} articles already processed, skipping")
                elif concurrency <= 1:
                    # Sequential fallback
                    for article in new_articles:
                        result = process_single_article(
                            article, source, classifier, industry_extractor,
                            api_client, stats, dry_run, enable_ocr,
                        )
                        if result:
                            ocr_queue.append(result)
                        processed_set.add(article.url)
                else:
                    # Parallel article processing
                    with ThreadPoolExecutor(max_workers=concurrency) as executor:
                        futures = {
                            executor.submit(
                                process_single_article,
                                article, source, classifier, industry_extractor,
                                api_client, stats, dry_run, enable_ocr,
                            ): article
                            for article in new_articles
                        }
                        for future in as_completed(futures):
                            article = futures[future]
                            try:
                                result = future.result()
                                if result:
                                    ocr_queue.append(result)
                            except Exception as e:
                                stats.add_error(f"Article {article.url}: {str(e)[:50]}")
                                print(f"    Error processing {article.title[:40]}: {str(e)[:50]}")
                            processed_set.add(article.url)

                # Process OCR batch after each page if queue has items
                if ocr_queue:
                    process_ocr_batch(ocr, ocr_queue, stats, api_client, dry_run)
                    ocr_queue = []

            except Exception as e:
                print(f"  Error on page {page}: {e}")
                stats.add_error(f"Page {page}: {str(e)[:50]}")

            current_batch.append(page)

            # Check if batch is complete
            if len(current_batch) >= batch_size:
                batch_num += 1
                print(f"\n=== Batch {batch_num} complete (pages {current_batch[0]}-{current_batch[-1]}) ===")

                # Save checkpoint
                save_checkpoint(page, list(processed_set))

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
        save_checkpoint(end_page, list(processed_set))

    return list(processed_set)


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
        "--concurrency",
        type=int,
        default=BACKFILL_CONFIG.get("article_concurrency", 10),
        help=f"Parallel article processing workers. Default: {BACKFILL_CONFIG.get('article_concurrency', 10)}",
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
    print(f"# Concurrency: {args.concurrency}")
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
            concurrency=args.concurrency,
        )

        print(f"\nProcessed {len(processed)} articles")

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")

    finally:
        stats.print_summary()


if __name__ == "__main__":
    main()
