"""Extract structured data for industry tables based on article classification."""

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from .title_parser import TitleParser
from .classifier import ClassificationResult, ArticleType


@dataclass
class ExtractionResult:
    """Result of data extraction for an industry table."""
    success: bool
    table_name: str
    data: dict
    error: Optional[str] = None


class IndustryDataExtractor:
    """Extract structured data for industry tables based on classification."""

    # Plant name patterns for plant exports
    PLANTS = {
        "shanghai": {"plant": "Tesla Shanghai", "brand": "Tesla"},
        "giga shanghai": {"plant": "Tesla Shanghai", "brand": "Tesla"},
        "tesla shanghai": {"plant": "Tesla Shanghai", "brand": "Tesla"},
        "fremont": {"plant": "Tesla Fremont", "brand": "Tesla"},
        "berlin": {"plant": "Tesla Berlin", "brand": "Tesla"},
        "texas": {"plant": "Tesla Texas", "brand": "Tesla"},
        "austin": {"plant": "Tesla Texas", "brand": "Tesla"},
        "byd shenzhen": {"plant": "BYD Shenzhen", "brand": "BYD"},
        "byd changsha": {"plant": "BYD Changsha", "brand": "BYD"},
    }

    # Battery maker patterns
    BATTERY_MAKERS = {
        "catl": "CATL",
        "byd": "BYD",
        "lg": "LG Energy Solution",
        "lg energy": "LG Energy Solution",
        "sk": "SK On",
        "sk on": "SK On",
        "panasonic": "Panasonic",
        "calb": "CALB",
        "gotion": "Gotion High-Tech",
        "eve": "EVE Energy",
        "sunwoda": "Sunwoda",
        "svolt": "SVOLT",
        "samsung": "Samsung SDI",
        "farasis": "Farasis Energy",
    }

    def __init__(self):
        self.title_parser = TitleParser()
        # Pattern to extract percentage values
        self._percentage_pattern = re.compile(r'(\d+(?:\.\d+)?)\s*%')
        # Pattern to extract GWh values
        self._gwh_pattern = re.compile(r'(\d+(?:\.\d+)?)\s*gwh', re.IGNORECASE)
        # Pattern to extract large numbers (thousands+)
        self._number_pattern = re.compile(r'[\d,]+(?:\.\d+)?')
        # Pattern for date ranges like "Jan 1-18" or "1/1-1/18"
        self._date_range_pattern = re.compile(
            r'(?:(\w+)\s*)?(\d{1,2})[-/](\d{1,2})',
            re.IGNORECASE
        )

    def extract(
        self,
        title: str,
        summary: str,
        classification: ClassificationResult,
        source_url: str,
        source_title: str,
        image_url: Optional[str] = None,
        published_date: Optional[datetime] = None,
    ) -> Optional[ExtractionResult]:
        """Extract structured data based on article classification.

        Args:
            title: Article title
            summary: Article summary/content
            classification: Classification result from ArticleClassifier
            source_url: URL of the source article
            source_title: Original title of the article
            image_url: Optional URL of associated image
            published_date: Optional publication date

        Returns:
            ExtractionResult with table-specific data, or None if extraction fails
        """
        if not classification.target_table:
            return None

        # Route to appropriate extraction method
        extractors = {
            "ChinaPassengerInventory": self._extract_passenger_inventory,
            "ChinaBatteryInstallation": self._extract_battery_installation,
            "CaamNevSales": self._extract_caam_nev_sales,
            "ChinaDealerInventoryFactor": self._extract_dealer_inventory,
            "CpcaNevRetail": self._extract_cpca_nev_retail,
            "CpcaNevProduction": self._extract_cpca_nev_production,
            "ChinaViaIndex": self._extract_via_index,
            "BatteryMakerMonthly": self._extract_battery_maker_monthly,
            "PlantExports": self._extract_plant_exports,
            "NevSalesSummary": self._extract_nev_sales_summary,
            "AutomakerRankings": self._extract_automaker_rankings,
            "BatteryMakerRankings": self._extract_battery_maker_rankings,
        }

        extractor = extractors.get(classification.target_table)
        if not extractor:
            return None

        try:
            data = extractor(title, summary, classification, published_date)
            if not data:
                return ExtractionResult(
                    success=False,
                    table_name=classification.target_table,
                    data={},
                    error="Could not extract required fields from title"
                )

            # Add common fields
            data["sourceUrl"] = source_url
            data["sourceTitle"] = source_title
            if published_date:
                data["publishedAt"] = published_date.isoformat()
            if image_url:
                data["imageUrl"] = image_url

            return ExtractionResult(
                success=True,
                table_name=classification.target_table,
                data=data
            )
        except Exception as e:
            return ExtractionResult(
                success=False,
                table_name=classification.target_table,
                data={},
                error=str(e)
            )

    def _extract_time_period(
        self,
        title: str,
        published_date: Optional[datetime] = None
    ) -> tuple[Optional[int], Optional[int]]:
        """Extract year and month from title.

        Returns:
            Tuple of (year, month), either may be None
        """
        # First try the TitleParser
        parsed = self.title_parser.parse(title, published_date)
        if parsed:
            return parsed.year, parsed.month

        # Fallback: manual extraction for non-vehicle articles
        title_lower = title.lower()
        current_year = published_date.year if published_date else datetime.now().year

        # Month name mappings
        month_map = {
            'jan': 1, 'january': 1, 'feb': 2, 'february': 2,
            'mar': 3, 'march': 3, 'apr': 4, 'april': 4,
            'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
            'aug': 8, 'august': 8, 'sep': 9, 'sept': 9, 'september': 9,
            'oct': 10, 'october': 10, 'nov': 11, 'november': 11,
            'dec': 12, 'december': 12
        }

        # Try to find month name
        month = None
        for month_name, month_num in month_map.items():
            if month_name in title_lower:
                month = month_num
                break

        # Try to find year (4-digit number between 2020 and 2030)
        year_match = re.search(r'\b(20[2-3]\d)\b', title)
        year = int(year_match.group(1)) if year_match else None

        # If no year but we have month, use reference year with adjustment
        if month and not year:
            year = current_year
            # If the data month is after the reference month, the data
            # is from the previous year (e.g., "Dec" data published Jan → Dec prev year)
            ref_month = published_date.month if published_date else datetime.now().month
            if month > ref_month:
                year -= 1

        # If no month but we have year, try to get from published date
        if year and not month and published_date:
            month = published_date.month

        return year, month

    def _extract_value(self, title: str, prefer_gwh: bool = False) -> Optional[float]:
        """Extract the main numeric value from title.

        Args:
            title: Article title
            prefer_gwh: If True, look for GWh values first

        Returns:
            Extracted value or None
        """
        if prefer_gwh:
            gwh_match = self._gwh_pattern.search(title)
            if gwh_match:
                return float(gwh_match.group(1))

        # Check for "X million" pattern
        million_pattern = re.compile(r'(\d+(?:\.\d+)?)\s*million', re.IGNORECASE)
        million_match = million_pattern.search(title)
        if million_match:
            return float(million_match.group(1)) * 1_000_000

        # Find all numbers
        numbers = self._number_pattern.findall(title)
        values = []
        for num_str in numbers:
            clean = num_str.replace(',', '')
            try:
                val = float(clean)
                # Skip small numbers (likely percentages or dates)
                # Also skip 4-digit numbers that look like years (2020-2030)
                if val >= 100 and not (2000 <= val <= 2100):
                    values.append(val)
            except ValueError:
                continue

        return max(values) if values else None

    def _extract_percentage(self, title: str) -> Optional[float]:
        """Extract percentage value from title."""
        match = self._percentage_pattern.search(title)
        if match:
            return float(match.group(1))
        return None

    def _extract_yoy_mom(self, title: str) -> tuple[Optional[float], Optional[float]]:
        """Extract YoY and MoM changes from title."""
        parsed = self.title_parser.parse(title)
        if parsed:
            return parsed.yoy_change, parsed.mom_change
        return None, None

    # ==========================================
    # Individual table extractors
    # ==========================================

    def _extract_passenger_inventory(
        self,
        title: str,
        summary: str,
        classification: ClassificationResult,
        published_date: Optional[datetime]
    ) -> Optional[dict]:
        """Extract China passenger car inventory data."""
        year, month = self._extract_time_period(title, published_date)
        value = self._extract_value(title)

        if not year or not month or value is None:
            return None

        return {
            "year": year,
            "month": month,
            "value": value,
            "unit": "vehicles",
        }

    def _extract_battery_installation(
        self,
        title: str,
        summary: str,
        classification: ClassificationResult,
        published_date: Optional[datetime]
    ) -> Optional[dict]:
        """Extract China battery installation data."""
        year, month = self._extract_time_period(title, published_date)
        value = self._extract_value(title, prefer_gwh=True)

        if not year or not month or value is None:
            return None

        return {
            "year": year,
            "month": month,
            "installation": value,
            "unit": "GWh",
        }

    def _extract_caam_nev_sales(
        self,
        title: str,
        summary: str,
        classification: ClassificationResult,
        published_date: Optional[datetime]
    ) -> Optional[dict]:
        """Extract CAAM NEV sales data."""
        year, month = self._extract_time_period(title, published_date)
        value = self._extract_value(title)
        yoy, mom = self._extract_yoy_mom(title)

        if not year or not month or value is None:
            return None

        data = {
            "year": year,
            "month": month,
            "value": value,
            "unit": "vehicles",
        }
        if yoy is not None:
            data["yoyChange"] = yoy
        if mom is not None:
            data["momChange"] = mom

        return data

    def _extract_dealer_inventory(
        self,
        title: str,
        summary: str,
        classification: ClassificationResult,
        published_date: Optional[datetime]
    ) -> Optional[dict]:
        """Extract dealer inventory factor data."""
        year, month = self._extract_time_period(title, published_date)

        # Look for factor/coefficient value (usually 1.xx)
        factor_pattern = re.compile(r'(\d\.\d+)')
        match = factor_pattern.search(title)
        value = float(match.group(1)) if match else None

        if not year or not month or value is None:
            return None

        return {
            "year": year,
            "month": month,
            "value": value,
            "unit": "factor",
        }

    def _extract_cpca_nev_retail(
        self,
        title: str,
        summary: str,
        classification: ClassificationResult,
        published_date: Optional[datetime]
    ) -> Optional[dict]:
        """Extract CPCA NEV retail sales data."""
        year, month = self._extract_time_period(title, published_date)
        value = self._extract_value(title)
        yoy, mom = self._extract_yoy_mom(title)

        if not year or not month or value is None:
            return None

        data = {
            "year": year,
            "month": month,
            "value": value,
            "unit": "vehicles",
        }
        if yoy is not None:
            data["yoyChange"] = yoy
        if mom is not None:
            data["momChange"] = mom

        return data

    def _extract_cpca_nev_production(
        self,
        title: str,
        summary: str,
        classification: ClassificationResult,
        published_date: Optional[datetime]
    ) -> Optional[dict]:
        """Extract CPCA NEV production data."""
        year, month = self._extract_time_period(title, published_date)
        value = self._extract_value(title)
        yoy, mom = self._extract_yoy_mom(title)

        if not year or not month or value is None:
            return None

        data = {
            "year": year,
            "month": month,
            "value": value,
            "unit": "vehicles",
        }
        if yoy is not None:
            data["yoyChange"] = yoy
        if mom is not None:
            data["momChange"] = mom

        return data

    def _extract_via_index(
        self,
        title: str,
        summary: str,
        classification: ClassificationResult,
        published_date: Optional[datetime]
    ) -> Optional[dict]:
        """Extract VIA (Vehicle Inventory Alert) Index data."""
        year, month = self._extract_time_period(title, published_date)
        value = self._extract_percentage(title)

        if not year or not month or value is None:
            return None

        return {
            "year": year,
            "month": month,
            "value": value,
            "unit": "percent",
        }

    def _extract_battery_maker_monthly(
        self,
        title: str,
        summary: str,
        classification: ClassificationResult,
        published_date: Optional[datetime]
    ) -> Optional[dict]:
        """Extract battery maker monthly data."""
        year, month = self._extract_time_period(title, published_date)
        value = self._extract_value(title, prefer_gwh=True)
        yoy, mom = self._extract_yoy_mom(title)

        # Get maker from classification dimensions or extract from title
        maker = classification.dimensions.get("maker")
        if maker:
            # Normalize maker name from classification (e.g., "CATL" -> "CATL")
            maker_lower = maker.lower()
            for keyword, maker_name in self.BATTERY_MAKERS.items():
                if keyword == maker_lower or keyword in maker_lower:
                    maker = maker_name
                    break
        else:
            # Try to extract from title
            title_lower = title.lower()
            for keyword, maker_name in self.BATTERY_MAKERS.items():
                if keyword in title_lower:
                    maker = maker_name
                    break

        if not year or not month or value is None or not maker:
            return None

        data = {
            "maker": maker,
            "year": year,
            "month": month,
            "installation": value,
            "unit": "GWh",
        }
        if yoy is not None:
            data["yoyChange"] = yoy
        if mom is not None:
            data["momChange"] = mom

        return data

    def _extract_plant_exports(
        self,
        title: str,
        summary: str,
        classification: ClassificationResult,
        published_date: Optional[datetime]
    ) -> Optional[dict]:
        """Extract plant exports data."""
        year, month = self._extract_time_period(title, published_date)
        value = self._extract_value(title)
        yoy, mom = self._extract_yoy_mom(title)

        # Extract plant and brand
        title_lower = title.lower()
        plant = None
        brand = None

        for keyword, info in self.PLANTS.items():
            if keyword in title_lower:
                plant = info["plant"]
                brand = info["brand"]
                break

        if not year or not month or value is None or not plant or not brand:
            return None

        data = {
            "plant": plant,
            "brand": brand,
            "year": year,
            "month": month,
            "value": value,
            "unit": "vehicles",
        }
        if yoy is not None:
            data["yoyChange"] = yoy
        if mom is not None:
            data["momChange"] = mom

        return data

    def _extract_nev_sales_summary(
        self,
        title: str,
        summary: str,
        classification: ClassificationResult,
        published_date: Optional[datetime]
    ) -> Optional[dict]:
        """Extract NEV sales summary data (date ranges)."""
        year, month = self._extract_time_period(title, published_date)
        value = self._extract_value(title)
        yoy, mom = self._extract_yoy_mom(title)

        # Extract date range (e.g., "Jan 1-18" or "1/1-1/18")
        match = self._date_range_pattern.search(title)
        if not match:
            return None

        # Get the actual dates
        if year is None:
            year = published_date.year if published_date else datetime.now().year

        month_str = match.group(1)
        start_day = int(match.group(2))
        end_day = int(match.group(3))

        # Determine month from month string if available
        if month_str:
            month_map = {
                'jan': 1, 'january': 1, 'feb': 2, 'february': 2,
                'mar': 3, 'march': 3, 'apr': 4, 'april': 4,
                'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
                'aug': 8, 'august': 8, 'sep': 9, 'sept': 9, 'september': 9,
                'oct': 10, 'october': 10, 'nov': 11, 'november': 11,
                'dec': 12, 'december': 12
            }
            month = month_map.get(month_str.lower(), month)

        if month is None:
            month = published_date.month if published_date else datetime.now().month

        # Format dates as strings (MM-DD)
        start_date = f"{month:02d}-{start_day:02d}"
        end_date = f"{month:02d}-{end_day:02d}"

        # retailSales is required by the API — skip if no value in title
        if value is None:
            return None

        data = {
            "dataSource": "CPCA",
            "year": year,
            "startDate": start_date,
            "endDate": end_date,
            "retailSales": value,
            "unit": "vehicles",
        }
        if yoy is not None:
            data["retailYoy"] = yoy
        if mom is not None:
            data["retailMom"] = mom

        return data

    def _extract_automaker_rankings(
        self,
        title: str,
        summary: str,
        classification: ClassificationResult,
        published_date: Optional[datetime]
    ) -> Optional[dict]:
        """Extract automaker rankings data.

        Note: This returns a template that needs OCR data to populate.
        For rankings, we need image OCR to get the full table.
        Returns None since rankings require OCR processing.
        """
        # Rankings extraction requires OCR - return template info
        year, month = self._extract_time_period(title, published_date)

        if not year or not month:
            return None

        # Return template that indicates OCR is needed
        return {
            "_needs_ocr": True,
            "_ocr_type": "rankings",
            "year": year,
            "month": month,
            "dataSource": "CPCA",
        }

    def _extract_battery_maker_rankings(
        self,
        title: str,
        summary: str,
        classification: ClassificationResult,
        published_date: Optional[datetime]
    ) -> Optional[dict]:
        """Extract battery maker rankings data.

        Note: This returns a template that needs OCR data to populate.
        For rankings, we need image OCR to get the full table.
        Returns None since rankings require OCR processing.
        """
        # Rankings extraction requires OCR - return template info
        year, month = self._extract_time_period(title, published_date)

        # Determine scope (global vs china)
        scope = classification.dimensions.get("scope", "CHINA")

        if not year:
            return None

        # Return template that indicates OCR is needed
        return {
            "_needs_ocr": True,
            "_ocr_type": "rankings",
            "year": year,
            "month": month,
            "dataSource": "CABIA" if scope == "CHINA" else "SNE",
            "scope": scope,
        }


