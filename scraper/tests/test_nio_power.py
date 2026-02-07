"""Tests for NIO Power charger map scraper."""

import pytest
from datetime import datetime

from sources.nio_power import (
    parse_timestamp,
    find_number_after,
    find_float_after,
    find_slash_numbers,
    parse_metrics_from_text,
    NioPowerData,
)


# Sample text matching structured JS extraction output.
# Static values grouped per <h6> label (multiple <strong> joined with " / ").
# Animated digit-flip values have digits concatenated.
SAMPLE_PAGE_TEXT = """
蔚来能源充换电站总数 8,627
蔚来能源换电站 3,729
其中高速公路换电站 1,020
蔚来能源充电站 4,898 / 28,035
接入第三方充电桩 1,557,463
实时累计换电次数 100,016,310
实时累计充电次数 81,009,854
蔚来能源充电桩电量第三方用户占比 85.85%
截至 2026.02.06 15:29:51
"""


class TestNioPowerTimestampParsing:
    """Tests for timestamp parsing from page text."""

    def test_standard_timestamp(self):
        result = parse_timestamp("截至 2026.02.06 15:29:51")
        assert result == datetime(2026, 2, 6, 15, 29, 51)

    def test_no_seconds_timestamp(self):
        result = parse_timestamp("截至 2026.02.06 15:29")
        assert result == datetime(2026, 2, 6, 15, 29, 0)

    def test_embedded_in_text(self):
        text = "一些文字 截至 2026.02.06 15:29:51 更多文字"
        result = parse_timestamp(text)
        assert result == datetime(2026, 2, 6, 15, 29, 51)

    def test_empty_text(self):
        assert parse_timestamp("") is None
        assert parse_timestamp(None) is None

    def test_no_timestamp(self):
        assert parse_timestamp("没有时间戳的文字") is None

    def test_whitespace_variations(self):
        result = parse_timestamp("截至  2026.02.06  15:29:51")
        assert result == datetime(2026, 2, 6, 15, 29, 51)


class TestNioPowerNumberParsing:
    """Tests for number extraction helpers."""

    def test_find_number_with_commas(self):
        text = "蔚来能源充换电站总数\n8,627"
        result = find_number_after("蔚来能源充换电站总数", text)
        assert result == 8627

    def test_find_number_no_commas(self):
        text = "蔚来能源换电站\n3729"
        result = find_number_after("蔚来能源换电站", text)
        assert result == 3729

    def test_find_large_number(self):
        text = "实时累计换电次数\n100,016,310"
        result = find_number_after("实时累计换电次数", text)
        assert result == 100016310

    def test_find_number_missing(self):
        text = "没有这个标签的内容"
        result = find_number_after("蔚来能源换电站", text)
        assert result is None

    def test_find_float(self):
        text = "蔚来能源充电桩电量第三方用户占比\n85.85%"
        result = find_float_after("第三方用户占比", text)
        assert result == 85.85

    def test_find_float_no_percent(self):
        text = "第三方用户占比\n85.85"
        result = find_float_after("第三方用户占比", text)
        assert result == 85.85

    def test_find_slash_numbers(self):
        text = "蔚来能源充电站 / 充电桩\n4,898 / 28,035"
        result = find_slash_numbers("蔚来能源充电站", text)
        assert result == (4898, 28035)

    def test_find_slash_numbers_no_commas(self):
        text = "蔚来能源充电站 / 充电桩\n4898 / 28035"
        result = find_slash_numbers("蔚来能源充电站", text)
        assert result == (4898, 28035)

    def test_find_slash_numbers_missing(self):
        text = "没有这个标签"
        result = find_slash_numbers("蔚来能源充电站", text)
        assert result is None


