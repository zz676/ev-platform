"""Unit tests using real article titles from cnevdata.com pages 1-5.

No network access required. Tests verify classification, extraction,
title parsing, and end-to-end pipeline using actual article titles.

Each title is paired with its published_date (from the article URL), which
is the authoritative source for year when the title lacks an explicit year.
"""

import pytest
from datetime import datetime

from extractors.classifier import ArticleClassifier, ArticleType
from extractors.industry_extractor import IndustryDataExtractor
from extractors.title_parser import TitleParser


# ==============================================================================
# Test data: real titles from cnevdata.com pages 1-5
# published_date comes from the article URL (e.g. /2025/02/05/...)
# ==============================================================================

# Brand metrics -> EVMetric table
BRAND_METRIC_TITLES = [
    # (title, published_date, expected_brand, expected_value, expected_month, expected_year)
    ("Tesla China wholesale sales in Jan: 69,129", datetime(2025, 2, 3), "TESLA_CHINA", 69129, 1, 2025),
    ("BYD NEV sales in Jan: 210,051", datetime(2025, 2, 3), "BYD", 210051, 1, 2025),
    ("Geely Auto sales in Jan: 270,167", datetime(2025, 2, 3), "GEELY", 270167, 1, 2025),
    ("Nio deliveries in Jan: 27,182", datetime(2025, 2, 3), "NIO", 27182, 1, 2025),
    ("Xpeng deliveries in Jan: 20,011", datetime(2025, 2, 1), "XPENG", 20011, 1, 2025),
    ("Li Auto deliveries in Jan: 27,668", datetime(2025, 2, 1), "LI_AUTO", 27668, 1, 2025),
    ("Leapmotor deliveries in Jan: 32,059", datetime(2025, 2, 1), "LEAPMOTOR", 32059, 1, 2025),
    ("Tesla sales in China in Dec: 93,843", datetime(2025, 1, 2), "TESLA_CHINA", 93843, 12, 2024),
    ("BYD NEV sales in Dec: 420,398", datetime(2025, 1, 1), "BYD", 420398, 12, 2024),
    ("Tesla China car sales in Nov: 86,700", datetime(2024, 12, 2), "TESLA_CHINA", 86700, 11, 2024),
]

# Industry tables: classification targets (classification doesn't need dates)
INDUSTRY_CLASSIFICATION_TITLES = [
    # (title, expected_table, expected_article_type)
    (
        "China vehicle inventory alert index rises to 59.4% in Jan",
        "ChinaViaIndex",
        ArticleType.CHINA_VIA_INDEX,
    ),
    (
        "China vehicle inventory alert index rises to 57.7% in Dec",
        "ChinaViaIndex",
        ArticleType.CHINA_VIA_INDEX,
    ),
    (
        "China auto dealer inventory factor falls to 1.31 in Dec",
        "ChinaDealerInventoryFactor",
        ArticleType.CHINA_DEALER_INVENTORY_FACTOR,
    ),
    (
        "China auto dealer inventory factor rises to 1.57 in Nov",
        "ChinaDealerInventoryFactor",
        ArticleType.CHINA_DEALER_INVENTORY_FACTOR,
    ),
    (
        "China passenger car inventory at end of Dec: 3.65 million",
        "ChinaPassengerInventory",
        ArticleType.CHINA_PASSENGER_INVENTORY,
    ),
    (
        "China EV battery installations in Dec: 98.1 GWh",
        "ChinaBatteryInstallation",
        ArticleType.CHINA_BATTERY_INSTALLATION,
    ),
    (
        "China EV battery installations in Nov: 93.5 GWh",
        "ChinaBatteryInstallation",
        ArticleType.CHINA_BATTERY_INSTALLATION,
    ),
    (
        "China Dec NEV sales data by CAAM: 1,710,000",
        "CaamNevSales",
        ArticleType.CAAM_NEV_SALES,
    ),
    (
        "China Nov NEV sales data by CAAM: 1,823,000",
        "CaamNevSales",
        ArticleType.CAAM_NEV_SALES,
    ),
    (
        "China Dec NEV retail data by CPCA: 1,337,000",
        "CpcaNevRetail",
        ArticleType.CPCA_NEV_RETAIL,
    ),
    (
        "China Nov NEV retail data by CPCA: 1,321,000",
        "CpcaNevRetail",
        ArticleType.CPCA_NEV_RETAIL,
    ),
    (
        "China Nov NEV production data by CPCA: 1,757,000",
        "CpcaNevProduction",
        ArticleType.CPCA_NEV_PRODUCTION,
    ),
]