def test_industry_extractor():
    """Test the industry data extractor with sample titles."""
    from .classifier import ArticleClassifier

    classifier = ArticleClassifier()
    extractor = IndustryDataExtractor()

    test_cases = [
        "China EV battery installations hit 45.2 GWh in Jan 2025",
        "CAAM NEV sales: 1.2 million vehicles in Jan 2025, up 15% YoY",
        "China dealer inventory factor rises to 1.31 in Jan 2025",
        "CPCA: NEV retail sales reach 850,000 in Jan 2025, down 5% MoM",
        "China vehicle inventory alert index rises to 59.4% in Jan 2025",
        "CATL battery installations in Jan 2025: 25.6 GWh",
        "Tesla Shanghai exports 35,000 vehicles in Jan 2025",
        "CPCA: NEV sales Jan 1-18 reach 420,000",
        "CPCA top-selling automakers Jan 2025",
    ]

    print("=" * 80)
    print("Industry Data Extractor Test Results")
    print("=" * 80)

    for title in test_cases:
        classification = classifier.classify(title, "")
        result = extractor.extract(
            title=title,
            summary="",
            classification=classification,
            source_url="https://example.com/article",
            source_title=title,
        )

        print(f"\nTitle: {title}")
        print(f"Table: {classification.target_table}")
        if result:
            print(f"Success: {result.success}")
            if result.success:
                print(f"Data: {result.data}")
            else:
                print(f"Error: {result.error}")
        else:
            print("Result: None")


if __name__ == "__main__":
    test_industry_extractor()
