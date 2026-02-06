"""Article classifier to determine article type and processing strategy."""

import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class ArticleType(Enum):
    """Types of articles that can be processed."""
    # Time Series - Industry Level
    CHINA_PASSENGER_INVENTORY = "CHINA_PASSENGER_INVENTORY"
    CHINA_BATTERY_INSTALLATION = "CHINA_BATTERY_INSTALLATION"
    CAAM_NEV_SALES = "CAAM_NEV_SALES"
    CHINA_DEALER_INVENTORY_FACTOR = "CHINA_DEALER_INVENTORY_FACTOR"
    CPCA_NEV_RETAIL = "CPCA_NEV_RETAIL"
    CPCA_NEV_PRODUCTION = "CPCA_NEV_PRODUCTION"
    CHINA_VIA_INDEX = "CHINA_VIA_INDEX"

    # Time Series - Entity Specific
    BATTERY_MAKER_MONTHLY = "BATTERY_MAKER_MONTHLY"
    PLANT_EXPORTS = "PLANT_EXPORTS"

    # Rankings/Tables
    AUTOMAKER_RANKINGS = "AUTOMAKER_RANKINGS"
    BATTERY_MAKER_RANKINGS = "BATTERY_MAKER_RANKINGS"
    NEV_SALES_SUMMARY = "NEV_SALES_SUMMARY"

    # Existing types (kept)
    BRAND_METRIC = "BRAND_METRIC"      # Single brand delivery/sales -> EVMetric
    MODEL_BREAKDOWN = "MODEL_BREAKDOWN" # Model-level breakdown -> EVMetric
    REGIONAL_DATA = "REGIONAL_DATA"     # Regional/city level data -> EVMetric
    VEHICLE_SPEC = "VEHICLE_SPEC"       # Vehicle specifications -> VehicleSpec

    SKIP = "SKIP"                       # Skip processing


@dataclass
class ClassificationResult:
    """Result of article classification."""
    article_type: ArticleType
    target_table: Optional[str]  # Table name
    needs_ocr: bool
    dimensions: dict  # Extra dimensions to add to metrics
    confidence: float = 1.0
    ocr_data_type: Optional[str] = None  # "rankings", "trend", "metrics", "specs"