# Industry extraction: expected values (with published_date for year inference)
INDUSTRY_EXTRACTION_TITLES = [
    # (title, published_date, expected_table, expected_key, expected_value, expected_year)
    (
        "China vehicle inventory alert index rises to 59.4% in Jan",
        datetime(2025, 2, 10),
        "ChinaViaIndex",
        "value",
        59.4,
        2025,
    ),
    (
        "China vehicle inventory alert index rises to 57.7% in Dec",
        datetime(2025, 1, 14),
        "ChinaViaIndex",
        "value",
        57.7,
        2024,
    ),
    (
        "China auto dealer inventory factor falls to 1.31 in Dec",
        datetime(2025, 1, 7),
        "ChinaDealerInventoryFactor",
        "value",
        1.31,
        2024,
    ),
    (
        "China auto dealer inventory factor rises to 1.57 in Nov",
        datetime(2024, 12, 3),
        "ChinaDealerInventoryFactor",
        "value",
        1.57,
        2024,
    ),
    (
        "China passenger car inventory at end of Dec: 3.65 million",
        datetime(2025, 1, 20),
        "ChinaPassengerInventory",
        "value",
        3_650_000,
        2024,
    ),
    (
        "China EV battery installations in Dec: 98.1 GWh",
        datetime(2025, 1, 13),
        "ChinaBatteryInstallation",
        "installation",
        98.1,
        2024,
    ),
    (
        "China EV battery installations in Nov: 93.5 GWh",
        datetime(2024, 12, 12),
        "ChinaBatteryInstallation",
        "installation",
        93.5,
        2024,
    ),
    (
        "China Dec NEV sales data by CAAM: 1,710,000",
        datetime(2025, 1, 14),
        "CaamNevSales",
        "value",
        1_710_000,
        2024,
    ),
    (
        "China Nov NEV sales data by CAAM: 1,823,000",
        datetime(2024, 12, 11),
        "CaamNevSales",
        "value",
        1_823_000,
        2024,
    ),
    (
        "China Dec NEV retail data by CPCA: 1,337,000",
        datetime(2025, 1, 9),
        "CpcaNevRetail",
        "value",
        1_337_000,
        2024,
    ),
    (
        "China Nov NEV retail data by CPCA: 1,321,000",
        datetime(2024, 12, 9),
        "CpcaNevRetail",
        "value",
        1_321_000,
        2024,
    ),
    (
        "China Nov NEV production data by CPCA: 1,757,000",
        datetime(2024, 12, 10),
        "CpcaNevProduction",
        "value",
        1_757_000,
        2024,
    ),
]

# Entity-specific titles (with published_date)
ENTITY_SPECIFIC_TITLES = [
    # (title, published_date, expected_table, expected_fields)
    (
        "BYD battery installations in Jan: 20.187 GWh",
        datetime(2025, 2, 11),
        "BatteryMakerMonthly",
        {"maker": "BYD", "installation": 20.187, "year": 2025},
    ),
    (
        "BYD battery installations in Dec: 27.352 GWh",
        datetime(2025, 1, 13),
        "BatteryMakerMonthly",
        {"maker": "BYD", "installation": 27.352, "year": 2024},
    ),
    (
        "Tesla Shanghai plant exports in Dec: 3,328",
        datetime(2025, 1, 8),
        "PlantExports",
        {"plant": "Tesla Shanghai", "value": 3328, "year": 2024},
    ),
    (
        "Tesla Shanghai plant exports in Nov: 13,555",
        datetime(2024, 12, 9),
        "PlantExports",
        {"plant": "Tesla Shanghai", "value": 13555, "year": 2024},
    ),
]

# NEV Sales Summary (date range) titles (with published_date)
NEV_SALES_SUMMARY_TITLES = [
    # (title, published_date, expected_start_date, expected_end_date)
    ("Data table: China NEV sales in Jan 1-18", datetime(2025, 1, 20), "01-01", "01-18"),
    ("Data table: China NEV sales in Jan 1-11", datetime(2025, 1, 13), "01-01", "01-11"),
    ("Data table: China NEV sales in Dec 1-31", datetime(2025, 1, 6), "12-01", "12-31"),
    ("Data table: China NEV sales in Dec 1-28", datetime(2024, 12, 30), "12-01", "12-28"),
]

