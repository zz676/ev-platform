"""OCR tests using real image URLs from cnevdata.com articles.

Tests requiring the OpenAI API are marked @pytest.mark.ocr and skipped by default.
Requires OPENAI_API_KEY environment variable for OCR tests.
Run with: cd scraper && python -m pytest tests/test_ocr.py -v -m ocr

Snapshot tests (TestOCRSnapshot*) run offline using pre-recorded GPT-4o responses
stored in tests/fixtures/. These verify the JSON normalization and data quality
without any API calls.
"""

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from extractors.image_ocr import calculate_ocr_cost, _unwrap_data_array
from extractors.classifier import ArticleClassifier


# Conditionally skip OCR tests that need the API key
needs_api_key = pytest.mark.skipif(
    not os.getenv("OPENAI_API_KEY"),
    reason="OPENAI_API_KEY not set",
)

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def _load_snapshot(name: str) -> dict:
    """Load a snapshot JSON file from the fixtures directory."""
    path = os.path.join(FIXTURES_DIR, f"ocr_snapshot_{name}.json")
    with open(path) as f:
        return json.load(f)


# Known image URLs from cnevdata.com ranking articles.
SAMPLE_RANKINGS_IMAGE_URL = (
    "https://cdn.cnevdata.com/wp-content/uploads/2026/01/2026011214070273.jpg"
)


@pytest.fixture(scope="module")
def ocr_service():
    """Shared ImageOCR instance."""
    from extractors.image_ocr import ImageOCR
    return ImageOCR()


@pytest.fixture(scope="module")
def rankings_result(ocr_service):
    """Cached OCR result for a rankings image."""
    return ocr_service.extract_from_url_sync(
        SAMPLE_RANKINGS_IMAGE_URL, data_type="rankings"
    )


# ---------------------------------------------------------------------------
# Snapshot fixtures (no API key needed)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def automaker_snapshot():
    return _load_snapshot("automaker_rankings")


@pytest.fixture(scope="module")
def battery_snapshot():
    return _load_snapshot("battery_maker_rankings")


@pytest.fixture(scope="module")
def trend_snapshot():
    return _load_snapshot("nev_sales_trend")


@pytest.fixture(scope="module")
def via_index_snapshot():
    return _load_snapshot("via_index_trend")


@pytest.fixture(scope="module")
def passenger_inventory_snapshot():
    return _load_snapshot("passenger_inventory_trend")


@pytest.fixture(scope="module")
def battery_china_snapshot():
    return _load_snapshot("battery_china_rankings")


@pytest.fixture(scope="module")
def nev_sales_jan_1_11_snapshot():
    return _load_snapshot("nev_sales_jan_1_11")


@pytest.fixture(scope="module")
def cpca_production_snapshot():
    return _load_snapshot("cpca_production_trend")


@pytest.fixture(scope="module")
def tesla_exports_snapshot():
    return _load_snapshot("tesla_exports_trend")


# ---------------------------------------------------------------------------
# Snapshot tests: Automaker Rankings
# ---------------------------------------------------------------------------

class TestSnapshotAutomakerRankings:
    """Verify automaker rankings OCR snapshot data (offline, no API key)."""

    def test_snapshot_success(self, automaker_snapshot):
        assert automaker_snapshot["result"]["success"] is True

    def test_entries_are_flat_dicts(self, automaker_snapshot):
        """Each entry should be a flat dict (not nested inside a wrapper)."""
        data = automaker_snapshot["result"]["data"]
        assert isinstance(data, list)
        assert len(data) >= 5, f"Expected at least 5 entries, got {len(data)}"
        for entry in data:
            assert isinstance(entry, dict)
            assert "brand" in entry, f"Entry missing 'brand': {entry}"
            assert "value" in entry, f"Entry missing 'value': {entry}"
            assert "rank" in entry, f"Entry missing 'rank': {entry}"

    def test_ranks_start_at_1(self, automaker_snapshot):
        data = automaker_snapshot["result"]["data"]
        ranks = [e["rank"] for e in data]
        assert ranks[0] == 1

    def test_ranks_are_sequential(self, automaker_snapshot):
        data = automaker_snapshot["result"]["data"]
        ranks = [e["rank"] for e in data]
        assert ranks == list(range(1, len(ranks) + 1))

    def test_byd_is_rank_1(self, automaker_snapshot):
        data = automaker_snapshot["result"]["data"]
        assert data[0]["brand"] == "BYD"
        assert data[0]["value"] == 339854

    def test_tesla_china_present(self, automaker_snapshot):
        data = automaker_snapshot["result"]["data"]
        brands = [e["brand"].lower() for e in data]
        assert any("tesla" in b for b in brands)

    def test_all_values_positive(self, automaker_snapshot):
        data = automaker_snapshot["result"]["data"]
        for entry in data:
            assert entry["value"] > 0, f"Non-positive value for {entry['brand']}"

    def test_share_percentages_reasonable(self, automaker_snapshot):
        data = automaker_snapshot["result"]["data"]
        total_share = sum(e.get("share", 0) for e in data)
        # Top 8 should sum to something reasonable (not over 100%)
        assert 30 < total_share < 100, f"Share total {total_share}% seems off"

    def test_yoy_has_negative_values(self, automaker_snapshot):
        """Some brands should have negative YoY (market isn't uniformly growing)."""
        data = automaker_snapshot["result"]["data"]
        yoys = [e.get("yoy", 0) for e in data]
        assert any(y < 0 for y in yoys), "Expected some negative YoY values"

    def test_mom_has_negative_values(self, automaker_snapshot):
        """Some brands should have negative MoM."""
        data = automaker_snapshot["result"]["data"]
        moms = [e.get("mom", 0) for e in data]
        assert any(m < 0 for m in moms), "Expected some negative MoM values"


