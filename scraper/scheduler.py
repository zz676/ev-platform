#!/usr/bin/env python3
"""Scheduler for periodic scraping using APScheduler."""

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger

from config import SCRAPE_INTERVAL_HOURS
from main import run_scraper


def scheduled_scrape():
    """Run the scraper on schedule."""
    print("\n" + "="*60)
    print("SCHEDULED SCRAPE STARTING")
    print("="*60)

    try:
        run_scraper(
            sources=None,  # All enabled sources
            limit=10,
            skip_ai=False,
            dry_run=False,
        )
    except Exception as e:
        print(f"Scheduled scrape error: {e}")


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
