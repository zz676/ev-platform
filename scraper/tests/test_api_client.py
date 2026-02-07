"""Tests for EVPlatformAPI pre-submission validation."""

from unittest.mock import patch, MagicMock

import pytest

from api_client import EVPlatformAPI, APIResponse


@pytest.fixture
def client():
    return EVPlatformAPI(base_url="https://example.com")


def _complete_payload(table_name: str) -> dict:
    """Return a minimal complete payload for the given table."""
    base = {"year": 2025, "month": 1, "sourceUrl": "https://example.com", "sourceTitle": "Test"}
    extras = {
        "ChinaBatteryInstallation": {"installation": 50.0},
        "CaamNevSales": {"value": 100000},
        "ChinaDealerInventoryFactor": {"value": 1.5},
        "CpcaNevRetail": {"value": 200000},
        "CpcaNevProduction": {"value": 180000},
        "ChinaViaIndex": {"value": 55.0},
        "ChinaPassengerInventory": {"value": 3000000},
        "BatteryMakerMonthly": {"maker": "CATL", "installation": 30.0},
        "PlantExports": {"plant": "Shanghai", "brand": "Tesla", "value": 50000},
        "NevSalesSummary": {"startDate": "2025-01-01", "endDate": "2025-01-07", "retailSales": 120000},
        "AutomakerRankings": {"ranking": 1, "automaker": "BYD", "value": 300000},
        "BatteryMakerRankings": {"ranking": 1, "maker": "CATL", "value": 25.0},
    }
    # NevSalesSummary doesn't use month
    if table_name == "NevSalesSummary":
        payload = {"year": 2025, "sourceUrl": "https://example.com", "sourceTitle": "Test"}
    else:
        payload = dict(base)
    payload.update(extras.get(table_name, {}))
    return payload


class TestSubmitValidation:
    """Tests for required-field validation in submit()."""

    def test_submit_rejects_missing_required_field(self, client):
        """submit() should reject a payload missing a required field."""
        data = {"year": 2025, "month": 1, "sourceUrl": "https://x.com", "sourceTitle": "T"}
        # Missing 'value' for CaamNevSales
        result = client.submit("CaamNevSales", data)

        assert not result.success
        assert result.status_code == 0
        assert "value" in result.error
        assert "Missing required fields" in result.error

    def test_submit_rejects_none_required_field(self, client):
        """submit() should reject a payload where a required field is None."""
        data = {
            "year": 2025, "month": 1, "value": None,
            "sourceUrl": "https://x.com", "sourceTitle": "T",
        }
        result = client.submit("CaamNevSales", data)

        assert not result.success
        assert result.status_code == 0
        assert "value" in result.error

    def test_submit_rejects_multiple_missing_fields(self, client):
        """Error message should list all missing fields."""
        data = {"year": 2025}
        result = client.submit("CaamNevSales", data)

        assert not result.success
        for field in ["month", "value", "sourceUrl", "sourceTitle"]:
            assert field in result.error

    @patch("api_client.requests.Session")
    def test_submit_allows_complete_payload(self, mock_session_cls, client):
        """submit() should make the HTTP call when all required fields are present."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": 1}
        client.session.post = MagicMock(return_value=mock_response)

        data = _complete_payload("CaamNevSales")
        result = client.submit("CaamNevSales", data)

        assert result.success
        assert result.status_code == 200
        client.session.post.assert_called_once()

    @patch("api_client.requests.Session")
    def test_submit_allows_unknown_table(self, mock_session_cls, client):
        """Tables not in REQUIRED_FIELDS should skip validation (forward-compatible)."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": 1}
        client.session.post = MagicMock(return_value=mock_response)

        # EVMetric is not in REQUIRED_FIELDS
        data = {"brand": "BYD", "value": 100}
        result = client.submit("EVMetric", data)

        assert result.success
        client.session.post.assert_called_once()

    def test_submit_strips_internal_fields_before_validation(self, client):
        """Internal _-prefixed fields should be stripped before validation, not counted as missing."""
        data = {
            "_internal": "should be stripped",
            "year": 2025, "month": 1,
            "sourceUrl": "https://x.com", "sourceTitle": "T",
            # Missing 'value'
        }
        result = client.submit("CaamNevSales", data)

        assert not result.success
        assert "value" in result.error
        # _internal should not appear in the error
        assert "_internal" not in result.error

    def test_validation_does_not_make_http_call(self, client):
        """When validation fails, no HTTP request should be made."""
        with patch.object(client.session, "post") as mock_post:
            client.submit("CaamNevSales", {"year": 2025})
            mock_post.assert_not_called()


class TestRequiredFieldsCoverage:
    """Verify REQUIRED_FIELDS covers all industry tables."""

    def test_all_industry_tables_have_required_fields(self):
        """Every industry table should have an entry in REQUIRED_FIELDS."""
        # NioPowerSnapshot is excluded — it doesn't go through the standard extraction flow
        exempted = {"NioPowerSnapshot"}
        for table in EVPlatformAPI.INDUSTRY_TABLES - exempted:
            assert table in EVPlatformAPI.REQUIRED_FIELDS, (
                f"Industry table {table} missing from REQUIRED_FIELDS"
            )

    @pytest.mark.parametrize("table_name", list(EVPlatformAPI.REQUIRED_FIELDS.keys()))
    def test_complete_payload_passes_validation(self, table_name):
        """A complete payload for each table should pass validation."""
        client = EVPlatformAPI(base_url="https://example.com")
        data = _complete_payload(table_name)

        with patch.object(client.session, "post") as mock_post:
            mock_response = MagicMock()
            mock_response.ok = True
            mock_response.status_code = 200
            mock_response.json.return_value = {"id": 1}
            mock_post.return_value = mock_response

            result = client.submit(table_name, data)
            assert result.success, f"Complete payload for {table_name} should pass validation, got: {result.error}"
            mock_post.assert_called_once()