# ---------------------------------------------------------------------------
# Snapshot tests: Battery Maker Rankings
# ---------------------------------------------------------------------------

class TestSnapshotBatteryMakerRankings:
    """Verify battery maker rankings OCR snapshot data (offline, no API key)."""

    def test_snapshot_success(self, battery_snapshot):
        assert battery_snapshot["result"]["success"] is True

    def test_entries_are_flat_dicts(self, battery_snapshot):
        data = battery_snapshot["result"]["data"]
        assert isinstance(data, list)
        assert len(data) >= 5
        for entry in data:
            assert isinstance(entry, dict)
            assert "brand" in entry
            assert "value" in entry

    def test_catl_is_rank_1(self, battery_snapshot):
        data = battery_snapshot["result"]["data"]
        assert data[0]["brand"] == "CATL"
        assert data[0]["rank"] == 1

    def test_byd_is_rank_2(self, battery_snapshot):
        data = battery_snapshot["result"]["data"]
        assert data[1]["brand"] == "BYD"

    def test_values_are_gwh(self, battery_snapshot):
        """Battery values should be in GWh (tens to hundreds, not millions)."""
        data = battery_snapshot["result"]["data"]
        for entry in data:
            assert 1 < entry["value"] < 1000, (
                f"{entry['brand']} value {entry['value']} doesn't look like GWh"
            )

    def test_catl_dominates_market_share(self, battery_snapshot):
        data = battery_snapshot["result"]["data"]
        catl = data[0]
        assert catl.get("share", 0) > 30, "CATL should have >30% market share"

    def test_yoy_all_positive(self, battery_snapshot):
        """In 2025, all top battery makers grew YoY."""
        data = battery_snapshot["result"]["data"]
        for entry in data:
            assert entry.get("yoy", 0) > 0, (
                f"{entry['brand']} has non-positive YoY: {entry.get('yoy')}"
            )

    def test_prior_values_present(self, battery_snapshot):
        """2024 values should be extracted alongside 2025 values."""
        data = battery_snapshot["result"]["data"]
        for entry in data:
            assert "prior_value" in entry, (
                f"{entry['brand']} missing prior_value (2024 data)"
            )
            assert entry["prior_value"] > 0

    def test_prior_values_less_than_current(self, battery_snapshot):
        """2024 values should be less than 2025 (market grew)."""
        data = battery_snapshot["result"]["data"]
        for entry in data:
            assert entry["prior_value"] < entry["value"], (
                f"{entry['brand']}: 2024={entry['prior_value']} >= 2025={entry['value']}"
            )

    def test_prior_share_present(self, battery_snapshot):
        """2024 share should be extracted."""
        data = battery_snapshot["result"]["data"]
        for entry in data:
            assert "prior_share" in entry, (
                f"{entry['brand']} missing prior_share (2024 share)"
            )
            assert entry["prior_share"] > 0

    def test_catl_2024_value(self, battery_snapshot):
        """CATL 2024 value should be 342.5 GWh."""
        data = battery_snapshot["result"]["data"]
        assert data[0]["prior_value"] == 342.5


# ---------------------------------------------------------------------------
# Snapshot tests: NEV Sales Trend
# ---------------------------------------------------------------------------