# Rankings titles (need OCR)
RANKINGS_TITLES = [
    # (title, expected_table, needs_ocr, extra_checks)
    (
        "Data table: Top EV battery makers' global installations in 2025",
        "BatteryMakerRankings",
        True,
        {"scope": "GLOBAL"},
    ),
    (
        "Data table: Top EV battery makers' installations in China in Dec and full-year 2025",
        "BatteryMakerRankings",
        True,
        {"scope": "CHINA"},
    ),
    (
        "CPCA rankings: Top-selling automakers in China in Dec 2025",
        "AutomakerRankings",
        True,
        {},
    ),
]


# ==============================================================================
# Test classes
# ==============================================================================


class TestClassificationWithRealTitles:
    """Verify real titles are classified to the correct target table."""

    def setup_method(self):
        self.classifier = ArticleClassifier()

    @pytest.mark.parametrize(
        "title,published_date,expected_brand,expected_value,expected_month,expected_year",
        BRAND_METRIC_TITLES,
        ids=[t[0][:50] for t in BRAND_METRIC_TITLES],
    )
    def test_brand_metric_classification(
        self, title, published_date, expected_brand, expected_value,
        expected_month, expected_year,
    ):
        result = self.classifier.classify(title)
        assert result.target_table == "EVMetric", (
            f"Expected EVMetric for '{title}', got {result.target_table}"
        )
        assert result.article_type == ArticleType.BRAND_METRIC

    @pytest.mark.parametrize(
        "title,expected_table,expected_type",
        INDUSTRY_CLASSIFICATION_TITLES,
        ids=[t[0][:50] for t in INDUSTRY_CLASSIFICATION_TITLES],
    )
    def test_industry_table_classification(self, title, expected_table, expected_type):
        result = self.classifier.classify(title)
        assert result.target_table == expected_table, (
            f"Expected {expected_table} for '{title}', got {result.target_table}"
        )
        assert result.article_type == expected_type

    @pytest.mark.parametrize(
        "title,published_date,expected_table,expected_fields",
        ENTITY_SPECIFIC_TITLES,
        ids=[t[0][:50] for t in ENTITY_SPECIFIC_TITLES],
    )
    def test_entity_specific_classification(
        self, title, published_date, expected_table, expected_fields
    ):
        result = self.classifier.classify(title)
        assert result.target_table == expected_table, (
            f"Expected {expected_table} for '{title}', got {result.target_table}"
        )

    @pytest.mark.parametrize(
        "title,published_date,expected_start,expected_end",
        NEV_SALES_SUMMARY_TITLES,
        ids=[t[0][:50] for t in NEV_SALES_SUMMARY_TITLES],
    )
    def test_nev_sales_summary_classification(
        self, title, published_date, expected_start, expected_end
    ):
        result = self.classifier.classify(title)
        assert result.target_table == "NevSalesSummary", (
            f"Expected NevSalesSummary for '{title}', got {result.target_table}"
        )
        assert result.ocr_data_type == "trend"

    @pytest.mark.parametrize(
        "title,expected_table,needs_ocr,extra_checks",
        RANKINGS_TITLES,
        ids=[t[0][:50] for t in RANKINGS_TITLES],
    )
    def test_rankings_classification(
        self, title, expected_table, needs_ocr, extra_checks
    ):
        result = self.classifier.classify(title)
        assert result.target_table == expected_table, (
            f"Expected {expected_table} for '{title}', got {result.target_table}"
        )
        assert result.needs_ocr == needs_ocr
        assert result.ocr_data_type == "rankings"
        for key, value in extra_checks.items():
            assert result.dimensions.get(key) == value, (
                f"Expected dimensions[{key}]={value}, "
                f"got {result.dimensions.get(key)}"
            )