class TestNioPowerTextParsing:
    """Tests for full page text parsing."""

    def test_full_sample_text(self):
        result = parse_metrics_from_text(SAMPLE_PAGE_TEXT)
        assert result is not None
        assert result.as_of_time == datetime(2026, 2, 6, 15, 29, 51)
        assert result.total_stations == 8627
        assert result.swap_stations == 3729
        assert result.highway_swap_stations == 1020
        assert result.cumulative_swaps == 100016310
        assert result.charging_stations == 4898
        assert result.charging_piles == 28035
        assert result.cumulative_charges == 81009854
        assert result.third_party_piles == 1557463
        assert result.third_party_usage_percent == 85.85

    def test_empty_text_returns_none(self):
        assert parse_metrics_from_text("") is None
        assert parse_metrics_from_text(None) is None

    def test_no_timestamp_returns_none(self):
        text = "蔚来能源充换电站总数\n8,627\n蔚来能源换电站\n3,729"
        assert parse_metrics_from_text(text) is None

    def test_too_many_missing_fields(self):
        # Only timestamp and 1 field = 6 missing out of 7 required
        text = "截至 2026.02.06 15:29:51\n蔚来能源充换电站总数\n8,627"
        result = parse_metrics_from_text(text)
        assert result is None

    def test_partial_data_above_threshold(self):
        # 4 out of 7 required fields present (3 missing = threshold)
        text = """截至 2026.02.06 15:29:51
蔚来能源充换电站总数 8,627
蔚来能源换电站 3,729
其中高速公路换电站 1,020
实时累计换电次数 100,016,310
蔚来能源充电站 4,898 / 28,035
"""
        result = parse_metrics_from_text(text)
        assert result is not None
        assert result.total_stations == 8627
        # Missing fields default to 0
        assert result.cumulative_charges == 0
        assert result.third_party_piles == 0


class TestNioPowerDataSerialization:
    """Tests for NioPowerData.to_api_dict()."""

    def test_to_api_dict_keys(self):
        data = NioPowerData(
            as_of_time=datetime(2026, 2, 6, 15, 29, 51),
            total_stations=8627,
            swap_stations=3729,
            highway_swap_stations=1020,
            cumulative_swaps=100016310,
            charging_stations=4898,
            charging_piles=28035,
            cumulative_charges=81009854,
            third_party_piles=1557463,
            third_party_usage_percent=85.85,
        )

        api_dict = data.to_api_dict()

        expected_keys = {
            "asOfTime",
            "totalStations",
            "swapStations",
            "highwaySwapStations",
            "cumulativeSwaps",
            "chargingStations",
            "chargingPiles",
            "cumulativeCharges",
            "thirdPartyPiles",
            "thirdPartyUsagePercent",
        }
        assert set(api_dict.keys()) == expected_keys

    def test_to_api_dict_types(self):
        data = NioPowerData(
            as_of_time=datetime(2026, 2, 6, 15, 29, 51),
            total_stations=8627,
            swap_stations=3729,
            highway_swap_stations=1020,
            cumulative_swaps=100016310,
            charging_stations=4898,
            charging_piles=28035,
            cumulative_charges=81009854,
            third_party_piles=1557463,
            third_party_usage_percent=85.85,
        )

        api_dict = data.to_api_dict()

        # asOfTime should be ISO format string
        assert isinstance(api_dict["asOfTime"], str)
        assert "2026-02-06" in api_dict["asOfTime"]

        # Integer fields
        assert isinstance(api_dict["totalStations"], int)
        assert isinstance(api_dict["cumulativeSwaps"], int)

        # Float field
        assert isinstance(api_dict["thirdPartyUsagePercent"], float)

    def test_to_api_dict_values(self):
        dt = datetime(2026, 2, 6, 15, 29, 51)
        data = NioPowerData(
            as_of_time=dt,
            total_stations=8627,
            swap_stations=3729,
            highway_swap_stations=1020,
            cumulative_swaps=100016310,
            charging_stations=4898,
            charging_piles=28035,
            cumulative_charges=81009854,
            third_party_piles=1557463,
            third_party_usage_percent=85.85,
        )

        api_dict = data.to_api_dict()

        assert api_dict["asOfTime"] == dt.isoformat()
        assert api_dict["totalStations"] == 8627
        assert api_dict["cumulativeSwaps"] == 100016310
        assert api_dict["thirdPartyUsagePercent"] == 85.85