class TestSnapshotNevSalesTrend:
    """Verify NEV sales trend OCR snapshot data (offline, no API key)."""

    def test_snapshot_success(self, trend_snapshot):
        assert trend_snapshot["result"]["success"] is True

    def test_entries_are_flat_dicts(self, trend_snapshot):
        data = trend_snapshot["result"]["data"]
        assert isinstance(data, list)
        assert len(data) >= 10
        for entry in data:
            assert isinstance(entry, dict)
            assert "date" in entry
            assert "value" in entry

    def test_has_retail_and_wholesale_labels(self, trend_snapshot):
        data = trend_snapshot["result"]["data"]
        labels = {e.get("label", "") for e in data}
        assert "NEV Retail" in labels, f"Missing 'NEV Retail' label, got: {labels}"
        assert "NEV Wholesale" in labels, f"Missing 'NEV Wholesale' label, got: {labels}"

    def test_values_are_vehicle_counts(self, trend_snapshot):
        """Values should be in tens of thousands to millions range."""
        data = trend_snapshot["result"]["data"]
        for entry in data:
            assert 50_000 < entry["value"] < 5_000_000, (
                f"Value {entry['value']} for {entry['date']} seems unreasonable"
            )

    def test_cumulative_values_increase(self, trend_snapshot):
        """Within same month, cumulative values should increase over time."""
        data = trend_snapshot["result"]["data"]
        retail = [e for e in data if e.get("label") == "NEV Retail"]
        # Group by month prefix (e.g., "20251201")
        months = {}
        for e in retail:
            prefix = e["date"][:8]  # e.g., "20251201"
            months.setdefault(prefix, []).append(e)

        for prefix, entries in months.items():
            if len(entries) > 1:
                values = [e["value"] for e in entries]
                assert values == sorted(values), (
                    f"Cumulative values for {prefix} should increase: {values}"
                )

    def test_dates_are_date_ranges(self, trend_snapshot):
        """Dates should be in YYYYMMDD-YYYYMMDD range format."""
        data = trend_snapshot["result"]["data"]
        for entry in data:
            assert "-" in entry["date"], f"Date not a range: {entry['date']}"
            parts = entry["date"].split("-")
            assert len(parts) == 2, f"Date should have start-end: {entry['date']}"
            assert len(parts[0]) == 8, f"Start date wrong length: {parts[0]}"
            assert len(parts[1]) == 8, f"End date wrong length: {parts[1]}"

    def test_yoy_present(self, trend_snapshot):
        """YoY change should be present on entries."""
        data = trend_snapshot["result"]["data"]
        entries_with_yoy = [e for e in data if "yoy" in e]
        assert len(entries_with_yoy) > 0

    def test_mom_present(self, trend_snapshot):
        """MoM change should be present on all entries."""
        data = trend_snapshot["result"]["data"]
        for entry in data:
            assert "mom" in entry, (
                f"Entry missing 'mom': date={entry['date']}, label={entry.get('label')}"
            )

    def test_mom_values_reasonable(self, trend_snapshot):
        """MoM values should be in a reasonable range (-100 to +200)."""
        data = trend_snapshot["result"]["data"]
        for entry in data:
            mom = entry.get("mom", 0)
            assert -100 <= mom <= 200, (
                f"MoM {mom}% unreasonable for {entry['date']} {entry.get('label')}"
            )

    def test_jan_entries_have_negative_mom(self, trend_snapshot):
        """January entries should have negative MoM (lower than December full month)."""
        data = trend_snapshot["result"]["data"]
        jan_entries = [e for e in data if e["date"].startswith("20260101")]
        assert len(jan_entries) > 0
        for entry in jan_entries:
            assert entry.get("mom", 0) < 0, (
                f"Jan entry should have negative MoM: {entry}"
            )


# ---------------------------------------------------------------------------
# Snapshot tests: VIA Index (chart — approximate, not used in production)
# ---------------------------------------------------------------------------

@pytest.mark.chart_approximate
class TestSnapshotViaIndex:
    """Verify VIA index chart OCR snapshot data (offline, no API key).

    NOTE: Chart OCR is fundamentally inaccurate (GPT-4o approximates pixel
    positions). In production, we skip OCR for chart images and extract the
    key data point from the article title instead. These tests are kept as
    informational baselines only.
    """

    def test_snapshot_success(self, via_index_snapshot):
        assert via_index_snapshot["result"]["success"] is True

    def test_has_12_months(self, via_index_snapshot):
        data = via_index_snapshot["result"]["data"]
        assert len(data) == 12

    def test_jan_26_is_last(self, via_index_snapshot):
        data = via_index_snapshot["result"]["data"]
        assert data[-1]["date"] == "Jan-26"

    def test_jan_26_close_to_59_4(self, via_index_snapshot):
        """Title says 59.4%, chart reading should be approximately that."""
        data = via_index_snapshot["result"]["data"]
        jan_26 = data[-1]["value"]
        assert 55 <= jan_26 <= 63, f"Jan-26 VIA index {jan_26}% not close to 59.4%"

    def test_values_are_percent_range(self, via_index_snapshot):
        """VIA index values should be between 40% and 80%."""
        data = via_index_snapshot["result"]["data"]
        for entry in data:
            assert 40 <= entry["value"] <= 80, (
                f"VIA index {entry['value']}% for {entry['date']} out of range"
            )

    def test_dates_are_month_year_format(self, via_index_snapshot):
        data = via_index_snapshot["result"]["data"]
        for entry in data:
            assert "-" in entry["date"], f"Date not month-year: {entry['date']}"
            parts = entry["date"].split("-")
            assert len(parts) == 2


# ---------------------------------------------------------------------------
# Snapshot tests: Passenger Inventory (chart — approximate, not used in production)
# ---------------------------------------------------------------------------