class TestExtractionWithRealTitles:
    """Verify extraction produces correct values from real titles."""

    def setup_method(self):
        self.classifier = ArticleClassifier()
        self.extractor = IndustryDataExtractor()

    def _classify_and_extract(self, title, published_date=None):
        classification = self.classifier.classify(title)
        return self.extractor.extract(
            title=title,
            summary="",
            classification=classification,
            source_url="https://cnevdata.com/test",
            source_title=title,
            published_date=published_date,
        )

    @pytest.mark.parametrize(
        "title,published_date,expected_table,expected_key,expected_value,expected_year",
        INDUSTRY_EXTRACTION_TITLES,
        ids=[t[0][:50] for t in INDUSTRY_EXTRACTION_TITLES],
    )
    def test_industry_extraction_values(
        self, title, published_date, expected_table, expected_key,
        expected_value, expected_year,
    ):
        result = self._classify_and_extract(title, published_date=published_date)
        assert result is not None, f"Extraction returned None for '{title}'"
        assert result.success, f"Extraction failed for '{title}': {result.error}"
        assert result.table_name == expected_table
        assert result.data[expected_key] == pytest.approx(expected_value, rel=1e-3), (
            f"Expected {expected_key}={expected_value}, "
            f"got {result.data.get(expected_key)}"
        )
        assert result.data["year"] == expected_year, (
            f"Expected year={expected_year}, got {result.data.get('year')}"
        )

    @pytest.mark.parametrize(
        "title,published_date,expected_table,expected_fields",
        ENTITY_SPECIFIC_TITLES,
        ids=[t[0][:50] for t in ENTITY_SPECIFIC_TITLES],
    )
    def test_entity_specific_extraction(
        self, title, published_date, expected_table, expected_fields
    ):
        result = self._classify_and_extract(title, published_date=published_date)
        assert result is not None, f"Extraction returned None for '{title}'"
        assert result.success, f"Extraction failed for '{title}': {result.error}"
        assert result.table_name == expected_table
        for key, value in expected_fields.items():
            if isinstance(value, float):
                assert result.data[key] == pytest.approx(value, rel=1e-3), (
                    f"Expected {key}={value}, got {result.data.get(key)}"
                )
            else:
                assert result.data[key] == value, (
                    f"Expected {key}={value}, got {result.data.get(key)}"
                )

    @pytest.mark.parametrize(
        "title,published_date,expected_start,expected_end",
        NEV_SALES_SUMMARY_TITLES,
        ids=[t[0][:50] for t in NEV_SALES_SUMMARY_TITLES],
    )
    def test_nev_sales_summary_data_table_skips_extraction(
        self, title, published_date, expected_start, expected_end
    ):
        """'Data table:' titles have no numeric value — extraction should
        return failure so the article falls through to OCR instead of
        making a doomed API call with missing retailSales."""
        result = self._classify_and_extract(title, published_date=published_date)
        assert result is not None
        assert not result.success

    def test_via_index_unit_is_percent(self):
        result = self._classify_and_extract(
            "China vehicle inventory alert index rises to 59.4% in Jan",
            published_date=datetime(2025, 2, 10),
        )
        assert result.success
        assert result.data["unit"] == "percent"

    def test_battery_installation_unit_is_gwh(self):
        result = self._classify_and_extract(
            "China EV battery installations in Dec: 98.1 GWh",
            published_date=datetime(2025, 1, 13),
        )
        assert result.success
        assert result.data["unit"] == "GWh"

    def test_dealer_inventory_factor_unit_is_factor(self):
        result = self._classify_and_extract(
            "China auto dealer inventory factor falls to 1.31 in Dec",
            published_date=datetime(2025, 1, 7),
        )
        assert result.success
        assert result.data["unit"] == "factor"

    def test_battery_maker_monthly_unit_is_gwh(self):
        result = self._classify_and_extract(
            "BYD battery installations in Jan: 20.187 GWh",
            published_date=datetime(2025, 2, 11),
        )
        assert result.success
        assert result.data["unit"] == "GWh"

    def test_source_url_included(self):
        result = self._classify_and_extract(
            "China EV battery installations in Dec: 98.1 GWh",
            published_date=datetime(2025, 1, 13),
        )
        assert result.data["sourceUrl"] == "https://cnevdata.com/test"

    def test_source_title_included(self):
        title = "China EV battery installations in Dec: 98.1 GWh"
        result = self._classify_and_extract(title, published_date=datetime(2025, 1, 13))
        assert result.data["sourceTitle"] == title