class ArticleClassifier:
    """Classify articles to determine processing strategy."""

    # Title patterns for each new table type
    # Case 1: China passenger car inventory
    PASSENGER_INVENTORY_PATTERNS = [
        r"passenger\s*car\s*inventor",
        r"china\s*(?:auto|car|vehicle)\s*inventor",
    ]

    # Case 4: China battery installation (industry level)
    CHINA_BATTERY_PATTERNS = [
        r"china\s*(?:ev\s*)?battery\s*install",
        r"power\s*battery\s*install.*china",
        r"china\s*power\s*battery",
    ]

    # Case 6: CAAM NEV sales
    CAAM_PATTERNS = [
        r"caam\s*(?:nev|ev|new\s*energy)",
        r"caam.*sales",
        r"nev\s*sales.*(?:by\s*)?caam",
        r"sales\s*data\s*(?:by\s*)?caam",
    ]

    # Case 7: Dealer inventory factor/coefficient
    DEALER_INVENTORY_PATTERNS = [
        r"dealer\s*inventor.*(?:factor|coefficient|ratio)",
        r"inventor.*(?:factor|coefficient).*dealer",
    ]

    # Case 9: CPCA NEV retail
    CPCA_RETAIL_PATTERNS = [
        r"cpca.*nev.*retail",
        r"cpca.*retail.*nev",
        r"nev\s*retail\s*sales.*cpca",
        r"nev\s*retail\s*(?:data\s*)?(?:by\s*)?cpca",
        r"retail\s*(?:data|sales)\s*(?:by\s*)?cpca",
    ]

    # Case 10: CPCA NEV production
    CPCA_PRODUCTION_PATTERNS = [
        r"cpca.*nev.*production",
        r"cpca.*production.*nev",
        r"nev\s*production.*cpca",
        r"nev\s*production\s*(?:data\s*)?(?:by\s*)?cpca",
        r"production\s*(?:data|output)\s*(?:by\s*)?cpca",
    ]

    # Case 11: VIA Index
    VIA_INDEX_PATTERNS = [
        r"via\s*index",
        r"vehicle\s*inventory\s*alert\s*index",
        r"inventory\s*alert\s*index",
    ]

    # Case 12: Battery maker monthly (entity-specific time series)
    BATTERY_MAKER_MONTHLY_PATTERNS = [
        r"(?:catl|byd|lg|sk|panasonic|calb|gotion|eve|sunwoda).*(?:battery|install|gwh)",
        r"(?:battery|install|gwh).*(?:catl|byd|lg|sk|panasonic|calb|gotion|eve|sunwoda)",
    ]

    # Case 13: Plant exports
    PLANT_EXPORTS_PATTERNS = [
        r"(?:tesla|byd).*(?:shanghai|shenzhen|changsha).*export",
        r"(?:shanghai|shenzhen|changsha).*(?:plant|factory).*export",
        r"export.*(?:tesla|byd).*(?:shanghai|shenzhen|changsha)",
    ]

    # Cases 2,5: NEV sales summary (date range)
    NEV_SALES_SUMMARY_PATTERNS = [
        r"nev\s*sales.*\d{1,2}[-/]\d{1,2}",  # "NEV sales Jan 1-18"
        r"\d{1,2}[-/]\d{1,2}.*nev\s*sales",
        r"cpca.*weekly.*nev",
        r"weekly.*cpca.*nev",
    ]

    # Case 8: Automaker rankings
    AUTOMAKER_RANKINGS_PATTERNS = [
        r"cpca.*(?:top|ranking).*(?:automaker|brand|maker)",
        r"(?:top|ranking).*(?:automaker|brand|maker).*cpca",
        r"top[-\s]*(?:10|20|15).*(?:automaker|brand|maker)",
        r"(?:automaker|brand|maker).*(?:top|ranking)",
    ]

    # Cases 3,14: Battery maker rankings
    BATTERY_MAKER_RANKINGS_PATTERNS = [
        r"top.*battery\s*maker",
        r"battery\s*maker.*(?:ranking|top)",
        r"(?:cabia|sne).*battery.*ranking",
        r"global.*battery.*ranking",
    ]

    # Existing patterns
    SPEC_KEYWORDS = ["main specs", "specifications", "spec sheet", "key specs"]
    BREAKDOWN_KEYWORDS = ["breakdown", "model breakdown", "by model"]

    REGIONS = [
        "shanghai", "beijing", "guangdong", "shenzhen", "hangzhou",
        "guangzhou", "jiangsu", "zhejiang", "sichuan", "chengdu",
        "tianjin", "chongqing", "hubei", "wuhan"
    ]

    BATTERY_MAKERS = [
        "catl", "byd", "lg", "sk", "panasonic", "calb", "gotion",
        "eve", "sunwoda", "svolt", "lishen", "farasis"
    ]

    def __init__(self):
        self._number_pattern = re.compile(r'\d{1,3}(?:,\d{3})+|\d{4,}')

        # Compile all patterns
        self._passenger_inventory_re = [re.compile(p, re.IGNORECASE) for p in self.PASSENGER_INVENTORY_PATTERNS]
        self._china_battery_re = [re.compile(p, re.IGNORECASE) for p in self.CHINA_BATTERY_PATTERNS]
        self._caam_re = [re.compile(p, re.IGNORECASE) for p in self.CAAM_PATTERNS]
        self._dealer_inventory_re = [re.compile(p, re.IGNORECASE) for p in self.DEALER_INVENTORY_PATTERNS]
        self._cpca_retail_re = [re.compile(p, re.IGNORECASE) for p in self.CPCA_RETAIL_PATTERNS]
        self._cpca_production_re = [re.compile(p, re.IGNORECASE) for p in self.CPCA_PRODUCTION_PATTERNS]
        self._via_index_re = [re.compile(p, re.IGNORECASE) for p in self.VIA_INDEX_PATTERNS]
        self._battery_maker_monthly_re = [re.compile(p, re.IGNORECASE) for p in self.BATTERY_MAKER_MONTHLY_PATTERNS]
        self._plant_exports_re = [re.compile(p, re.IGNORECASE) for p in self.PLANT_EXPORTS_PATTERNS]
        self._nev_sales_summary_re = [re.compile(p, re.IGNORECASE) for p in self.NEV_SALES_SUMMARY_PATTERNS]
        self._automaker_rankings_re = [re.compile(p, re.IGNORECASE) for p in self.AUTOMAKER_RANKINGS_PATTERNS]
        self._battery_maker_rankings_re = [re.compile(p, re.IGNORECASE) for p in self.BATTERY_MAKER_RANKINGS_PATTERNS]

    def _has_number(self, text: str) -> bool:
        """Check if text contains significant numbers."""
        return bool(self._number_pattern.search(text))

    def _match_any(self, patterns: list, text: str) -> bool:
        """Check if any pattern matches the text."""
        return any(p.search(text) for p in patterns)

    def _extract_battery_maker(self, title_lower: str) -> Optional[str]:
        """Extract battery maker name from title."""
        for maker in self.BATTERY_MAKERS:
            if maker in title_lower:
                return maker.upper()
        return None

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

        # ========================================
        # NEW TABLES - Check in priority order
        # ========================================

        # 1. VIA Index (high priority - specific indicator)
        if self._match_any(self._via_index_re, title_lower):
            return ClassificationResult(
                article_type=ArticleType.CHINA_VIA_INDEX,
                target_table="ChinaViaIndex",
                needs_ocr=not has_number,
                dimensions={},
                confidence=0.95,
                ocr_data_type="chart",
            )

        # 2. Dealer inventory factor/coefficient
        if self._match_any(self._dealer_inventory_re, title_lower):
            return ClassificationResult(
                article_type=ArticleType.CHINA_DEALER_INVENTORY_FACTOR,
                target_table="ChinaDealerInventoryFactor",
                needs_ocr=not has_number,
                dimensions={},
                confidence=0.95,
                ocr_data_type="chart",
            )

        # 3. Battery maker rankings (global or China)
        if self._match_any(self._battery_maker_rankings_re, title_lower):
            scope = "GLOBAL" if "global" in title_lower else "CHINA"
            return ClassificationResult(
                article_type=ArticleType.BATTERY_MAKER_RANKINGS,
                target_table="BatteryMakerRankings",
                needs_ocr=True,  # Rankings always need OCR for full table
                dimensions={"scope": scope},
                confidence=0.9,
                ocr_data_type="rankings",
            )

        # 4. Automaker rankings
        if self._match_any(self._automaker_rankings_re, title_lower):
            return ClassificationResult(
                article_type=ArticleType.AUTOMAKER_RANKINGS,
                target_table="AutomakerRankings",
                needs_ocr=True,  # Rankings always need OCR for full table
                dimensions={},
                confidence=0.9,
                ocr_data_type="rankings",
            )

        # 5. NEV sales summary (date range) — trend chart with daily/weekly data
        if self._match_any(self._nev_sales_summary_re, title_lower):
            return ClassificationResult(
                article_type=ArticleType.NEV_SALES_SUMMARY,
                target_table="NevSalesSummary",
                needs_ocr=not has_number,
                dimensions={},
                confidence=0.9,
                ocr_data_type="trend",
            )

        # 6. Plant exports (Tesla Shanghai, etc.)
        if self._match_any(self._plant_exports_re, title_lower):
            return ClassificationResult(
                article_type=ArticleType.PLANT_EXPORTS,
                target_table="PlantExports",
                needs_ocr=not has_number,
                dimensions={},
                confidence=0.9,
                ocr_data_type="chart",
            )

        # 7. Battery maker monthly (entity-specific: CATL, BYD battery data)
        battery_maker = self._extract_battery_maker(title_lower)
        if battery_maker and self._match_any(self._battery_maker_monthly_re, title_lower):
            return ClassificationResult(
                article_type=ArticleType.BATTERY_MAKER_MONTHLY,
                target_table="BatteryMakerMonthly",
                needs_ocr=not has_number,
                dimensions={"maker": battery_maker},
                confidence=0.9,
                ocr_data_type="chart",
            )

        # 8. China battery installation (industry-wide)
        if self._match_any(self._china_battery_re, title_lower):
            return ClassificationResult(
                article_type=ArticleType.CHINA_BATTERY_INSTALLATION,
                target_table="ChinaBatteryInstallation",
                needs_ocr=not has_number,
                dimensions={},
                confidence=0.9,
                ocr_data_type="chart",
            )

        # 9. CAAM NEV sales
        if self._match_any(self._caam_re, title_lower):
            return ClassificationResult(
                article_type=ArticleType.CAAM_NEV_SALES,
                target_table="CaamNevSales",
                needs_ocr=not has_number,
                dimensions={},
                confidence=0.9,
                ocr_data_type="chart",
            )

        # 10. CPCA NEV production
        if self._match_any(self._cpca_production_re, title_lower):
            return ClassificationResult(
                article_type=ArticleType.CPCA_NEV_PRODUCTION,
                target_table="CpcaNevProduction",
                needs_ocr=not has_number,
                dimensions={},
                confidence=0.9,
                ocr_data_type="chart",
            )

        # 11. CPCA NEV retail
        if self._match_any(self._cpca_retail_re, title_lower):
            return ClassificationResult(
                article_type=ArticleType.CPCA_NEV_RETAIL,
                target_table="CpcaNevRetail",
                needs_ocr=not has_number,
                dimensions={},
                confidence=0.9,
                ocr_data_type="chart",
            )

        # 12. Passenger car inventory
        if self._match_any(self._passenger_inventory_re, title_lower):
            return ClassificationResult(
                article_type=ArticleType.CHINA_PASSENGER_INVENTORY,
                target_table="ChinaPassengerInventory",
                needs_ocr=not has_number,
                dimensions={},
                confidence=0.9,
                ocr_data_type="chart",
            )

        # ========================================
        # EXISTING TABLES (EVMetric, VehicleSpec)
        # ========================================

        # Vehicle specs -> VehicleSpec table
        if any(kw in title_lower for kw in self.SPEC_KEYWORDS):
            return ClassificationResult(
                article_type=ArticleType.VEHICLE_SPEC,
                target_table="VehicleSpec",
                needs_ocr=True,
                dimensions={},
                confidence=0.95,
                ocr_data_type="specs",
            )

        # Model breakdown (e.g., "Tesla Apr sales breakdown: 13,196 Model 3s")
        if any(kw in title_lower for kw in self.BREAKDOWN_KEYWORDS):
            return ClassificationResult(
                article_type=ArticleType.MODEL_BREAKDOWN,
                target_table="EVMetric",
                needs_ocr=not has_number,
                dimensions={"vehicleModel": "parse_from_content"},
                confidence=0.9
            )

        # Regional data (Shanghai, Beijing, etc.)
        region = self._extract_region(title_lower)
        if region:
            return ClassificationResult(
                article_type=ArticleType.REGIONAL_DATA,
                target_table="EVMetric",
                needs_ocr=not has_number,
                dimensions={"region": region},
                confidence=0.9
            )

        # Regular sales/delivery data -> EVMetric (for brand deliveries)
        sales_keywords = ["deliveries", "delivery", "sales", "sold", "wholesale"]
        if any(kw in title_lower for kw in sales_keywords):
            return ClassificationResult(
                article_type=ArticleType.BRAND_METRIC,
                target_table="EVMetric",
                needs_ocr=not has_number,
                dimensions={},
                confidence=0.95
            )

        # Default: skip if no clear category
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
        # NEW TABLES
        # Case 1: China Passenger Inventory
        ("China passenger car inventory reaches 3.2 million units in Jan", "ChinaPassengerInventory"),

        # Case 4: China Battery Installation
        ("China EV battery installations hit 45.2 GWh in Jan", "ChinaBatteryInstallation"),

        # Case 6: CAAM NEV sales
        ("CAAM NEV sales: 1.2 million vehicles in Jan 2025", "CaamNevSales"),

        # Case 7: Dealer inventory factor
        ("China dealer inventory factor rises to 1.31 in Jan", "ChinaDealerInventoryFactor"),

        # Case 9: CPCA NEV retail
        ("CPCA: NEV retail sales reach 850,000 in Jan", "CpcaNevRetail"),

        # Case 10: CPCA NEV production
        ("CPCA: NEV production hits 920,000 in Jan", "CpcaNevProduction"),

        # Case 11: VIA Index
        ("China vehicle inventory alert index rises to 59.4% in Jan", "ChinaViaIndex"),

        # Case 12: Battery maker monthly
        ("CATL battery installations in Jan: 25.6 GWh", "BatteryMakerMonthly"),
        ("BYD battery installations hit 12.3 GWh in Jan", "BatteryMakerMonthly"),

        # Case 13: Plant exports
        ("Tesla Shanghai exports 35,000 vehicles in Jan", "PlantExports"),

        # Cases 2,5: NEV sales summary
        ("CPCA: NEV sales Jan 1-18 reach 420,000", "NevSalesSummary"),

        # Case 8: Automaker rankings
        ("CPCA top-selling automakers Jan 2025", "AutomakerRankings"),

        # Cases 3,14: Battery maker rankings
        ("Top battery makers China Jan 2025", "BatteryMakerRankings"),
        ("Global battery maker rankings 2024", "BatteryMakerRankings"),

        # EXISTING TABLES (EVMetric)
        ("Xpeng deliveries in Jan: 20,011", "EVMetric"),
        ("BYD NEV sales in Jan: 210,051, down 34% YoY", "EVMetric"),
        ("Shanghai Apr NEV license plates: 45,000", "EVMetric"),

        # VehicleSpec
        ("NIO EC7: Main specs", "VehicleSpec"),
    ]

    print("=" * 80)
    print("Article Classifier Test Results")
    print("=" * 80)

    for title, expected_table in test_cases:
        result = classifier.classify(title, "")
        status = "✓" if result.target_table == expected_table else "✗"
        print(f"\n{status} Title: {title}")
        print(f"  Expected: {expected_table}")
        print(f"  Got:      {result.target_table} ({result.article_type.value})")
        print(f"  OCR:      {result.needs_ocr}")
        if result.dimensions:
            print(f"  Dims:     {result.dimensions}")


if __name__ == "__main__":
    test_classifier()
