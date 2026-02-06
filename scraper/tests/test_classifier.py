"""Tests for the ArticleClassifier."""

from extractors.classifier import ArticleClassifier, ArticleType


class TestArticleClassifier:
    """Test article classification into correct target tables."""

    def setup_method(self):
        self.classifier = ArticleClassifier()

    # ==========================================
    # Industry-level time series tables
    # ==========================================

    def test_via_index(self):
        result = self.classifier.classify(
            "China vehicle inventory alert index rises to 59.4% in Jan 2025"
        )
        assert result.target_table == "ChinaViaIndex"
        assert result.article_type == ArticleType.CHINA_VIA_INDEX

    def test_dealer_inventory_factor(self):
        result = self.classifier.classify(
            "China dealer inventory factor rises to 1.31 in Jan 2025"
        )
        assert result.target_table == "ChinaDealerInventoryFactor"
        assert result.article_type == ArticleType.CHINA_DEALER_INVENTORY_FACTOR

    def test_passenger_inventory(self):
        result = self.classifier.classify(
            "China passenger car inventory reaches 3.2 million units in Jan"
        )
        assert result.target_table == "ChinaPassengerInventory"
        assert result.article_type == ArticleType.CHINA_PASSENGER_INVENTORY

    def test_china_battery_installation(self):
        result = self.classifier.classify(
            "China EV battery installations hit 45.2 GWh in Jan"
        )
        assert result.target_table == "ChinaBatteryInstallation"
        assert result.article_type == ArticleType.CHINA_BATTERY_INSTALLATION

    def test_caam_nev_sales(self):
        result = self.classifier.classify(
            "CAAM NEV sales: 1.2 million vehicles in Jan 2025"
        )
        assert result.target_table == "CaamNevSales"
        assert result.article_type == ArticleType.CAAM_NEV_SALES

    def test_cpca_nev_retail(self):
        result = self.classifier.classify(
            "CPCA: NEV retail sales reach 850,000 in Jan"
        )
        assert result.target_table == "CpcaNevRetail"
        assert result.article_type == ArticleType.CPCA_NEV_RETAIL

    def test_cpca_nev_production(self):
        result = self.classifier.classify(
            "CPCA: NEV production hits 920,000 in Jan"
        )
        assert result.target_table == "CpcaNevProduction"
        assert result.article_type == ArticleType.CPCA_NEV_PRODUCTION

    # ==========================================
    # Entity-specific time series
    # ==========================================

    def test_battery_maker_monthly_catl(self):
        result = self.classifier.classify(
            "CATL battery installations in Jan: 25.6 GWh"
        )
        assert result.target_table == "BatteryMakerMonthly"
        assert result.dimensions.get("maker") == "CATL"

    def test_battery_maker_monthly_byd(self):
        result = self.classifier.classify(
            "BYD battery installations hit 12.3 GWh in Jan"
        )
        assert result.target_table == "BatteryMakerMonthly"
        assert result.dimensions.get("maker") == "BYD"

    def test_plant_exports(self):
        result = self.classifier.classify(
            "Tesla Shanghai exports 35,000 vehicles in Jan"
        )
        assert result.target_table == "PlantExports"
        assert result.article_type == ArticleType.PLANT_EXPORTS

    # ==========================================
    # Rankings / tables
    # ==========================================

    def test_automaker_rankings(self):
        result = self.classifier.classify(
            "CPCA top-selling automakers Jan 2025"
        )
        assert result.target_table == "AutomakerRankings"
        assert result.needs_ocr is True

    def test_battery_maker_rankings_china(self):
        result = self.classifier.classify(
            "Top battery makers China Jan 2025"
        )
        assert result.target_table == "BatteryMakerRankings"
        assert result.dimensions.get("scope") == "CHINA"

    def test_battery_maker_rankings_global(self):
        result = self.classifier.classify(
            "Global battery maker rankings 2024"
        )
        assert result.target_table == "BatteryMakerRankings"
        assert result.dimensions.get("scope") == "GLOBAL"

    def test_nev_sales_summary(self):
        result = self.classifier.classify(
            "CPCA: NEV sales Jan 1-18 reach 420,000"
        )
        assert result.target_table == "NevSalesSummary"

    # ==========================================
    # Existing tables (EVMetric, VehicleSpec)
    # ==========================================

    def test_brand_delivery(self):
        result = self.classifier.classify(
            "Xpeng deliveries in Jan: 20,011"
        )
        assert result.target_table == "EVMetric"
        assert result.article_type == ArticleType.BRAND_METRIC

    def test_brand_sales_with_yoy(self):
        result = self.classifier.classify(
            "BYD NEV sales in Jan: 210,051, down 34% YoY"
        )
        assert result.target_table == "EVMetric"

    def test_vehicle_spec(self):
        result = self.classifier.classify("NIO EC7: Main specs")
        assert result.target_table == "VehicleSpec"
        assert result.article_type == ArticleType.VEHICLE_SPEC

    def test_regional_data(self):
        result = self.classifier.classify(
            "Shanghai Apr NEV license plates: 45,000"
        )
        assert result.target_table == "EVMetric"
        assert result.article_type == ArticleType.REGIONAL_DATA
        assert result.dimensions.get("region") == "Shanghai"

    # ==========================================
    # Edge cases
    # ==========================================

    def test_skip_unrelated(self):
        result = self.classifier.classify(
            "Random news about weather patterns this week"
        )
        assert result.article_type == ArticleType.SKIP
        assert result.target_table is None

    def test_catl_not_in_automaker(self):
        """CATL is a battery maker, not an automaker. Should go to battery tables."""
        result = self.classifier.classify(
            "CATL battery installations in Jan: 25.6 GWh"
        )
        assert result.target_table != "AutomakerRankings"
        assert result.target_table == "BatteryMakerMonthly"

    def test_ocr_needed_when_no_numbers(self):
        """Rankings without numbers in title should require OCR."""
        result = self.classifier.classify(
            "CPCA top-selling automakers Jan 2025"
        )
        assert result.needs_ocr is True

    def test_ocr_not_needed_when_numbers_present(self):
        """Articles with numbers in title should not require OCR."""
        result = self.classifier.classify(
            "CAAM NEV sales: 1,200,000 vehicles in Jan 2025"
        )
        assert result.needs_ocr is False