class TestTitleParserWithRealTitles:
    """Verify title parser extracts brand, metric type, and value correctly."""

    def setup_method(self):
        self.parser = TitleParser()

    @pytest.mark.parametrize(
        "title,published_date,expected_brand,expected_value,expected_month,expected_year",
        BRAND_METRIC_TITLES,
        ids=[t[0][:50] for t in BRAND_METRIC_TITLES],
    )
    def test_brand_metric_parsing(
        self, title, published_date, expected_brand, expected_value,
        expected_month, expected_year,
    ):
        parsed = self.parser.parse(title, published_date)
        assert parsed is not None, f"Parser returned None for '{title}'"
        assert parsed.brand == expected_brand, (
            f"Expected brand={expected_brand}, got {parsed.brand}"
        )
        assert parsed.value == expected_value, (
            f"Expected value={expected_value}, got {parsed.value}"
        )
        assert parsed.month == expected_month, (
            f"Expected month={expected_month}, got {parsed.month}"
        )
        assert parsed.year == expected_year, (
            f"Expected year={expected_year}, got {parsed.year}"
        )

    def test_metric_type_delivery(self):
        parsed = self.parser.parse("Nio deliveries in Jan: 27,182")
        assert parsed is not None
        assert parsed.metric_type == "DELIVERY"

    def test_metric_type_sales(self):
        parsed = self.parser.parse("BYD NEV sales in Jan: 210,051")
        assert parsed is not None
        assert parsed.metric_type == "SALES"

    def test_metric_type_wholesale(self):
        parsed = self.parser.parse("Tesla China wholesale sales in Jan: 69,129")
        assert parsed is not None
        assert parsed.metric_type == "WHOLESALE"

    def test_needs_ocr_when_no_numbers(self):
        # Title with no numbers at all should need OCR
        assert self.parser.needs_ocr("CPCA top-selling automakers in China")

    def test_needs_ocr_year_only_treated_as_number(self):
        # Known behavior: year "2025" is treated as a significant number
        # by TitleParser.has_number, so needs_ocr returns False.
        # The classifier handles this correctly via its own _has_number check.
        assert not self.parser.needs_ocr(
            "CPCA rankings: Top-selling automakers in China in Dec 2025"
        )

    def test_no_ocr_when_numbers_present(self):
        assert not self.parser.needs_ocr("BYD NEV sales in Jan: 210,051")