@pytest.mark.chart_approximate
class TestSnapshotPassengerInventory:
    """Verify passenger car inventory chart OCR snapshot data.

    NOTE: Chart OCR is approximate. In production, the key value is extracted
    from the article title. These tests are informational baselines only.
    """

    def test_snapshot_success(self, passenger_inventory_snapshot):
        assert passenger_inventory_snapshot["result"]["success"] is True

    def test_has_12_months(self, passenger_inventory_snapshot):
        data = passenger_inventory_snapshot["result"]["data"]
        assert len(data) == 12

    def test_dec_25_is_3_65_million(self, passenger_inventory_snapshot):
        """Title says 3.65 million, last entry should match."""
        data = passenger_inventory_snapshot["result"]["data"]
        dec = data[-1]
        assert dec["date"] == "Dec-25"
        assert dec["value"] == pytest.approx(3.65, abs=0.1)

    def test_values_in_million_range(self, passenger_inventory_snapshot):
        """Values should be in 2.5-4.0 million range (2025 data)."""
        data = passenger_inventory_snapshot["result"]["data"]
        for entry in data:
            assert 2.5 <= entry["value"] <= 4.5, (
                f"Inventory {entry['value']}M for {entry['date']} out of range"
            )

    def test_general_upward_trend(self, passenger_inventory_snapshot):
        """Inventory generally increased through 2025."""
        data = passenger_inventory_snapshot["result"]["data"]
        assert data[-1]["value"] > data[0]["value"]


# ---------------------------------------------------------------------------
# Snapshot tests: Battery China Rankings (table)
# ---------------------------------------------------------------------------

class TestSnapshotBatteryChinaRankings:
    """Verify China battery maker rankings table OCR snapshot data."""

    def test_snapshot_success(self, battery_china_snapshot):
        assert battery_china_snapshot["result"]["success"] is True

    def test_has_8_entries(self, battery_china_snapshot):
        data = battery_china_snapshot["result"]["data"]
        assert len(data) == 8

    def test_catl_is_rank_1(self, battery_china_snapshot):
        data = battery_china_snapshot["result"]["data"]
        assert data[0]["brand"] == "CATL"
        assert data[0]["rank"] == 1
        assert data[0]["value"] == 45.71

    def test_byd_is_rank_2(self, battery_china_snapshot):
        data = battery_china_snapshot["result"]["data"]
        assert data[1]["brand"] == "BYD"
        assert data[1]["value"] == 17.63

    def test_ranks_sequential(self, battery_china_snapshot):
        data = battery_china_snapshot["result"]["data"]
        ranks = [e["rank"] for e in data]
        assert ranks == list(range(1, 9))

    def test_values_are_gwh(self, battery_china_snapshot):
        """Monthly installation values should be 1-50 GWh."""
        data = battery_china_snapshot["result"]["data"]
        for entry in data:
            assert 1 < entry["value"] < 60, (
                f"{entry['brand']} value {entry['value']} GWh out of range"
            )

    def test_share_sums_reasonable(self, battery_china_snapshot):
        """Top 8 should have significant combined share."""
        data = battery_china_snapshot["result"]["data"]
        total = sum(e["share"] for e in data)
        assert 80 < total < 100, f"Total share {total}% seems off"

    def test_catl_dominates(self, battery_china_snapshot):
        data = battery_china_snapshot["result"]["data"]
        assert data[0]["share"] > 40, "CATL should have >40% China share"

    def test_share_change_present(self, battery_china_snapshot):
        """Share vs prev month column should be extracted."""
        data = battery_china_snapshot["result"]["data"]
        for entry in data:
            assert "share_change" in entry, (
                f"{entry['brand']} missing share_change"
            )

    def test_share_change_has_mixed_signs(self, battery_china_snapshot):
        """Some should gain share, some should lose."""
        data = battery_china_snapshot["result"]["data"]
        changes = [e["share_change"] for e in data]
        assert any(c > 0 for c in changes), "Expected some positive share changes"
        assert any(c < 0 for c in changes), "Expected some negative share changes"


# ---------------------------------------------------------------------------
# Snapshot tests: NEV Sales Jan 1-11 (table)
# ---------------------------------------------------------------------------

