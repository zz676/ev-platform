"""Tests for the IndustryDataExtractor."""

from datetime import datetime

from extractors.classifier import ArticleClassifier, ClassificationResult, ArticleType
from extractors.industry_extractor import IndustryDataExtractor


class TestIndustryDataExtractor:
    """Test data extraction for industry tables."""

    def setup_method(self):
        self.classifier = ArticleClassifier()
        self.extractor = IndustryDataExtractor()

    def _classify_and_extract(self, title, summary="", published_date=None):
        """Helper: classify then extract."""
        classification = self.classifier.classify(title, summary)
        return self.extractor.extract(
            title=title,
            summary=summary,
            classification=classification,
            source_url="https://example.com/article",
            source_title=title,
            published_date=published_date,
        )

    # ==========================================
    # Battery installation
    # ==========================================

    def test_battery_installation_gwh(self):
        result = self._classify_and_extract(
            "China EV battery installations hit 45.2 GWh in Jan 2025"
        )
        assert result is not None
        assert result.success is True
        assert result.table_name == "ChinaBatteryInstallation"
        assert result.data["installation"] == 45.2
        assert result.data["year"] == 2025
        assert result.data["month"] == 1
        assert result.data["unit"] == "GWh"

    # ==========================================
    # CAAM NEV sales
    # ==========================================

    def test_caam_nev_sales(self):
        result = self._classify_and_extract(
            "CAAM NEV sales: 1.2 million vehicles in Jan 2025, up 15% YoY"
        )
        assert result is not None
        assert result.success is True
        assert result.table_name == "CaamNevSales"
        assert result.data["value"] == 1_200_000
        assert result.data["year"] == 2025
        assert result.data["month"] == 1

    # ==========================================
    # Dealer inventory factor
    # ==========================================

    def test_dealer_inventory_factor(self):
        result = self._classify_and_extract(
            "China dealer inventory factor rises to 1.31 in Jan 2025"
        )
        assert result is not None
        assert result.success is True
        assert result.table_name == "ChinaDealerInventoryFactor"
        assert result.data["value"] == 1.31
        assert result.data["year"] == 2025
        assert result.data["month"] == 1

    # ==========================================
    # VIA Index
    # ==========================================

    def test_via_index(self):
        result = self._classify_and_extract(
            "China vehicle inventory alert index rises to 59.4% in Jan 2025"
        )
        assert result is not None
        assert result.success is True
        assert result.table_name == "ChinaViaIndex"
        assert result.data["value"] == 59.4
        assert result.data["unit"] == "percent"

    # ==========================================
    # CPCA retail / production
    # ==========================================

    def test_cpca_retail(self):
        result = self._classify_and_extract(
            "CPCA: NEV retail sales reach 850,000 in Jan 2025, down 5% MoM"
        )
        assert result is not None
        assert result.success is True
        assert result.table_name == "CpcaNevRetail"
        assert result.data["value"] == 850_000
        assert result.data["unit"] == "vehicles"

    def test_cpca_production(self):
        result = self._classify_and_extract(
            "CPCA: NEV production hits 920,000 in Jan 2025"
        )
        assert result is not None
        assert result.success is True
        assert result.table_name == "CpcaNevProduction"
        assert result.data["value"] == 920_000

    # ==========================================
    # Battery maker monthly
    # ==========================================

    def test_battery_maker_catl(self):
        result = self._classify_and_extract(
            "CATL battery installations in Jan 2025: 25.6 GWh"
        )
        assert result is not None
        assert result.success is True
        assert result.table_name == "BatteryMakerMonthly"
        assert result.data["maker"] == "CATL"
        assert result.data["installation"] == 25.6

    # ==========================================
    # Plant exports
    # ==========================================

    def test_plant_exports_tesla_shanghai(self):
        result = self._classify_and_extract(
            "Tesla Shanghai exports 35,000 vehicles in Jan 2025"
        )
        assert result is not None
        assert result.success is True
        assert result.table_name == "PlantExports"
        assert result.data["plant"] == "Tesla Shanghai"
        assert result.data["brand"] == "Tesla"
        assert result.data["value"] == 35_000

    # ==========================================
    # NEV sales summary (date range)
    # ==========================================

    def test_nev_sales_summary(self):
        result = self._classify_and_extract(
            "CPCA: NEV sales Jan 1-18 reach 420,000"
        )
        assert result is not None
        assert result.success is True
        assert result.table_name == "NevSalesSummary"
        assert result.data["retailSales"] == 420_000

    # ==========================================
    # Rankings (need OCR templates)
    # ==========================================

    def test_automaker_rankings_returns_ocr_template(self):
        result = self._classify_and_extract(
            "CPCA top-selling automakers Jan 2025"
        )
        assert result is not None
        assert result.success is True
        assert result.data.get("_needs_ocr") is True
        assert result.data["year"] == 2025
        assert result.data["month"] == 1

    def test_battery_maker_rankings_returns_ocr_template(self):
        result = self._classify_and_extract(
            "Top battery makers China Jan 2025"
        )
        assert result is not None
        assert result.success is True
        assert result.data.get("_needs_ocr") is True
        assert result.data["scope"] == "CHINA"

    # ==========================================
    # Failure cases
    # ==========================================

    def test_returns_none_for_skip_articles(self):
        result = self._classify_and_extract(
            "Random news about weather in Beijing"
        )
        assert result is None

    def test_returns_failure_when_no_date(self):
        """Articles without extractable year/month should fail gracefully."""
        classification = ClassificationResult(
            article_type=ArticleType.CAAM_NEV_SALES,
            target_table="CaamNevSales",
            needs_ocr=False,
            dimensions={},
        )
        result = self.extractor.extract(
            title="CAAM NEV sales data",  # No date, no value
            summary="",
            classification=classification,
            source_url="https://example.com",
            source_title="CAAM NEV sales data",
        )
        assert result is not None
        assert result.success is False

    def test_common_fields_added(self):
        """Source URL and title should be added to all successful extractions."""
        result = self._classify_and_extract(
            "China EV battery installations hit 45.2 GWh in Jan 2025"
        )
        assert result.data["sourceUrl"] == "https://example.com/article"
        assert "sourceTitle" in result.data