class TestEndToEndPipeline:
    """Full classify -> extract -> validate for select real articles."""

    def setup_method(self):
        self.classifier = ArticleClassifier()
        self.extractor = IndustryDataExtractor()
        self.title_parser = TitleParser()

    def _full_pipeline(self, title, published_date=None):
        """Run full pipeline: classify -> extract -> return all results."""
        classification = self.classifier.classify(title)
        extraction = self.extractor.extract(
            title=title,
            summary="",
            classification=classification,
            source_url="https://cnevdata.com/test",
            source_title=title,
            published_date=published_date,
        )
        parsed = self.title_parser.parse(title, published_date)
        return classification, extraction, parsed

    def test_tesla_china_wholesale_end_to_end(self):
        title = "Tesla China wholesale sales in Jan: 69,129"
        pub_date = datetime(2025, 2, 3)
        classification, extraction, parsed = self._full_pipeline(title, pub_date)

        # Classification
        assert classification.target_table == "EVMetric"
        assert classification.article_type == ArticleType.BRAND_METRIC
        assert classification.needs_ocr is False

        # Title parser
        assert parsed is not None
        assert parsed.brand == "TESLA_CHINA"
        assert parsed.value == 69129
        assert parsed.month == 1
        assert parsed.year == 2025
        assert parsed.metric_type == "WHOLESALE"

    def test_byd_nev_sales_end_to_end(self):
        title = "BYD NEV sales in Jan: 210,051"
        pub_date = datetime(2025, 2, 3)
        classification, extraction, parsed = self._full_pipeline(title, pub_date)

        assert classification.target_table == "EVMetric"
        assert parsed is not None
        assert parsed.brand == "BYD"
        assert parsed.value == 210051
        assert parsed.year == 2025

    def test_via_index_end_to_end(self):
        title = "China vehicle inventory alert index rises to 59.4% in Jan"
        pub_date = datetime(2025, 2, 10)
        classification, extraction, parsed = self._full_pipeline(title, pub_date)

        assert classification.target_table == "ChinaViaIndex"
        assert extraction is not None
        assert extraction.success
        assert extraction.data["value"] == 59.4
        assert extraction.data["unit"] == "percent"
        assert extraction.data["year"] == 2025

    def test_battery_installation_end_to_end(self):
        title = "China EV battery installations in Dec: 98.1 GWh"
        pub_date = datetime(2025, 1, 13)
        classification, extraction, parsed = self._full_pipeline(title, pub_date)

        assert classification.target_table == "ChinaBatteryInstallation"
        assert extraction is not None
        assert extraction.success
        assert extraction.data["installation"] == 98.1
        assert extraction.data["unit"] == "GWh"
        assert extraction.data["month"] == 12
        assert extraction.data["year"] == 2024

    def test_caam_nev_sales_end_to_end(self):
        title = "China Dec NEV sales data by CAAM: 1,710,000"
        pub_date = datetime(2025, 1, 14)
        classification, extraction, parsed = self._full_pipeline(title, pub_date)

        assert classification.target_table == "CaamNevSales"
        assert extraction is not None
        assert extraction.success
        assert extraction.data["value"] == 1_710_000
        assert extraction.data["month"] == 12
        assert extraction.data["year"] == 2024

    def test_dealer_inventory_factor_end_to_end(self):
        title = "China auto dealer inventory factor falls to 1.31 in Dec"
        pub_date = datetime(2025, 1, 7)
        classification, extraction, parsed = self._full_pipeline(title, pub_date)

        assert classification.target_table == "ChinaDealerInventoryFactor"
        assert extraction is not None
        assert extraction.success
        assert extraction.data["value"] == 1.31
        assert extraction.data["year"] == 2024

    def test_cpca_retail_end_to_end(self):
        title = "China Dec NEV retail data by CPCA: 1,337,000"
        pub_date = datetime(2025, 1, 9)
        classification, extraction, parsed = self._full_pipeline(title, pub_date)

        assert classification.target_table == "CpcaNevRetail"
        assert extraction is not None
        assert extraction.success
        assert extraction.data["value"] == 1_337_000
        assert extraction.data["year"] == 2024

    def test_byd_battery_maker_end_to_end(self):
        """BYD battery installations should go to BatteryMakerMonthly, not EVMetric."""
        title = "BYD battery installations in Jan: 20.187 GWh"
        pub_date = datetime(2025, 2, 11)
        classification, extraction, parsed = self._full_pipeline(title, pub_date)

        assert classification.target_table == "BatteryMakerMonthly"
        assert classification.article_type == ArticleType.BATTERY_MAKER_MONTHLY
        assert extraction is not None
        assert extraction.success
        assert extraction.data["maker"] == "BYD"
        assert extraction.data["installation"] == 20.187
        assert extraction.data["year"] == 2025

    def test_tesla_shanghai_exports_end_to_end(self):
        title = "Tesla Shanghai plant exports in Dec: 3,328"
        pub_date = datetime(2025, 1, 8)
        classification, extraction, parsed = self._full_pipeline(title, pub_date)

        assert classification.target_table == "PlantExports"
        assert extraction is not None
        assert extraction.success
        assert extraction.data["plant"] == "Tesla Shanghai"
        assert extraction.data["value"] == 3328
        assert extraction.data["year"] == 2024

    def test_nev_sales_summary_end_to_end(self):
        title = "Data table: China NEV sales in Jan 1-18"
        pub_date = datetime(2025, 1, 20)
        classification, extraction, parsed = self._full_pipeline(title, pub_date)

        assert classification.target_table == "NevSalesSummary"

    def test_automaker_rankings_end_to_end(self):
        title = "CPCA rankings: Top-selling automakers in China in Dec 2025"
        pub_date = datetime(2026, 1, 10)
        classification, extraction, parsed = self._full_pipeline(title, pub_date)

        assert classification.target_table == "AutomakerRankings"
        assert classification.needs_ocr is True
        if extraction and extraction.success:
            assert extraction.data.get("_needs_ocr") is True

    def test_battery_rankings_global_end_to_end(self):
        title = "Data table: Top EV battery makers' global installations in 2025"
        pub_date = datetime(2026, 1, 15)
        classification, extraction, parsed = self._full_pipeline(title, pub_date)

        assert classification.target_table == "BatteryMakerRankings"
        assert classification.needs_ocr is True
        assert classification.dimensions.get("scope") == "GLOBAL"