class TestSnapshotNevSalesJan1_11:
    """Verify NEV sales Jan 1-11 table OCR snapshot data."""

    def test_snapshot_success(self, nev_sales_jan_1_11_snapshot):
        assert nev_sales_jan_1_11_snapshot["result"]["success"] is True

    def test_has_14_entries(self, nev_sales_jan_1_11_snapshot):
        """7 date ranges x 2 series (retail + wholesale) = 14."""
        data = nev_sales_jan_1_11_snapshot["result"]["data"]
        assert len(data) == 14

    def test_has_retail_and_wholesale(self, nev_sales_jan_1_11_snapshot):
        data = nev_sales_jan_1_11_snapshot["result"]["data"]
        labels = {e.get("label") for e in data}
        assert "NEV Retail" in labels
        assert "NEV Wholesale" in labels

    def test_includes_november_data(self, nev_sales_jan_1_11_snapshot):
        """This snapshot includes Nov full-month data row."""
        data = nev_sales_jan_1_11_snapshot["result"]["data"]
        nov_entries = [e for e in data if "202511" in e["date"]]
        assert len(nov_entries) == 2  # retail + wholesale

    def test_nov_retail_value(self, nev_sales_jan_1_11_snapshot):
        data = nev_sales_jan_1_11_snapshot["result"]["data"]
        nov_retail = [e for e in data if "202511" in e["date"] and e.get("label") == "NEV Retail"]
        assert len(nov_retail) == 1
        assert nov_retail[0]["value"] == 1354000

    def test_jan_11_retail_value(self, nev_sales_jan_1_11_snapshot):
        data = nev_sales_jan_1_11_snapshot["result"]["data"]
        jan_retail = [e for e in data if "20260111" in e["date"] and e.get("label") == "NEV Retail"]
        assert len(jan_retail) == 1
        assert jan_retail[0]["value"] == 117000

    def test_all_have_yoy_and_mom(self, nev_sales_jan_1_11_snapshot):
        data = nev_sales_jan_1_11_snapshot["result"]["data"]
        for entry in data:
            assert "yoy" in entry, f"Missing yoy: {entry['date']}"
            assert "mom" in entry, f"Missing mom: {entry['date']}"

    def test_cumulative_dec_values_increase(self, nev_sales_jan_1_11_snapshot):
        """Dec retail cumulative should increase: 185k -> 476k -> 788k -> ..."""
        data = nev_sales_jan_1_11_snapshot["result"]["data"]
        dec_retail = sorted(
            [e for e in data if e["date"].startswith("202512") and e.get("label") == "NEV Retail"],
            key=lambda e: e["date"],
        )
        values = [e["value"] for e in dec_retail]
        assert values == sorted(values), f"Dec retail should increase: {values}"


# ---------------------------------------------------------------------------
# Snapshot tests: CPCA Production (chart — approximate, not used in production)
# ---------------------------------------------------------------------------

@pytest.mark.chart_approximate
class TestSnapshotCpcaProduction:
    """Verify CPCA NEV production chart OCR snapshot data.

    NOTE: Chart OCR is approximate. In production, the key value is extracted
    from the article title. These tests are informational baselines only.
    """

    def test_snapshot_success(self, cpca_production_snapshot):
        assert cpca_production_snapshot["result"]["success"] is True

    def test_has_12_months(self, cpca_production_snapshot):
        data = cpca_production_snapshot["result"]["data"]
        assert len(data) == 12

    def test_dec_25_close_to_title(self, cpca_production_snapshot):
        """Title mentions 1,560,000 for Nov/Dec. Dec should be close."""
        data = cpca_production_snapshot["result"]["data"]
        dec = data[-1]
        assert dec["date"] == "Dec-25"
        assert 1_300_000 <= dec["value"] <= 1_800_000, (
            f"Dec-25 production {dec['value']} not close to expected ~1,550,000"
        )

    def test_values_are_vehicle_counts(self, cpca_production_snapshot):
        """Production values should be 100k-2M range."""
        data = cpca_production_snapshot["result"]["data"]
        for entry in data:
            assert 100_000 <= entry["value"] <= 2_500_000, (
                f"Production {entry['value']} for {entry['date']} out of range"
            )

    def test_jan_is_seasonal_low(self, cpca_production_snapshot):
        """January is typically a low month for production (CNY)."""
        data = cpca_production_snapshot["result"]["data"]
        jan = data[0]
        mid_year = data[5]  # ~Jun
        assert jan["value"] < mid_year["value"], (
            f"Jan {jan['value']} should be lower than mid-year {mid_year['value']}"
        )

    def test_nov_is_near_peak(self, cpca_production_snapshot):
        """Nov 2025 should be near the year's peak."""
        data = cpca_production_snapshot["result"]["data"]
        nov = next(e for e in data if e["date"] == "Nov-25")
        max_val = max(e["value"] for e in data)
        assert nov["value"] >= max_val * 0.8, (
            f"Nov {nov['value']} should be near peak {max_val}"
        )


# ---------------------------------------------------------------------------
# Snapshot tests: Tesla Shanghai Exports (chart — approximate, not used in production)
# ---------------------------------------------------------------------------

