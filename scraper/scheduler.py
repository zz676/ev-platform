#!/usr/bin/env python3
"""Scheduler for periodic scraping using APScheduler."""

from datetime import datetime, timedelta

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger

from config import SCRAPE_INTERVAL_HOURS
from main import run_scraper

# Global run counter
_run_counter = 0


def format_time_until(target: datetime) -> str:
    """Format the time until the target datetime."""
    now = datetime.now()
    delta = target - now
    total_seconds = int(delta.total_seconds())

    if total_seconds < 0:
        return "now"

    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60

    if hours > 0:
        return f"in {hours}h {minutes}m"
    else:
        return f"in {minutes}m"


def scheduled_scrape():
    """Run the scraper on schedule."""
    global _run_counter
    _run_counter += 1

    print("\n" + "="*60)
    print(f"[Run #{_run_counter}] SCHEDULED SCRAPE STARTING")
    print("="*60)

    try:
        run_scraper(
            sources=None,  # All enabled sources
            limit=10,
            skip_ai=False,
            dry_run=False,
        )

        # Log completion with next run time
        next_run = datetime.now() + timedelta(hours=SCRAPE_INTERVAL_HOURS)
        print(f"\n[Run #{_run_counter}] Scheduled scrape completed")
        print(f"Next run: {next_run.strftime('%Y-%m-%d %H:%M:%S')} ({format_time_until(next_run)})")

    except Exception as e:
        print(f"[Run #{_run_counter}] Scheduled scrape error: {e}")

        # Still log next run time on error
        next_run = datetime.now() + timedelta(hours=SCRAPE_INTERVAL_HOURS)
        print(f"Next run: {next_run.strftime('%Y-%m-%d %H:%M:%S')} ({format_time_until(next_run)})")


def main():
    """Start the scheduler."""
    scheduler = BlockingScheduler()

    # Add the scraping job
    scheduler.add_job(
        scheduled_scrape,
        trigger=IntervalTrigger(hours=SCRAPE_INTERVAL_HOURS),
        id="ev_scraper",
        name="EV News Scraper",
        replace_existing=True,
    )

    print(f"Scheduler started. Running every {SCRAPE_INTERVAL_HOURS} hours.")
    print("Press Ctrl+C to stop.")

    # Run immediately on start
    print("\nRunning initial scrape...")
    scheduled_scrape()

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        print("\nScheduler stopped.")


if __name__ == "__main__":
    main()
