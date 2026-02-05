"""Parser for extracting EV metrics from article titles."""

import re
from dataclasses import dataclass
from typing import Optional
from datetime import datetime


@dataclass
class ParsedMetric:
    """Represents a parsed metric from title."""
    brand: str
    metric_type: str  # DELIVERY, SALES, WHOLESALE, PRODUCTION, BATTERY_INSTALL
    value: float
    year: int
    month: Optional[int] = None
    quarter: Optional[int] = None
    period_type: str = "MONTHLY"  # MONTHLY, QUARTERLY, YEARLY
    yoy_change: Optional[float] = None
    mom_change: Optional[float] = None
    vehicle_model: Optional[str] = None
    region: Optional[str] = None
    category: Optional[str] = None
    unit: str = "vehicles"
    confidence: float = 1.0


class TitleParser:
    """Parse EV metrics from article titles."""

    # Brand name mappings (case-insensitive)
    BRAND_MAPPINGS = {
        # Standard names
        "byd": "BYD",
        "nio": "NIO",
        "xpeng": "XPENG",
        "li auto": "LI_AUTO",
        "li": "LI_AUTO",
        "zeekr": "ZEEKR",
        "xiaomi": "XIAOMI",
        "tesla": "TESLA_CHINA",
        "tesla china": "TESLA_CHINA",
        # Industry level
        "china": "INDUSTRY",
        "nev": "INDUSTRY",
        "ev": "INDUSTRY",
        # Secondary tracked brands
        "geely": "GEELY",
        "leapmotor": "LEAPMOTOR",
        # Other brands (map to OTHER_BRAND)
        "changan": "OTHER_BRAND",
        "saic": "OTHER_BRAND",
        "gac": "OTHER_BRAND",
        "dongfeng": "OTHER_BRAND",
        "faw": "OTHER_BRAND",
        "great wall": "OTHER_BRAND",
        "chery": "OTHER_BRAND",
        "neta": "OTHER_BRAND",
        "hozon": "OTHER_BRAND",
        "avatr": "OTHER_BRAND",
        "im": "OTHER_BRAND",
        "rising": "OTHER_BRAND",
        "aion": "OTHER_BRAND",
        "denza": "OTHER_BRAND",
        "yangwang": "OTHER_BRAND",
        "jiyue": "OTHER_BRAND",
        "deepal": "OTHER_BRAND",
        "voyah": "OTHER_BRAND",
        "arcfox": "OTHER_BRAND",
        "ora": "OTHER_BRAND",
        "wuling": "OTHER_BRAND",
        "hongqi": "OTHER_BRAND",
        "hiphi": "OTHER_BRAND",
        "volvo": "OTHER_BRAND",
        "polestar": "OTHER_BRAND",
        "bmw": "OTHER_BRAND",
        "mercedes": "OTHER_BRAND",
        "audi": "OTHER_BRAND",
        "volkswagen": "OTHER_BRAND",
        "vw": "OTHER_BRAND",
        "hyundai": "OTHER_BRAND",
        "kia": "OTHER_BRAND",
    }

    # Metric type keywords
    METRIC_KEYWORDS = {
        "deliveries": "DELIVERY",
        "delivery": "DELIVERY",
        "delivered": "DELIVERY",
        "sales": "SALES",
        "sold": "SALES",
        "retail": "SALES",
        "wholesale": "WHOLESALE",
        "production": "PRODUCTION",
        "produced": "PRODUCTION",
        "output": "PRODUCTION",
        "battery": "BATTERY_INSTALL",
        "battery install": "BATTERY_INSTALL",
        "battery installation": "BATTERY_INSTALL",
        "gwh": "BATTERY_INSTALL",
        "exports": "EXPORTS",
        "export": "EXPORTS",
        "imports": "IMPORTS",
        "import": "IMPORTS",
        "registrations": "REGISTRATIONS",
        "license plate": "REGISTRATIONS",
        "inventory": "DEALER_INVENTORY",
    }

    # Month name mappings
    MONTH_NAMES = {
        "jan": 1, "january": 1,
        "feb": 2, "february": 2,
        "mar": 3, "march": 3,
        "apr": 4, "april": 4,
        "may": 5,
        "jun": 6, "june": 6,
        "jul": 7, "july": 7,
        "aug": 8, "august": 8,
        "sep": 9, "sept": 9, "september": 9,
        "oct": 10, "october": 10,
        "nov": 11, "november": 11,
        "dec": 12, "december": 12,
    }

    # Region keywords
    REGIONS = {
        "shanghai": "Shanghai",
        "beijing": "Beijing",
        "guangdong": "Guangdong",
        "shenzhen": "Shenzhen",
        "hangzhou": "Hangzhou",
        "guangzhou": "Guangzhou",
        "jiangsu": "Jiangsu",
        "zhejiang": "Zhejiang",
        "sichuan": "Sichuan",
        "chengdu": "Chengdu",
    }

    def __init__(self):
        # Pre-compile number pattern
        self._number_pattern = re.compile(r'[\d,]+(?:\.\d+)?')
        self._change_pattern = re.compile(
            r'(?:up|down|increase|decrease|rise|fall|grew|dropped?|declined?)\s*'
            r'(\d+(?:\.\d+)?)\s*%?\s*'
            r'(?:year-on-year|yoy|y-o-y|year over year|'
            r'month-on-month|mom|m-o-m|month over month)?',
            re.IGNORECASE
        )
        self._yoy_pattern = re.compile(
            r'(?:up|down|\+|-)\s*(\d+(?:\.\d+)?)\s*%?\s*'
            r'(?:year-on-year|yoy|y-o-y|year over year)',
            re.IGNORECASE
        )
        self._mom_pattern = re.compile(
            r'(?:up|down|\+|-)\s*(\d+(?:\.\d+)?)\s*%?\s*'
            r'(?:month-on-month|mom|m-o-m|month over month)',
            re.IGNORECASE
        )

    def has_number(self, title: str) -> bool:
        """Check if title contains a significant number (>=1000 or with commas)."""
        numbers = self._number_pattern.findall(title)
        for num_str in numbers:
            # Remove commas and parse
            clean = num_str.replace(',', '')
            try:
                value = float(clean)
                # Consider numbers >= 1000 or numbers with commas as significant
                if value >= 1000 or ',' in num_str:
                    return True
            except ValueError:
                continue
        return False

    def needs_ocr(self, title: str) -> bool:
        """Determine if OCR is needed: only when title has no significant numbers."""
        return not self.has_number(title)

    def parse(self, title: str, published_date: datetime = None) -> Optional[ParsedMetric]:
        """Parse a title and extract EV metric data.

        Args:
            title: Article title string
            published_date: Publication date (used to infer year if not in title)

        Returns:
            ParsedMetric if extraction successful, None otherwise
        """
        if not title:
            return None

        title_lower = title.lower()

        # Extract brand
        brand = self._extract_brand(title_lower)
        if not brand:
            return None

        # Extract metric type
        metric_type = self._extract_metric_type(title_lower)
        if not metric_type:
            return None

        # Extract value
        value = self._extract_value(title)
        if value is None:
            return None

        # Extract time period
        year, month, quarter, period_type = self._extract_period(title_lower, published_date)
        if year is None:
            return None

        # Extract change percentages
        yoy_change = self._extract_yoy(title)
        mom_change = self._extract_mom(title)

        # Extract optional dimensions
        vehicle_model = self._extract_model(title)
        region = self._extract_region(title_lower)
        category = self._extract_category(title_lower)

        # Determine unit
        unit = "GWh" if metric_type == "BATTERY_INSTALL" else "vehicles"

        return ParsedMetric(
            brand=brand,
            metric_type=metric_type,
            value=value,
            year=year,
            month=month,
            quarter=quarter,
            period_type=period_type,
            yoy_change=yoy_change,
            mom_change=mom_change,
            vehicle_model=vehicle_model,
            region=region,
            category=category,
            unit=unit,
            confidence=1.0,
        )

    def _extract_brand(self, title_lower: str) -> Optional[str]:
        """Extract brand from title."""
        # Check for known brands (longest match first)
        for keyword, brand in sorted(
            self.BRAND_MAPPINGS.items(),
            key=lambda x: len(x[0]),
            reverse=True
        ):
            if keyword in title_lower:
                return brand
        return None

    def _extract_metric_type(self, title_lower: str) -> Optional[str]:
        """Extract metric type from title."""
        for keyword, metric in self.METRIC_KEYWORDS.items():
            if keyword in title_lower:
                return metric
        return None

    def _extract_value(self, title: str) -> Optional[float]:
        """Extract the main numeric value from title."""
        # Find all numbers
        numbers = self._number_pattern.findall(title)
        if not numbers:
            return None

        # Look for the largest significant number (likely the main value)
        values = []
        for num_str in numbers:
            clean = num_str.replace(',', '')
            try:
                value = float(clean)
                # Skip percentages (small numbers after % or change keywords)
                if value < 100 and any(kw in title.lower() for kw in ['%', 'percent', 'yoy', 'mom']):
                    continue
                if value >= 100:  # Minimum threshold for vehicle counts
                    values.append(value)
            except ValueError:
                continue

        return max(values) if values else None

    def _extract_period(self, title_lower: str, published_date: datetime = None):
        """Extract time period from title.

        Returns:
            Tuple of (year, month, quarter, period_type)
        """
        current_year = published_date.year if published_date else datetime.now().year

        # Check for quarter
        quarter_match = re.search(r'q([1-4])\s*(?:\'?(\d{2,4}))?', title_lower)
        if quarter_match:
            quarter = int(quarter_match.group(1))
            year_str = quarter_match.group(2)
            if year_str:
                year = int(year_str) if len(year_str) == 4 else 2000 + int(year_str)
            else:
                year = current_year
            return year, None, quarter, "QUARTERLY"

        # Check for month
        for month_name, month_num in self.MONTH_NAMES.items():
            if month_name in title_lower:
                # Try to find year near the month
                year_match = re.search(rf'{month_name}\s*(?:\'?(\d{{2,4}}))?', title_lower)
                if year_match and year_match.group(1):
                    year_str = year_match.group(1)
                    year = int(year_str) if len(year_str) == 4 else 2000 + int(year_str)
                else:
                    year = current_year
                return year, month_num, None, "MONTHLY"

        # Check for year only
        year_match = re.search(r'\b(20\d{2})\b', title_lower)
        if year_match:
            year = int(year_match.group(1))
            # Check if it looks like yearly data (contains "full year" or "annual")
            if any(kw in title_lower for kw in ['full year', 'annual', 'yearly', 'fy ']):
                return year, None, None, "YEARLY"
            # Default to monthly with current month
            if published_date:
                return year, published_date.month, None, "MONTHLY"
            return year, None, None, "YEARLY"

        # Fallback: use published date
        if published_date:
            return published_date.year, published_date.month, None, "MONTHLY"

        return None, None, None, None

    def _extract_yoy(self, title: str) -> Optional[float]:
        """Extract year-over-year change percentage."""
        title_lower = title.lower()

        # Pattern: "down 34.07% year-on-year" or "up 15% YoY"
        patterns = [
            r'(?:down|decrease|decline|drop|fall|fell)\s*(\d+(?:\.\d+)?)\s*%?\s*(?:year-on-year|yoy|y-o-y)',
            r'(?:up|increase|rise|rose|grew|grow)\s*(\d+(?:\.\d+)?)\s*%?\s*(?:year-on-year|yoy|y-o-y)',
            r'-\s*(\d+(?:\.\d+)?)\s*%?\s*(?:year-on-year|yoy|y-o-y)',
            r'\+\s*(\d+(?:\.\d+)?)\s*%?\s*(?:year-on-year|yoy|y-o-y)',
        ]

        for i, pattern in enumerate(patterns):
            match = re.search(pattern, title_lower)
            if match:
                value = float(match.group(1))
                # First two patterns or minus sign = negative
                if i in [0, 2]:
                    return -value
                return value

        return None

    def _extract_mom(self, title: str) -> Optional[float]:
        """Extract month-over-month change percentage."""
        title_lower = title.lower()

        patterns = [
            r'(?:down|decrease|decline|drop|fall|fell)\s*(\d+(?:\.\d+)?)\s*%?\s*(?:month-on-month|mom|m-o-m)',
            r'(?:up|increase|rise|rose|grew|grow)\s*(\d+(?:\.\d+)?)\s*%?\s*(?:month-on-month|mom|m-o-m)',
            r'-\s*(\d+(?:\.\d+)?)\s*%?\s*(?:month-on-month|mom|m-o-m)',
            r'\+\s*(\d+(?:\.\d+)?)\s*%?\s*(?:month-on-month|mom|m-o-m)',
        ]

        for i, pattern in enumerate(patterns):
            match = re.search(pattern, title_lower)
            if match:
                value = float(match.group(1))
                if i in [0, 2]:
                    return -value
                return value

        return None

    def _extract_model(self, title: str) -> Optional[str]:
        """Extract vehicle model from title."""
        # Common model patterns
        model_patterns = [
            r'Model\s*([3SXY])',  # Tesla models
            r'(ET[579]|EC[67]|ES[68]|EL[68])',  # NIO models
            r'(P[57]|G[369]|X9)',  # XPeng models
            r'(L[6789]|Mega)',  # Li Auto models
            r'(SU7|SU[0-9]+)',  # Xiaomi models
            r'(?<![,\d])([0-9]{3}[Xx]?)(?![,\d])',  # Zeekr models like 001, 007, 009
        ]

        for pattern in model_patterns:
            match = re.search(pattern, title, re.IGNORECASE)
            if match:
                return match.group(1).upper()

        return None

    def _extract_region(self, title_lower: str) -> Optional[str]:
        """Extract region from title."""
        for keyword, region in self.REGIONS.items():
            if keyword in title_lower:
                return region
        return None

    def _extract_category(self, title_lower: str) -> Optional[str]:
        """Extract vehicle category from title."""
        categories = {
            "nev": "NEV",
            "bev": "BEV",
            "phev": "PHEV",
            "pure electric": "BEV",
            "plug-in hybrid": "PHEV",
            "passenger": "Passenger",
            "commercial": "Commercial",
            "suv": "SUV",
            "sedan": "Sedan",
            "mpv": "MPV",
        }

        for keyword, category in categories.items():
            if keyword in title_lower:
                return category

        return None


# Test function
def test_parser():
    """Test the title parser with sample titles."""
    parser = TitleParser()

    test_cases = [
        "Xpeng deliveries in Jan: 20,011",
        "BYD NEV sales in Jan: 210,051, down 34.07% year-on-year",
        "NIO deliveries in December 2025: 31,138",
        "Li Auto deliveries in Q4 2025: 158,369",
        "Tesla China sales: 68,280 in January, up 15% YoY",
        "China NEV sales in 2025: 12.4 million",
        "Shanghai NEV license plates in Jan: 45,000",
        "CATL battery installations in Jan: 25.6 GWh",
        "Tesla Apr sales breakdown: 13,196 Model 3s",
    ]

    for title in test_cases:
        result = parser.parse(title, datetime(2025, 1, 15))
        print(f"\nTitle: {title}")
        print(f"Needs OCR: {parser.needs_ocr(title)}")
        if result:
            print(f"Parsed: {result}")
        else:
            print("Could not parse")


if __name__ == "__main__":
    test_parser()