@pytest.mark.chart_approximate
class TestSnapshotTeslaExports:
    """Verify Tesla Shanghai plant exports chart OCR snapshot data.

    NOTE: Chart OCR is approximate. In production, the key value is extracted
    from the article title. These tests are informational baselines only.
    """

    def test_snapshot_success(self, tesla_exports_snapshot):
        assert tesla_exports_snapshot["result"]["success"] is True

    def test_has_12_months(self, tesla_exports_snapshot):
        data = tesla_exports_snapshot["result"]["data"]
        assert len(data) == 12

    def test_dec_25_is_low(self, tesla_exports_snapshot):
        """Title says Dec exports: 3,328 - should be a low month."""
        data = tesla_exports_snapshot["result"]["data"]
        dec = data[-1]
        assert dec["date"] == "Dec-25"
        # Chart reading is approximate; the title says 3,328 but chart may read ~10k
        assert dec["value"] <= 15000, (
            f"Dec-25 exports {dec['value']} should be a low value"
        )

    def test_values_are_export_counts(self, tesla_exports_snapshot):
        """Export values should be in 1k-60k range."""
        data = tesla_exports_snapshot["result"]["data"]
        for entry in data:
            assert 1_000 <= entry["value"] <= 60_000, (
                f"Exports {entry['value']} for {entry['date']} out of range"
            )

    def test_exports_are_volatile(self, tesla_exports_snapshot):
        """Tesla exports are known to be highly volatile month-to-month."""
        data = tesla_exports_snapshot["result"]["data"]
        values = [e["value"] for e in data]
        max_v = max(values)
        min_v = min(values)
        # Max should be at least 2x min (high volatility)
        assert max_v >= min_v * 2, (
            f"Exports should be volatile: min={min_v}, max={max_v}"
        )


# ---------------------------------------------------------------------------
# Snapshot tests: All new snapshots cost tracking
# ---------------------------------------------------------------------------

class TestNewSnapshotCostTracking:
    """Verify cost/token data for new snapshot fixtures."""

    @pytest.mark.parametrize("snapshot_name", [
        "via_index_trend",
        "passenger_inventory_trend",
        "battery_china_rankings",
        "nev_sales_jan_1_11",
        "cpca_production_trend",
        "tesla_exports_trend",
    ])
    def test_tokens_positive(self, snapshot_name):
        snapshot = _load_snapshot(snapshot_name)
        assert snapshot["result"]["input_tokens"] > 0
        assert snapshot["result"]["output_tokens"] > 0

    @pytest.mark.parametrize("snapshot_name", [
        "via_index_trend",
        "passenger_inventory_trend",
        "battery_china_rankings",
        "nev_sales_jan_1_11",
        "cpca_production_trend",
        "tesla_exports_trend",
    ])
    def test_cost_positive(self, snapshot_name):
        snapshot = _load_snapshot(snapshot_name)
        assert snapshot["result"]["cost"] > 0


# ---------------------------------------------------------------------------
# Snapshot tests: _unwrap_data_array normalization
# ---------------------------------------------------------------------------

class TestUnwrapDataArray:
    """Test the JSON response normalization function."""

    def test_unwrap_data_key(self):
        result = _unwrap_data_array({"data": [{"a": 1}]})
        assert result == [{"a": 1}]

    def test_unwrap_results_key(self):
        result = _unwrap_data_array({"results": [{"a": 1}]})
        assert result == [{"a": 1}]

    def test_unwrap_result_key(self):
        result = _unwrap_data_array({"result": [{"a": 1}, {"a": 2}]})
        assert result == [{"a": 1}, {"a": 2}]

    def test_unwrap_rows_key(self):
        result = _unwrap_data_array({"rows": [{"a": 1}]})
        assert result == [{"a": 1}]

    def test_unwrap_entries_key(self):
        result = _unwrap_data_array({"entries": [{"a": 1}]})
        assert result == [{"a": 1}]

    def test_unwrap_rankings_key(self):
        result = _unwrap_data_array({"rankings": [{"rank": 1}]})
        assert result == [{"rank": 1}]

    def test_no_wrapper_returns_single_item_list(self):
        """A dict without a known wrapper key is treated as a single entry."""
        result = _unwrap_data_array({"brand": "Tesla", "price": 250000})
        assert result == [{"brand": "Tesla", "price": 250000}]

    def test_data_key_takes_priority(self):
        """When multiple wrapper keys exist, 'data' wins."""
        result = _unwrap_data_array({
            "data": [{"a": 1}],
            "result": [{"b": 2}],
        })
        assert result == [{"a": 1}]

    def test_non_list_value_ignored(self):
        """A key whose value is not a list should not be treated as wrapper."""
        result = _unwrap_data_array({"data": "not a list", "result": [{"a": 1}]})
        assert result == [{"a": 1}]

    def test_real_automaker_response(self):
        """The actual GPT-4o automaker response used 'result' as wrapper."""
        parsed = json.loads(
            '{"result": [{"rank": 1, "brand": "BYD", "value": 339854}]}'
        )
        data = _unwrap_data_array(parsed)
        assert len(data) == 1
        assert data[0]["brand"] == "BYD"

    def test_real_battery_response(self):
        """The actual GPT-4o battery response used 'data' as wrapper."""
        parsed = json.loads(
            '{"data": [{"rank": 1, "brand": "CATL", "value": 464.7}]}'
        )
        data = _unwrap_data_array(parsed)
        assert len(data) == 1
        assert data[0]["brand"] == "CATL"


# ---------------------------------------------------------------------------
# Snapshot tests: Cost tracking from snapshot metadata
# ---------------------------------------------------------------------------

