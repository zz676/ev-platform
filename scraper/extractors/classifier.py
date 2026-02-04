"""Article classifier to determine article type and processing strategy."""

import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class ArticleType(Enum):
    """Types of articles that can be processed."""
    BRAND_METRIC = "BRAND_METRIC"      # Single brand delivery/sales data
    MODEL_BREAKDOWN = "MODEL_BREAKDOWN" # Model-level breakdown data
    REGIONAL_DATA = "REGIONAL_DATA"     # Regional/city level data
    INDUSTRY_INDICATOR = "INDUSTRY_INDICATOR"  # Industry-wide indicators
    RANKINGS_TABLE = "RANKINGS_TABLE"   # Rankings/leaderboard table
    DATA_TABLE = "DATA_TABLE"           # General data table
    VEHICLE_SPEC = "VEHICLE_SPEC"       # Vehicle specifications
    BATTERY_METRIC = "BATTERY_METRIC"   # Battery installation data
    SKIP = "SKIP"                       # Skip processing


@dataclass
class ClassificationResult:
    """Result of article classification."""
    article_type: ArticleType
    target_table: Optional[str]  # "EVMetric" or "VehicleSpec"
    needs_ocr: bool
    dimensions: dict  # Extra dimensions to add to metrics
    confidence: float = 1.0


class ArticleClassifier:
    """Classify articles to determine processing strategy."""

    # Keywords for each article type
    SPEC_KEYWORDS = ["main specs", "specifications", "spec sheet", "key specs"]
    RANKING_KEYWORDS = ["rankings", "top-selling", "top selling", "leaderboard", "top 10", "top 20"]
    TABLE_KEYWORDS = ["data table", "monthly report", "cpca data", "caam data"]
    BREAKDOWN_KEYWORDS = ["breakdown", "model breakdown", "by model"]
    INDUSTRY_KEYWORDS = ["imports", "inventory", "registrations", "industry", "cpca"]
    BATTERY_KEYWORDS = ["battery", "gwh", "battery installation", "catl", "byd battery"]

    REGIONS = [
        "shanghai", "beijing", "guangdong", "shenzhen", "hangzhou",
        "guangzhou", "jiangsu", "zhejiang", "sichuan", "chengdu",
        "tianjin", "chongqing", "hubei", "wuhan"
    ]

    def __init__(self):
        self._number_pattern = re.compile(r'\d{1,3}(?:,\d{3})+|\d{4,}')

    def _has_number(self, text: str) -> bool:
        """Check if text contains significant numbers."""
        return bool(self._number_pattern.search(text))

    def classify(self, title: str, summary: str = "") -> ClassificationResult:
        """Classify an article based on title and summary.

        Args:
            title: Article title
            summary: Optional article summary/preview

        Returns:
            ClassificationResult with type, target table, and OCR requirement
        """
        title_lower = title.lower()
        has_number = self._has_number(title)

        # 1. Vehicle specs -> VehicleSpec table
        if any(kw in title_lower for kw in self.SPEC_KEYWORDS):
            return ClassificationResult(
                article_type=ArticleType.VEHICLE_SPEC,
                target_table="VehicleSpec",
                needs_ocr=True,
                dimensions={},
                confidence=0.95
            )

        # 2. Model breakdown (e.g., "Tesla Apr sales breakdown: 13,196 Model 3s")
        if any(kw in title_lower for kw in self.BREAKDOWN_KEYWORDS):
            return ClassificationResult(
                article_type=ArticleType.MODEL_BREAKDOWN,
                target_table="EVMetric",
                needs_ocr=not has_number,
                dimensions={"vehicleModel": "parse_from_content"},
                confidence=0.9
            )

        # 3. Regional data (Shanghai, Beijing, etc.)
        region = self._extract_region(title_lower)
        if region:
            return ClassificationResult(
                article_type=ArticleType.REGIONAL_DATA,
                target_table="EVMetric",
                needs_ocr=not has_number,
                dimensions={"region": region},
                confidence=0.9
            )

        # 4. Industry indicators (imports, inventory, registrations)
        if any(kw in title_lower for kw in self.INDUSTRY_KEYWORDS):
            # Check if it's about a specific brand or industry-wide
            is_brand_specific = self._has_brand_name(title_lower)
            return ClassificationResult(
                article_type=ArticleType.INDUSTRY_INDICATOR,
                target_table="EVMetric",
                needs_ocr=not has_number,
                dimensions={"brand": "parse_from_title"} if is_brand_specific else {"brand": "INDUSTRY"},
                confidence=0.85
            )

        # 5. Rankings table (CPCA rankings, top-selling)
        if any(kw in title_lower for kw in self.RANKING_KEYWORDS):
            return ClassificationResult(
                article_type=ArticleType.RANKINGS_TABLE,
                target_table="EVMetric",
                needs_ocr=True,  # Rankings always need OCR to get the full table
                dimensions={},
                confidence=0.9
            )

        # 6. Data table summary
        if any(kw in title_lower for kw in self.TABLE_KEYWORDS):
            return ClassificationResult(
                article_type=ArticleType.DATA_TABLE,
                target_table="EVMetric",
                needs_ocr=True,
                dimensions={},
                confidence=0.85
            )

        # 7. Battery data
        if any(kw in title_lower for kw in self.BATTERY_KEYWORDS):
            return ClassificationResult(
                article_type=ArticleType.BATTERY_METRIC,
                target_table="EVMetric",
                needs_ocr=not has_number,
                dimensions={"metric": "BATTERY_INSTALL", "unit": "GWh"},
                confidence=0.9
            )

        # 8. Regular sales/delivery data
        sales_keywords = ["deliveries", "delivery", "sales", "sold", "wholesale"]
        if any(kw in title_lower for kw in sales_keywords):
            return ClassificationResult(
                article_type=ArticleType.BRAND_METRIC,
                target_table="EVMetric",
                needs_ocr=not has_number,
                dimensions={},
                confidence=0.95
            )

        # 9. Default: skip if no clear category
        return ClassificationResult(
            article_type=ArticleType.SKIP,
            target_table=None,
            needs_ocr=False,
            dimensions={},
            confidence=0.5
        )

    def _extract_region(self, title_lower: str) -> Optional[str]:
        """Extract region name from title."""
        for region in self.REGIONS:
            if region in title_lower:
                return region.title()  # Capitalize
        return None

    def _has_brand_name(self, title_lower: str) -> bool:
        """Check if title contains a known brand name."""
        brands = [
            "byd", "nio", "xpeng", "li auto", "li ", "zeekr", "xiaomi",
            "tesla", "geely", "changan", "saic", "gac", "volkswagen",
            "bmw", "mercedes", "audi", "hyundai", "kia", "toyota"
        ]
        return any(brand in title_lower for brand in brands)


