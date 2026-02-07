#!/usr/bin/env python3
"""Standalone pipeline for scraping NIO Power charger map statistics.

Usage:
    # Test without submitting
    python scrape_nio_power.py --dry-run

    # Scrape and submit to API
    python scrape_nio_power.py
"""

import argparse
import sys

from config import API_BASE_URL
from sources.nio_power import NioPowerScraper
from api_client import EVPlatformAPI


def main():
    parser = argparse.ArgumentParser(
        description="Scrape NIO Power charger map statistics",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print scraped data without submitting to API",
    )
    args = parser.parse_args()

    print("=" * 50)
    print("NIO Power Charger Map Scraper")
    print("=" * 50)

    # Scrape
    scraper = NioPowerScraper()
    data = scraper.scrape()

    if not data:
        print("\nFAILED: Could not scrape NIO Power data")
        sys.exit(1)

    # Print metrics
    print(f"\n  As of:                  {data.as_of_time}")
    print(f"  Total stations:         {data.total_stations:,}")
    print(f"  Swap stations:          {data.swap_stations:,}")
    print(f"  Highway swap stations:  {data.highway_swap_stations:,}")
    print(f"  Cumulative swaps:       {data.cumulative_swaps:,}")
    print(f"  Charging stations:      {data.charging_stations:,}")
    print(f"  Charging piles:         {data.charging_piles:,}")
    print(f"  Cumulative charges:     {data.cumulative_charges:,}")
    print(f"  Third-party piles:      {data.third_party_piles:,}")
    print(f"  Third-party usage:      {data.third_party_usage_percent}%")

    # Sanity check: cumulative counters should be in the millions,
    # stations/piles in the thousands. Reject mid-animation garbage.
    if data.cumulative_swaps < 1_000_000:
        print(f"\nFAILED: cumulativeSwaps={data.cumulative_swaps:,} looks like mid-animation data")
        sys.exit(1)
    if data.cumulative_charges < 1_000_000:
        print(f"\nFAILED: cumulativeCharges={data.cumulative_charges:,} looks like mid-animation data")
        sys.exit(1)
    if data.swap_stations < 100:
        print(f"\nFAILED: swapStations={data.swap_stations} looks like mid-animation data")
        sys.exit(1)

    # Submit or dry-run
    if args.dry_run:
        print("\n[DRY RUN] Skipping API submission")
        print("SUCCESS (dry run)")
    else:
        api_client = EVPlatformAPI(API_BASE_URL)
        response = api_client.submit("NioPowerSnapshot", data.to_api_dict())
        if response.success:
            print("\nSUCCESS: Submitted NIO Power snapshot")
        else:
            print(f"\nFAILED: {response.error}")
            sys.exit(1)


if __name__ == "__main__":
    main()