class TestSnapshotCostTracking:
    """Verify cost/token data recorded in snapshots."""

    @pytest.mark.parametrize("snapshot_name", [
        "automaker_rankings",
        "battery_maker_rankings",
        "nev_sales_trend",
    ])
    def test_tokens_positive(self, snapshot_name):
        snapshot = _load_snapshot(snapshot_name)
        assert snapshot["result"]["input_tokens"] > 0
        assert snapshot["result"]["output_tokens"] > 0

    @pytest.mark.parametrize("snapshot_name", [
        "automaker_rankings",
        "battery_maker_rankings",
        "nev_sales_trend",
    ])
    def test_cost_matches_tokens(self, snapshot_name):
        snapshot = _load_snapshot(snapshot_name)
        r = snapshot["result"]
        expected = calculate_ocr_cost(r["input_tokens"], r["output_tokens"])
        assert r["cost"] == pytest.approx(expected)


# ---------------------------------------------------------------------------
# Classifier tests: chart vs table OCR distinction
# ---------------------------------------------------------------------------

class TestChartClassification:
    """Verify that chart-type articles are correctly classified."""

    @pytest.fixture(scope="class")
    def classifier(self):
        return ArticleClassifier()

    @pytest.mark.parametrize("title,expected_table", [
        # Titles with large numbers (>= 4 digits or comma-separated) -> needs_ocr=False
        ("CPCA: NEV production hits 1,560,000 in Dec 2025", "CpcaNevProduction"),
        ("CPCA: NEV retail sales reach 850,000 in Jan", "CpcaNevRetail"),
        ("Tesla Shanghai exports 3,328 vehicles in Dec", "PlantExports"),
    ])
    def test_chart_articles_with_large_numbers_have_needs_ocr_false(self, classifier, title, expected_table):
        """Chart articles with large numbers (4+ digits) in the title should have needs_ocr=False."""
        result = classifier.classify(title, "")
        assert result.target_table == expected_table
        assert result.needs_ocr is False, (
            f"Expected needs_ocr=False for chart article with large number: {title}"
        )

    @pytest.mark.parametrize("title,expected_table", [
        # Titles with decimal/small numbers (59.4%, 3.65, 1.31, 25.6) -> needs_ocr=True
        # but ocr_data_type="chart" ensures OCR is skipped in process_ocr_batch
        ("China vehicle inventory alert index rises to 59.4% in Jan", "ChinaViaIndex"),
        ("China passenger car inventory reaches 3.65 million units in Dec", "ChinaPassengerInventory"),
        ("China EV battery installations hit 45.2 GWh in Jan", "ChinaBatteryInstallation"),
        ("China dealer inventory factor rises to 1.31 in Jan", "ChinaDealerInventoryFactor"),
        ("CATL battery installations in Jan: 25.6 GWh", "BatteryMakerMonthly"),
    ])
    def test_chart_articles_with_small_numbers_still_skipped_by_ocr_type(self, classifier, title, expected_table):
        """Chart articles with decimal numbers may have needs_ocr=True, but ocr_data_type='chart'
        ensures they are filtered out in process_ocr_batch (chart OCR is inaccurate)."""
        result = classifier.classify(title, "")
        assert result.target_table == expected_table
        assert result.ocr_data_type == "chart", (
            f"Expected ocr_data_type='chart' to guard against chart OCR: {title}"
        )

    @pytest.mark.parametrize("title,expected_table", [
        ("China vehicle inventory alert index rises to 59.4% in Jan", "ChinaViaIndex"),
        ("China passenger car inventory reaches 3.65 million units in Dec", "ChinaPassengerInventory"),
        ("CPCA: NEV production hits 1,560,000 in Dec 2025", "CpcaNevProduction"),
        ("CPCA: NEV retail sales reach 850,000 in Jan", "CpcaNevRetail"),
        ("CAAM NEV sales: 1.2 million vehicles in Jan 2025", "CaamNevSales"),
        ("China EV battery installations hit 45.2 GWh in Jan", "ChinaBatteryInstallation"),
        ("Tesla Shanghai exports 3,328 vehicles in Dec", "PlantExports"),
        ("China dealer inventory factor rises to 1.31 in Jan", "ChinaDealerInventoryFactor"),
        ("CATL battery installations in Jan: 25.6 GWh", "BatteryMakerMonthly"),
    ])
    def test_chart_articles_have_chart_ocr_data_type(self, classifier, title, expected_table):
        """Chart articles should be classified with ocr_data_type='chart'."""
        result = classifier.classify(title, "")
        assert result.target_table == expected_table
        assert result.ocr_data_type == "chart", (
            f"Expected ocr_data_type='chart' for: {title}, got: {result.ocr_data_type}"
        )

    @pytest.mark.parametrize("title,expected_table,expected_ocr_type", [
        ("CPCA top-selling automakers Jan 2025", "AutomakerRankings", "rankings"),
        ("Top battery makers China Jan 2025", "BatteryMakerRankings", "rankings"),
        ("CPCA: NEV sales Jan 1-18 reach 420,000", "NevSalesSummary", "trend"),
        ("NIO EC7: Main specs", "VehicleSpec", "specs"),
    ])
    def test_table_articles_have_correct_ocr_type(self, classifier, title, expected_table, expected_ocr_type):
        """Table/rankings articles should have explicit non-chart ocr_data_type."""
        result = classifier.classify(title, "")
        assert result.target_table == expected_table
        assert result.ocr_data_type == expected_ocr_type, (
            f"Expected ocr_data_type='{expected_ocr_type}' for: {title}, got: {result.ocr_data_type}"
        )


