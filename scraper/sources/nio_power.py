"""Scraper for NIO Power charger map statistics.

Scrapes https://chargermap.nio.com/pe/h5/static/chargermap#/ for real-time
charging/swapping infrastructure metrics using Playwright.
"""

import logging
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

NIO_POWER_URL = "https://chargermap.nio.com/pe/h5/static/chargermap#/"


@dataclass
class NioPowerData:
    """Snapshot of NIO Power infrastructure metrics."""

    as_of_time: datetime
    total_stations: int
    swap_stations: int
    highway_swap_stations: int
    cumulative_swaps: int
    charging_stations: int
    charging_piles: int
    cumulative_charges: int
    third_party_piles: int
    third_party_usage_percent: float

    def to_api_dict(self) -> dict:
        """Convert to API-compatible dictionary."""
        return {
            "asOfTime": self.as_of_time.isoformat(),
            "totalStations": self.total_stations,
            "swapStations": self.swap_stations,
            "highwaySwapStations": self.highway_swap_stations,
            "cumulativeSwaps": self.cumulative_swaps,
            "chargingStations": self.charging_stations,
            "chargingPiles": self.charging_piles,
            "cumulativeCharges": self.cumulative_charges,
            "thirdPartyPiles": self.third_party_piles,
            "thirdPartyUsagePercent": self.third_party_usage_percent,
        }


def parse_timestamp(text: str) -> Optional[datetime]:
    """Parse the '截至' timestamp from page text.

    Expected formats:
        '截至 2026.02.06 15:29:51'
        '截至 2026.02.06 15:29'
    """
    if not text:
        return None

    match = re.search(r"截至\s*([\d.]+)\s+([\d:]+)", text)
    if not match:
        return None

    date_str = match.group(1)
    time_str = match.group(2)

    # Normalize date separators
    date_str = date_str.replace(".", "-")

    try:
        if time_str.count(":") == 2:
            return datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M:%S")
        elif time_str.count(":") == 1:
            return datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        else:
            return None
    except ValueError:
        logger.warning(f"Failed to parse timestamp: {date_str} {time_str}")
        return None


def find_number_after(label: str, text: str) -> Optional[int]:
    """Find the first number appearing after a Chinese label in text.

    Handles comma-separated numbers like '100,016,310'.
    """
    pattern = re.escape(label) + r"[\s\S]{0,50}?([\d,]+)"
    match = re.search(pattern, text)
    if not match:
        return None
    try:
        return int(match.group(1).replace(",", ""))
    except ValueError:
        return None


def find_float_after(label: str, text: str) -> Optional[float]:
    """Find the first float/percentage after a Chinese label."""
    pattern = re.escape(label) + r"[\s\S]{0,50}?([\d,.]+)%?"
    match = re.search(pattern, text)
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", ""))
    except ValueError:
        return None


def find_slash_numbers(label: str, text: str) -> Optional[tuple[int, int]]:
    """Find two slash-separated numbers after a label.

    E.g., '4,898 / 28,035' -> (4898, 28035)
    """
    pattern = re.escape(label) + r"[\s\S]{0,80}?([\d,]+)\s*/\s*([\d,]+)"
    match = re.search(pattern, text)
    if not match:
        return None
    try:
        first = int(match.group(1).replace(",", ""))
        second = int(match.group(2).replace(",", ""))
        return (first, second)
    except ValueError:
        return None


def parse_metrics_from_text(text: str) -> Optional[NioPowerData]:
    """Parse all NIO Power metrics from page innerText.

    Returns None if too many required fields are missing.
    """
    if not text:
        return None

    # Parse timestamp
    as_of_time = parse_timestamp(text)
    if not as_of_time:
        logger.warning("Could not parse '截至' timestamp from page text")
        return None

    # Parse each metric
    total_stations = find_number_after("蔚来能源充换电站总数", text)
    swap_stations = find_number_after("蔚来能源换电站", text)
    highway_swap_stations = find_number_after("其中高速公路换电站", text)
    cumulative_swaps = find_number_after("实时累计换电次数", text)
    cumulative_charges = find_number_after("实时累计充电次数", text)
    third_party_piles = find_number_after("接入第三方充电桩", text)
    third_party_usage = find_float_after("第三方用户占比", text)
    if third_party_usage is None:
        third_party_usage = find_float_after("蔚来能源充电桩电量第三方用户占比", text)

    # Parse charging stations / piles (slash-separated)
    charging_stations = None
    charging_piles = None
    slash_result = find_slash_numbers("蔚来能源充电站", text)
    if slash_result:
        charging_stations, charging_piles = slash_result
    else:
        # Try alternate label
        slash_result = find_slash_numbers("充电站", text)
        if slash_result:
            charging_stations, charging_piles = slash_result

    # Count missing required fields
    required = [
        total_stations,
        swap_stations,
        highway_swap_stations,
        cumulative_swaps,
        cumulative_charges,
        charging_stations,
        charging_piles,
    ]
    missing = sum(1 for v in required if v is None)

    if missing > 3:
        logger.warning(
            f"Too many missing fields ({missing}/7), page may not have loaded correctly"
        )
        return None

    return NioPowerData(
        as_of_time=as_of_time,
        total_stations=total_stations or 0,
        swap_stations=swap_stations or 0,
        highway_swap_stations=highway_swap_stations or 0,
        cumulative_swaps=cumulative_swaps or 0,
        charging_stations=charging_stations or 0,
        charging_piles=charging_piles or 0,
        cumulative_charges=cumulative_charges or 0,
        third_party_piles=third_party_piles or 0,
        third_party_usage_percent=third_party_usage or 0.0,
    )


