"""Parser for extracting additional data from article summaries."""

import re
from typing import Optional, Tuple


class SummaryParser:
    """Parse EV metrics from article summaries/previews."""

    def __init__(self):
        # Patterns for change percentages
        self._yoy_patterns = [
            # "down 34.07% year-on-year"
            re.compile(
                r'(?:down|decrease|decline|drop|fall|fell)\s*(\d+(?:\.\d+)?)\s*%?\s*'
                r'(?:year-on-year|yoy|y-o-y|year over year)',
                re.IGNORECASE
            ),
            # "up 15% YoY"
            re.compile(
                r'(?:up|increase|rise|rose|grew|grow)\s*(\d+(?:\.\d+)?)\s*%?\s*'
                r'(?:year-on-year|yoy|y-o-y|year over year)',
                re.IGNORECASE
            ),
            # "-34.07% YoY"
            re.compile(
                r'(-?\d+(?:\.\d+)?)\s*%\s*(?:year-on-year|yoy|y-o-y)',
                re.IGNORECASE
            ),
        ]

        self._mom_patterns = [
            # "down 46.65% month-on-month"
            re.compile(
                r'(?:down|decrease|decline|drop|fall|fell)\s*(\d+(?:\.\d+)?)\s*%?\s*'
                r'(?:month-on-month|mom|m-o-m|month over month)',
                re.IGNORECASE
            ),
            # "up 10% MoM"
            re.compile(
                r'(?:up|increase|rise|rose|grew|grow)\s*(\d+(?:\.\d+)?)\s*%?\s*'
                r'(?:month-on-month|mom|m-o-m|month over month)',
                re.IGNORECASE
            ),
            # "-46.65% MoM"
            re.compile(
                r'(-?\d+(?:\.\d+)?)\s*%\s*(?:month-on-month|mom|m-o-m)',
                re.IGNORECASE
            ),
        ]

        # Pattern for market share
        self._share_pattern = re.compile(
            r'(?:market\s*share|share)\s*(?:of|:)?\s*(\d+(?:\.\d+)?)\s*%',
            re.IGNORECASE
        )

        # Pattern for ranking
        self._rank_pattern = re.compile(
            r'(?:rank(?:ed|ing)?|#)\s*(\d+)',
            re.IGNORECASE
        )

    def extract_yoy_change(self, text: str) -> Optional[float]:
        """Extract year-over-year change percentage from text.

        Args:
            text: Summary or content text

        Returns:
            YoY change percentage (negative for decline) or None
        """
        if not text:
            return None

        # Try patterns in order
        for i, pattern in enumerate(self._yoy_patterns):
            match = pattern.search(text)
            if match:
                value = float(match.group(1))
                # First pattern is "down/decrease" = negative
                if i == 0:
                    return -abs(value)
                # Second pattern is "up/increase" = positive
                elif i == 1:
                    return abs(value)
                # Third pattern already has sign
                else:
                    return value

        return None

    def extract_mom_change(self, text: str) -> Optional[float]:
        """Extract month-over-month change percentage from text.

        Args:
            text: Summary or content text

        Returns:
            MoM change percentage (negative for decline) or None
        """
        if not text:
            return None

        for i, pattern in enumerate(self._mom_patterns):
            match = pattern.search(text)
            if match:
                value = float(match.group(1))
                if i == 0:
                    return -abs(value)
                elif i == 1:
                    return abs(value)
                else:
                    return value

        return None

    def extract_changes(self, text: str) -> Tuple[Optional[float], Optional[float]]:
        """Extract both YoY and MoM changes from text.

        Args:
            text: Summary or content text

        Returns:
            Tuple of (yoy_change, mom_change)
        """
        return self.extract_yoy_change(text), self.extract_mom_change(text)

    def extract_market_share(self, text: str) -> Optional[float]:
        """Extract market share percentage from text.

        Args:
            text: Summary or content text

        Returns:
            Market share percentage or None
        """
        if not text:
            return None

        match = self._share_pattern.search(text)
        if match:
            return float(match.group(1))

        return None

    def extract_ranking(self, text: str) -> Optional[int]:
        """Extract ranking position from text.

        Args:
            text: Summary or content text

        Returns:
            Ranking position or None
        """
        if not text:
            return None

        match = self._rank_pattern.search(text)
        if match:
            return int(match.group(1))

        return None

    def enrich_metric(self, metric, summary: str) -> None:
        """Enrich a ParsedMetric with data from summary.

        Args:
            metric: ParsedMetric object to enrich
            summary: Summary text
        """
        if not summary or not metric:
            return

        # Extract YoY if not already present
        if metric.yoy_change is None:
            metric.yoy_change = self.extract_yoy_change(summary)

        # Extract MoM if not already present
        if metric.mom_change is None:
            metric.mom_change = self.extract_mom_change(summary)


# Test function
def test_summary_parser():
    """Test the summary parser with sample texts."""
    parser = SummaryParser()

    test_cases = [
        "down 34.07% year-on-year and down 46.65% month-on-month",
        "increased by 15.5% YoY but fell 10% MoM",
        "BYD captured 25.4% market share, ranking #1 in China",
        "Sales were -20% year-over-year",
        "Growth of +30% month-over-month",
    ]

    for text in test_cases:
        yoy = parser.extract_yoy_change(text)
        mom = parser.extract_mom_change(text)
        share = parser.extract_market_share(text)
        rank = parser.extract_ranking(text)

        print(f"\nText: {text}")
        print(f"  YoY: {yoy}%")
        print(f"  MoM: {mom}%")
        print(f"  Share: {share}%")
        print(f"  Rank: #{rank}")


if __name__ == "__main__":
    test_summary_parser()
