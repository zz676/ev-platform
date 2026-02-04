"""Extract EV metrics from OCR table data."""

from typing import Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class ExtractedMetric:
    """Single extracted metric from table data."""
    brand: str
    metric_type: str  # DELIVERY, SALES, WHOLESALE, etc.
    value: float
    year: int
    period: int
    period_type: str = "MONTHLY"

    yoy_change: Optional[float] = None
    mom_change: Optional[float] = None
    market_share: Optional[float] = None
    ranking: Optional[int] = None

    vehicle_model: Optional[str] = None
    region: Optional[str] = None
    category: Optional[str] = None
    data_source: Optional[str] = None
    unit: str = "vehicles"
    confidence: float = 0.9


class TableExtractor:
    """Extract EV metrics from OCR table data."""

    # Brand name normalization
    BRAND_MAP = {
        "byd": "BYD",
        "nio": "NIO",
        "xpeng": "XPENG",
        "li auto": "LI_AUTO",
        "li": "LI_AUTO",
        "ideal": "LI_AUTO",
        "zeekr": "ZEEKR",
        "xiaomi": "XIAOMI",
        "tesla": "TESLA_CHINA",
        "tesla china": "TESLA_CHINA",
        "total": "INDUSTRY",
        "industry": "INDUSTRY",
        "market": "INDUSTRY",
        # Map other brands
        "geely": "OTHER_BRAND",
        "changan": "OTHER_BRAND",
        "saic": "OTHER_BRAND",
        "gac": "OTHER_BRAND",
        "aion": "OTHER_BRAND",
        "avatr": "OTHER_BRAND",
        "denza": "OTHER_BRAND",
        "yangwang": "OTHER_BRAND",
        "deepal": "OTHER_BRAND",
        "voyah": "OTHER_BRAND",
        "im": "OTHER_BRAND",
        "rising": "OTHER_BRAND",
        "leapmotor": "OTHER_BRAND",
        "leap motor": "OTHER_BRAND",
        "neta": "OTHER_BRAND",
        "hozon": "OTHER_BRAND",
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
        "toyota": "OTHER_BRAND",
        "honda": "OTHER_BRAND",
        "great wall": "OTHER_BRAND",
        "chery": "OTHER_BRAND",
        "faw": "OTHER_BRAND",
        "dongfeng": "OTHER_BRAND",
    }

    def __init__(self):
        pass

    def extract_rankings(
        self,
        ocr_data: list[dict],
        metric_type: str = "SALES",
        year: int = None,
        period: int = None,
        period_type: str = "MONTHLY",
        data_source: str = "CPCA"
    ) -> list[ExtractedMetric]:
        """Extract metrics from rankings table data.

        Args:
            ocr_data: List of row dicts from OCR
            metric_type: Type of metric (SALES, DELIVERY, etc.)
            year: Year of data
            period: Period (1-12 for monthly, 1-4 for quarterly)
            period_type: MONTHLY, QUARTERLY, or YEARLY
            data_source: Data source identifier

        Returns:
            List of ExtractedMetric objects
        """
        if not ocr_data:
            return []

        # Default to current date if not provided
        now = datetime.now()
        year = year or now.year
        period = period or now.month

        metrics = []

        for row in ocr_data:
            metric = self._extract_row(
                row, metric_type, year, period, period_type, data_source
            )
            if metric:
                metrics.append(metric)

        return metrics

    def _extract_row(
        self,
        row: dict,
        metric_type: str,
        year: int,
        period: int,
        period_type: str,
        data_source: str
    ) -> Optional[ExtractedMetric]:
        """Extract a single metric from a table row.

        Args:
            row: Dictionary representing one table row
            metric_type: Type of metric
            year: Year
            period: Period number
            period_type: Period type
            data_source: Data source

        Returns:
            ExtractedMetric or None
        """
        # Normalize keys
        row = {k.lower().replace(" ", "_"): v for k, v in row.items()}

        # Extract brand (required)
        brand = self._extract_brand(row)
        if not brand:
            return None

        # Extract value (required)
        value = self._extract_value(row)
        if value is None:
            return None

        # Extract optional fields
        yoy = self._extract_change(row, ["yoy", "y-o-y", "year_on_year", "yoy_change", "yoy%"])
        mom = self._extract_change(row, ["mom", "m-o-m", "month_on_month", "mom_change", "mom%"])
        share = self._extract_float(row, ["share", "market_share", "share%"])
        ranking = self._extract_int(row, ["rank", "ranking", "#", "position"])

        return ExtractedMetric(
            brand=brand,
            metric_type=metric_type,
            value=value,
            year=year,
            period=period,
            period_type=period_type,
            yoy_change=yoy,
            mom_change=mom,
            market_share=share,
            ranking=ranking,
            data_source=data_source,
            confidence=0.9
        )

    def _extract_brand(self, row: dict) -> Optional[str]:
        """Extract and normalize brand name from row."""
        # Try common brand field names
        brand_fields = ["brand", "company", "manufacturer", "oem", "name", "automaker"]

        for field in brand_fields:
            if field in row and row[field]:
                brand_raw = str(row[field]).lower().strip()
                # Look up in brand map
                if brand_raw in self.BRAND_MAP:
                    return self.BRAND_MAP[brand_raw]
                # Check if any key is contained in the raw brand name
                for key, mapped in self.BRAND_MAP.items():
                    if key in brand_raw:
                        return mapped
                # Default to OTHER_BRAND if we have a name but can't map it
                return "OTHER_BRAND"

        return None

    def _extract_value(self, row: dict) -> Optional[float]:
        """Extract main numeric value from row."""
        value_fields = [
            "value", "sales", "deliveries", "delivery", "volume",
            "units", "count", "total", "wholesale", "production"
        ]

        for field in value_fields:
            if field in row and row[field] is not None:
                try:
                    val = row[field]
                    if isinstance(val, str):
                        val = val.replace(",", "").replace(" ", "")
                    return float(val)
                except (ValueError, TypeError):
                    continue

        return None

    def _extract_change(self, row: dict, fields: list[str]) -> Optional[float]:
        """Extract change percentage from row."""
        for field in fields:
            if field in row and row[field] is not None:
                try:
                    val = row[field]
                    if isinstance(val, str):
                        # Remove % sign and handle negative
                        val = val.replace("%", "").replace(",", "").strip()
                    return float(val)
                except (ValueError, TypeError):
                    continue
        return None

    def _extract_float(self, row: dict, fields: list[str]) -> Optional[float]:
        """Extract float value from row."""
        for field in fields:
            if field in row and row[field] is not None:
                try:
                    val = row[field]
                    if isinstance(val, str):
                        val = val.replace("%", "").replace(",", "").strip()
                    return float(val)
                except (ValueError, TypeError):
                    continue
        return None

    def _extract_int(self, row: dict, fields: list[str]) -> Optional[int]:
        """Extract integer value from row."""
        for field in fields:
            if field in row and row[field] is not None:
                try:
                    return int(row[field])
                except (ValueError, TypeError):
                    continue
        return None

    def to_prisma_data(self, metric: ExtractedMetric) -> dict:
        """Convert ExtractedMetric to Prisma-compatible dict.

        Args:
            metric: ExtractedMetric object

        Returns:
            Dictionary ready for Prisma create
        """
        return {
            "brand": metric.brand,
            "metric": metric.metric_type,
            "periodType": metric.period_type,
            "year": metric.year,
            "period": metric.period,
            "value": metric.value,
            "unit": metric.unit,
            "yoyChange": metric.yoy_change,
            "momChange": metric.mom_change,
            "marketShare": metric.market_share,
            "ranking": metric.ranking,
            "vehicleModel": metric.vehicle_model,
            "region": metric.region,
            "category": metric.category,
            "dataSource": metric.data_source,
            "confidence": metric.confidence,
        }