class NioPowerScraper:
    """Scrapes NIO Power charger map for infrastructure statistics."""

    def __init__(self, url: str = NIO_POWER_URL, max_wait: int = 30, poll_interval: int = 2):
        self.url = url
        self.max_wait = max_wait
        self.poll_interval = poll_interval

    def scrape(self) -> Optional[NioPowerData]:
        """Scrape NIO Power charger map and return parsed metrics.

        Uses Playwright to load the SPA, waits for content to render,
        then extracts metrics from the page text.

        Returns:
            NioPowerData if successful, None otherwise.
        """
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            logger.error(
                "Playwright is not installed. Run: pip install playwright && playwright install chromium"
            )
            return None

        logger.info(f"Scraping NIO Power charger map: {self.url}")

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    viewport={"width": 1280, "height": 720},
                    locale="zh-CN",
                )
                page = context.new_page()

                # Load the page — use domcontentloaded instead of networkidle
                # because this SPA has persistent connections that never go idle
                page.goto(self.url, wait_until="domcontentloaded", timeout=30000)

                # Wait for the "截至" text to appear (indicates data loaded)
                try:
                    page.wait_for_function(
                        "document.body.innerText.includes('截至')",
                        timeout=30000,
                    )
                except Exception:
                    logger.warning(
                        "'截至' text not found after 15s, attempting extraction anyway"
                    )

                # Wait for digit-flip animations to complete.
                # Counters use <li> elements inside .pe-biz-digit-flip;
                # animating digits have class="refresh". Wait until none remain.
                import time

                elapsed = 0
                while elapsed < self.max_wait:
                    refresh_count = page.evaluate(
                        "() => document.querySelectorAll('li.refresh').length"
                    )
                    if refresh_count == 0:
                        logger.info(
                            f"All digit-flip animations complete after {elapsed}s"
                        )
                        break
                    time.sleep(self.poll_interval)
                    elapsed += self.poll_interval
                else:
                    logger.warning(
                        f"Still {refresh_count} animating digits after {self.max_wait}s"
                    )

                # Extra settle for any trailing CSS transitions
                time.sleep(2)

                # Extract text — read digit-flip counters structurally,
                # then append full innerText for labels/timestamps.
                # Each counter: <div> <h6>label</h6> ... <ul.pe-biz-digit-flip> <li>digit</li>... </ul> </div>
                body_text = page.evaluate("""() => {
                    let parts = [];
                    document.querySelectorAll('.pe-biz-digit-flip').forEach(ul => {
                        const section = ul.closest('div')?.parentElement;
                        const h6 = section ? section.querySelector('h6') : null;
                        if (h6) {
                            const digits = Array.from(ul.querySelectorAll('li'))
                                .map(li => li.innerText.trim())
                                .join('');
                            parts.push(h6.innerText + ' ' + digits);
                        }
                    });
                    return parts.join('\\n') + '\\n' + document.body.innerText;
                }""")

                browser.close()

            if not body_text:
                logger.error("Empty page text extracted")
                return None

            logger.info(f"Extracted {len(body_text)} chars of page text")

            # Parse metrics from text
            data = parse_metrics_from_text(body_text)
            if data:
                logger.info(
                    f"Successfully scraped NIO Power data as of {data.as_of_time}"
                )
            else:
                logger.warning("Failed to parse metrics from page text")

            return data

        except Exception as e:
            logger.error(f"Error scraping NIO Power charger map: {e}")
            return None