class TestEdgeCases:
    """Test edge cases revealed by real titles."""

    def setup_method(self):
        self.classifier = ArticleClassifier()
        self.extractor = IndustryDataExtractor()

    def test_data_table_prefix_does_not_break_classification(self):
        """'Data table:' prefix should not prevent correct classification."""
        result = self.classifier.classify(
            "Data table: China NEV sales in Jan 1-18"
        )
        assert result.target_table == "NevSalesSummary"

    def test_data_table_prefix_battery_rankings(self):
        result = self.classifier.classify(
            "Data table: Top EV battery makers' global installations in 2025"
        )
        assert result.target_table == "BatteryMakerRankings"

    def test_byd_battery_not_classified_as_brand_metric(self):
        """BYD battery data should go to BatteryMakerMonthly, not EVMetric."""
        result = self.classifier.classify(
            "BYD battery installations in Jan: 20.187 GWh"
        )
        assert result.target_table == "BatteryMakerMonthly"
        assert result.target_table != "EVMetric"

    def test_3_65_million_value_extraction(self):
        """'3.65 million' should extract as 3,650,000."""
        title = "China passenger car inventory at end of Dec: 3.65 million"
        pub_date = datetime(2025, 1, 20)
        classification = self.classifier.classify(title)
        result = self.extractor.extract(
            title=title,
            summary="",
            classification=classification,
            source_url="https://cnevdata.com/test",
            source_title=title,
            published_date=pub_date,
        )
        assert result is not None
        assert result.success
        assert result.data["value"] == 3_650_000
        assert result.data["year"] == 2024

    def test_cpca_rankings_prefix_matches(self):
        """'CPCA rankings: Top-selling automakers' format should match AutomakerRankings."""
        result = self.classifier.classify(
            "CPCA rankings: Top-selling automakers in China in Dec 2025"
        )
        assert result.target_table == "AutomakerRankings"

    def test_two_month_names_in_title(self):
        """Title with both 'Dec' and 'full-year' should still extract correctly."""
        result = self.classifier.classify(
            "Data table: Top EV battery makers' installations in China in Dec and full-year 2025"
        )
        assert result.target_table == "BatteryMakerRankings"

    def test_falls_rises_keywords(self):
        """'falls to' and 'rises to' in inventory factor titles should classify correctly."""
        result_falls = self.classifier.classify(
            "China auto dealer inventory factor falls to 1.31 in Dec"
        )
        result_rises = self.classifier.classify(
            "China auto dealer inventory factor rises to 1.57 in Nov"
        )
        assert result_falls.target_table == "ChinaDealerInventoryFactor"
        assert result_rises.target_table == "ChinaDealerInventoryFactor"

    def test_nev_sales_by_caam_format(self):
        """'China Dec NEV sales data by CAAM' format should match CaamNevSales."""
        result = self.classifier.classify(
            "China Dec NEV sales data by CAAM: 1,710,000"
        )
        assert result.target_table == "CaamNevSales"

    def test_nev_retail_by_cpca_format(self):
        """'China Dec NEV retail data by CPCA' format should match CpcaNevRetail."""
        result = self.classifier.classify(
            "China Dec NEV retail data by CPCA: 1,337,000"
        )
        assert result.target_table == "CpcaNevRetail"

    def test_nev_production_by_cpca_format(self):
        """'China Nov NEV production data by CPCA' format should match CpcaNevProduction."""
        result = self.classifier.classify(
            "China Nov NEV production data by CPCA: 1,757,000"
        )
        assert result.target_table == "CpcaNevProduction"