# Test function
def test_table_extractor():
    """Test table extraction with sample data."""
    extractor = TableExtractor()

    sample_ocr_data = [
        {"rank": 1, "brand": "BYD", "value": 339854, "mom": 13.6, "yoy": -15.7, "share": 25.4},
        {"rank": 2, "brand": "Tesla", "value": 68280, "mom": -5.3, "yoy": 15.2, "share": 5.1},
        {"rank": 3, "brand": "Li Auto", "value": 51952, "mom": 8.2, "yoy": 42.1, "share": 3.9},
        {"rank": 4, "brand": "NIO", "value": 20544, "mom": -12.1, "yoy": -25.3, "share": 1.5},
        {"rank": 5, "brand": "XPeng", "value": 20011, "mom": -34.1, "yoy": -46.7, "share": 1.5},
    ]

    metrics = extractor.extract_rankings(
        sample_ocr_data,
        metric_type="SALES",
        year=2025,
        period=1,
        period_type="MONTHLY",
        data_source="CPCA"
    )

    print(f"Extracted {len(metrics)} metrics:")
    for m in metrics:
        print(f"  {m.brand}: {m.value:,.0f} (YoY: {m.yoy_change}%, MoM: {m.mom_change}%, Share: {m.market_share}%)")


if __name__ == "__main__":
    test_table_extractor()