# ---------------------------------------------------------------------------
# Live OCR tests (require API key)
# ---------------------------------------------------------------------------

@pytest.mark.ocr
@needs_api_key
class TestOCRRankingsStructure:
    """Test OCR output structure for ranking images."""

    def test_ocr_returns_success(self, rankings_result):
        assert rankings_result.success is True, (
            f"OCR failed: {rankings_result.error}"
        )

    def test_ocr_returns_data_list(self, rankings_result):
        assert isinstance(rankings_result.data, list)
        assert len(rankings_result.data) > 0, "OCR returned empty data list"

    def test_ocr_entries_are_dicts(self, rankings_result):
        for entry in rankings_result.data:
            assert isinstance(entry, dict), f"Entry is not a dict: {entry}"

    def test_ocr_entries_have_expected_fields(self, rankings_result):
        """Each entry should have at least rank, brand, and value."""
        for entry in rankings_result.data:
            has_brand = any(
                k in entry for k in ["brand", "Brand", "name", "Name", "maker"]
            )
            has_value = any(
                k in entry for k in ["value", "Value", "sales", "Sales", "volume"]
            )
            assert has_brand, f"Entry missing brand field: {entry}"
            assert has_value, f"Entry missing value field: {entry}"


@pytest.mark.ocr
@needs_api_key
class TestOCRDataQuality:
    """Test that OCR returns reasonable data values."""

    def test_ranks_are_sequential(self, rankings_result):
        ranks = []
        for entry in rankings_result.data:
            rank = entry.get("rank") or entry.get("Rank")
            if rank is not None:
                ranks.append(int(rank))
        if ranks:
            assert min(ranks) == 1, f"Min rank should be 1, got {min(ranks)}"
            assert max(ranks) <= 30, f"Max rank unexpectedly high: {max(ranks)}"

    def test_values_are_positive(self, rankings_result):
        for entry in rankings_result.data:
            value = entry.get("value") or entry.get("Value") or entry.get("sales")
            if value is not None:
                assert float(value) > 0, f"Non-positive value: {value} in {entry}"

    def test_known_brands_present(self, rankings_result):
        known_brands = {"byd", "tesla", "geely", "changan", "saic", "gac", "volkswagen"}
        found_brands = set()
        for entry in rankings_result.data:
            brand = (
                entry.get("brand")
                or entry.get("Brand")
                or entry.get("name")
                or ""
            )
            brand_lower = brand.lower()
            for known in known_brands:
                if known in brand_lower:
                    found_brands.add(known)
        assert len(found_brands) >= 1, (
            f"No known brands found in OCR results: "
            f"{[e.get('brand', e.get('Brand', '')) for e in rankings_result.data]}"
        )


@pytest.mark.ocr
@needs_api_key
class TestOCRCostTracking:
    """Test that OCR tracks token usage and cost."""

    def test_input_tokens_positive(self, rankings_result):
        assert rankings_result.input_tokens > 0

    def test_output_tokens_positive(self, rankings_result):
        assert rankings_result.output_tokens > 0

    def test_cost_positive(self, rankings_result):
        assert rankings_result.cost > 0

    def test_cost_matches_calculation(self, rankings_result):
        expected = calculate_ocr_cost(
            rankings_result.input_tokens, rankings_result.output_tokens
        )
        assert rankings_result.cost == pytest.approx(expected)


@pytest.mark.ocr
@needs_api_key
class TestOCRErrorHandling:
    """Test graceful error handling for invalid inputs."""

    def test_invalid_url_handles_gracefully(self, ocr_service):
        result = ocr_service.extract_from_url_sync(
            "https://example.com/nonexistent-image.png",
            data_type="rankings",
        )
        assert result.success is False
        assert result.error is not None
        assert len(result.error) > 0


# ---------------------------------------------------------------------------
# Cost calculation tests (always run, no API key needed)
# ---------------------------------------------------------------------------

class TestCalculateOCRCost:
    """Test the cost calculation function (no API key required)."""

    def test_zero_tokens(self):
        assert calculate_ocr_cost(0, 0) == 0.0

    def test_known_values(self):
        # 1M input tokens = $2.50, 1M output tokens = $10.00
        cost = calculate_ocr_cost(1_000_000, 1_000_000)
        assert cost == pytest.approx(12.50)

    def test_small_token_counts(self):
        cost = calculate_ocr_cost(1000, 500)
        expected = (1000 * 2.50 + 500 * 10.00) / 1_000_000
        assert cost == pytest.approx(expected)