class TestYearInference:
    """Test year inference from published_date when title has no explicit year.

    The year is determined by comparing the data month in the title to the
    published_date month. If data_month > published_month, the data is from
    the previous year (e.g., "Dec" data published in Jan 2025 → Dec 2024).
    """

    def setup_method(self):
        self.parser = TitleParser()
        self.extractor = IndustryDataExtractor()
        self.classifier = ArticleClassifier()

    def _extract_year(self, title, published_date):
        parsed = self.parser.parse(title, published_date)
        return parsed.year if parsed else None

    def _extract_year_via_extractor(self, title, published_date):
        classification = self.classifier.classify(title)
        result = self.extractor.extract(
            title=title,
            summary="",
            classification=classification,
            source_url="https://cnevdata.com/test",
            source_title=title,
            published_date=published_date,
        )
        return result.data.get("year") if result and result.success else None

    # Same-year cases: data month <= published month
    def test_jan_data_published_feb_same_year(self):
        assert self._extract_year("Nio deliveries in Jan: 27,182", datetime(2025, 2, 3)) == 2025

    def test_jan_data_published_jan_same_year(self):
        assert self._extract_year("Nio deliveries in Jan: 27,182", datetime(2025, 1, 15)) == 2025

    def test_nov_data_published_dec_same_year(self):
        assert self._extract_year("Tesla China car sales in Nov: 86,700", datetime(2024, 12, 2)) == 2024

    # Previous-year cases: data month > published month
    def test_dec_data_published_jan_prev_year(self):
        assert self._extract_year("BYD NEV sales in Dec: 420,398", datetime(2025, 1, 1)) == 2024

    def test_nov_data_published_jan_prev_year(self):
        """Nov data published in Jan is unusual but should still resolve to previous year."""
        assert self._extract_year("Tesla China car sales in Nov: 86,700", datetime(2025, 1, 5)) == 2024

    def test_dec_data_published_feb_prev_year(self):
        assert self._extract_year("Tesla sales in China in Dec: 93,843", datetime(2025, 2, 1)) == 2024

    # Historical data (2023, 2022) via published_date from URL
    def test_jan_data_from_2024_url(self):
        assert self._extract_year("Nio deliveries in Jan: 15,000", datetime(2024, 2, 5)) == 2024

    def test_dec_data_from_2024_url(self):
        assert self._extract_year("BYD NEV sales in Dec: 350,000", datetime(2024, 1, 3)) == 2023

    def test_jan_data_from_2023_url(self):
        assert self._extract_year("Xpeng deliveries in Jan: 5,218", datetime(2023, 2, 1)) == 2023

    def test_dec_data_from_2023_url(self):
        assert self._extract_year("BYD NEV sales in Dec: 230,000", datetime(2023, 1, 2)) == 2022

    # Explicit year in title always wins
    def test_explicit_year_overrides_published_date(self):
        """When title has an explicit year, it should be used regardless of published_date."""
        # Use a brand metric title with explicit year
        parsed = self.parser.parse(
            "BYD NEV sales in Jan 2024: 210,051",
            datetime(2025, 2, 3),  # published_date year differs
        )
        assert parsed is not None
        assert parsed.year == 2024  # Title year wins over published_date year

    # Industry extractor produces same year
    def test_extractor_dec_data_published_jan(self):
        year = self._extract_year_via_extractor(
            "China EV battery installations in Dec: 98.1 GWh",
            datetime(2025, 1, 13),
        )
        assert year == 2024

    def test_extractor_jan_data_published_feb(self):
        year = self._extract_year_via_extractor(
            "China vehicle inventory alert index rises to 59.4% in Jan",
            datetime(2025, 2, 10),
        )
        assert year == 2025

    def test_extractor_historical_2023(self):
        year = self._extract_year_via_extractor(
            "China EV battery installations in Dec: 65.0 GWh",
            datetime(2024, 1, 15),
        )
        assert year == 2023


class TestOCRDataTypeRouting:
    """Test that each article type gets the correct OCR prompt type.

    Rankings → "rankings" (tabular leaderboard data)
    NEV sales summary → "trend" (time-series charts/diagrams)
    Vehicle specs → "specs" (specification sheets)
    Other OCR-needing types → None (use default "metrics")
    """

    def setup_method(self):
        self.classifier = ArticleClassifier()

    # Rankings → "rankings"
    def test_automaker_rankings_ocr_type(self):
        result = self.classifier.classify(
            "CPCA rankings: Top-selling automakers in China in Dec 2025"
        )
        assert result.ocr_data_type == "rankings"

    def test_battery_maker_rankings_ocr_type(self):
        result = self.classifier.classify(
            "Data table: Top EV battery makers' global installations in 2025"
        )
        assert result.ocr_data_type == "rankings"

    def test_battery_maker_rankings_china_ocr_type(self):
        result = self.classifier.classify(
            "Data table: Top EV battery makers' installations in China in Dec and full-year 2025"
        )
        assert result.ocr_data_type == "rankings"

    # NEV sales summary → "trend"
    def test_nev_sales_summary_ocr_type(self):
        result = self.classifier.classify(
            "Data table: China NEV sales in Jan 1-18"
        )
        assert result.ocr_data_type == "trend"

    def test_nev_sales_summary_full_month_ocr_type(self):
        result = self.classifier.classify(
            "Data table: China NEV sales in Dec 1-31"
        )
        assert result.ocr_data_type == "trend"

    # Vehicle specs → "specs"
    def test_vehicle_spec_ocr_type(self):
        result = self.classifier.classify(
            "BYD Seal specifications and pricing"
        )
        assert result.ocr_data_type == "specs"

    # Brand metrics without OCR → None
    def test_brand_metric_no_ocr_type(self):
        result = self.classifier.classify(
            "BYD NEV sales in Jan: 210,051"
        )
        assert result.ocr_data_type is None

    # Chart-type industry data → "chart" (OCR skipped in production)
    def test_battery_installation_chart_ocr_type(self):
        result = self.classifier.classify(
            "China EV battery installations in Dec: 98.1 GWh"
        )
        assert result.ocr_data_type == "chart"

    def test_caam_nev_sales_chart_ocr_type(self):
        result = self.classifier.classify(
            "China Dec NEV sales data by CAAM: 1,710,000"
        )
        assert result.ocr_data_type == "chart"