# Test function
def test_classifier():
    """Test the article classifier with sample titles."""
    classifier = ArticleClassifier()

    test_cases = [
        # Should NOT need OCR (has numbers in title)
        ("Xpeng deliveries in Jan: 20,011", ""),
        ("BYD NEV sales in Jan: 210,051, down 34% YoY", ""),
        ("Tesla Apr sales breakdown: 13,196 Model 3s", ""),
        ("Shanghai Apr NEV license plates: 45,000", ""),

        # Should need OCR (no numbers in title)
        ("Full CPCA rankings: Top-selling models", ""),
        ("NIO EC7: Main specs", ""),
        ("Data Table: China NEV sales Dec 2025", ""),
        ("Monthly report: China auto imports", ""),
        ("China auto dealer inventory drops", ""),

        # Mixed cases
        ("CATL battery installations in Jan: 25.6 GWh", ""),
        ("BYD Yangwang U9 specifications revealed", ""),
    ]

    for title, summary in test_cases:
        result = classifier.classify(title, summary)
        print(f"\nTitle: {title}")
        print(f"  Type: {result.article_type.value}")
        print(f"  Table: {result.target_table}")
        print(f"  Needs OCR: {result.needs_ocr}")
        print(f"  Dimensions: {result.dimensions}")


if __name__ == "__main__":
    test_classifier()
