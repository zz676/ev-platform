"""HTTP client for submitting data to EV Platform industry table APIs."""

import json
import logging
from typing import Optional
from dataclasses import dataclass

import requests

logger = logging.getLogger(__name__)


@dataclass
class APIResponse:
    """Response from API submission."""
    success: bool
    status_code: int
    data: Optional[dict] = None
    error: Optional[str] = None


class EVPlatformAPI:
    """Client for submitting data to new industry table APIs."""

    # Map table names to API endpoint paths (kebab-case)
    TABLE_TO_ENDPOINT = {
        "ChinaPassengerInventory": "china-passenger-inventory",
        "ChinaBatteryInstallation": "china-battery-installation",
        "CaamNevSales": "caam-nev-sales",
        "ChinaDealerInventoryFactor": "china-dealer-inventory-factor",
        "CpcaNevRetail": "cpca-nev-retail",
        "CpcaNevProduction": "cpca-nev-production",
        "ChinaViaIndex": "china-via-index",
        "BatteryMakerMonthly": "battery-maker-monthly",
        "PlantExports": "plant-exports",
        "NevSalesSummary": "nev-sales-summary",
        "AutomakerRankings": "automaker-rankings",
        "BatteryMakerRankings": "battery-maker-rankings",
        "NioPowerSnapshot": "nio-power-snapshot",
        # Existing tables
        "EVMetric": "ev-metrics",
        "VehicleSpec": "vehicle-specs",
    }

    # Tables that are industry-level (new tables)
    INDUSTRY_TABLES = set(TABLE_TO_ENDPOINT.keys()) - {"EVMetric", "VehicleSpec"}

    def __init__(self, base_url: str, timeout: int = 30):
        """Initialize the API client.

        Args:
            base_url: Base URL of the EV Platform API (e.g., "https://ev-platform.vercel.app")
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Accept": "application/json",
        })

    def _get_endpoint(self, table_name: str) -> str:
        """Get the API endpoint path for a table.

        Args:
            table_name: Name of the table (e.g., "ChinaBatteryInstallation")

        Returns:
            Full endpoint URL
        """
        endpoint_path = self.TABLE_TO_ENDPOINT.get(table_name)
        if not endpoint_path:
            raise ValueError(f"Unknown table: {table_name}")
        return f"{self.base_url}/api/{endpoint_path}"

    def submit(self, table_name: str, data: dict) -> APIResponse:
        """Submit data to an industry table API.

        Args:
            table_name: Target table name (e.g., "ChinaBatteryInstallation")
            data: Dictionary of data to submit

        Returns:
            APIResponse with result
        """
        try:
            endpoint = self._get_endpoint(table_name)

            # Remove internal fields (start with _)
            clean_data = {k: v for k, v in data.items() if not k.startswith("_")}

            logger.info(f"Submitting to {endpoint}: {json.dumps(clean_data)[:200]}...")

            response = self.session.post(
                endpoint,
                json=clean_data,
                timeout=self.timeout,
            )

            if response.ok:
                result = response.json()
                logger.info(f"API success for {table_name}: {result}")
                return APIResponse(
                    success=True,
                    status_code=response.status_code,
                    data=result,
                )
            else:
                error_text = response.text[:500]
                logger.error(f"API error for {table_name}: {response.status_code} - {error_text}")
                return APIResponse(
                    success=False,
                    status_code=response.status_code,
                    error=error_text,
                )

        except requests.exceptions.Timeout:
            logger.error(f"Timeout submitting to {table_name}")
            return APIResponse(
                success=False,
                status_code=0,
                error="Request timeout",
            )
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error submitting to {table_name}: {e}")
            return APIResponse(
                success=False,
                status_code=0,
                error=str(e),
            )
        except Exception as e:
            logger.error(f"Unexpected error submitting to {table_name}: {e}")
            return APIResponse(
                success=False,
                status_code=0,
                error=str(e),
            )

    def submit_batch(self, table_name: str, records: list[dict]) -> list[APIResponse]:
        """Submit multiple records to an industry table API.

        Args:
            table_name: Target table name
            records: List of data dictionaries to submit

        Returns:
            List of APIResponse objects
        """
        responses = []
        for record in records:
            response = self.submit(table_name, record)
            responses.append(response)
        return responses

    def submit_rankings(
        self,
        table_name: str,
        rankings_data: list[dict],
        base_info: dict,
    ) -> list[APIResponse]:
        """Submit rankings data (multiple rows from OCR).

        Args:
            table_name: "AutomakerRankings" or "BatteryMakerRankings"
            rankings_data: List of ranking entries from OCR
            base_info: Common info for all entries (year, month, sourceUrl, etc.)

        Returns:
            List of APIResponse objects for each entry
        """
        responses = []

        for entry in rankings_data:
            # Merge base info with entry data
            record = {**base_info}

            # Map OCR fields to API fields
            if table_name == "AutomakerRankings":
                record["ranking"] = entry.get("rank", entry.get("ranking"))
                record["automaker"] = entry.get("brand", entry.get("automaker"))
                record["value"] = entry.get("value", entry.get("sales"))
                if "yoy" in entry:
                    record["yoyChange"] = entry["yoy"]
                if "mom" in entry:
                    record["momChange"] = entry["mom"]
                if "share" in entry:
                    record["marketShare"] = entry["share"]

            elif table_name == "BatteryMakerRankings":
                record["ranking"] = entry.get("rank", entry.get("ranking"))
                record["maker"] = entry.get("brand", entry.get("maker", entry.get("company")))
                record["value"] = entry.get("value", entry.get("installation"))
                if "yoy" in entry:
                    record["yoyChange"] = entry["yoy"]
                if "share" in entry:
                    record["marketShare"] = entry["share"]

            # Only submit if we have required fields
            if record.get("ranking") and (record.get("automaker") or record.get("maker")) and record.get("value"):
                response = self.submit(table_name, record)
                responses.append(response)
            else:
                logger.warning(f"Skipping incomplete ranking entry: {entry}")

        return responses

    def check_health(self) -> bool:
        """Check if the API is reachable.

        Returns:
            True if API is healthy, False otherwise
        """
        try:
            # Try to hit a simple endpoint
            response = self.session.get(
                f"{self.base_url}/api/ev-metrics?limit=1",
                timeout=10,
            )
            return response.ok
        except Exception:
            return False

    def track_ocr_usage(
        self,
        input_tokens: int,
        output_tokens: int,
        cost: float,
        success: bool,
        error_msg: Optional[str] = None,
        source: str = "ocr_backfill",
        duration_ms: Optional[int] = None,
    ) -> APIResponse:
        """Submit OCR usage data to the AI usage tracking API.

        Args:
            input_tokens: Number of input tokens (includes image tokens)
            output_tokens: Number of output tokens
            cost: Calculated cost in dollars
            success: Whether the OCR call was successful
            error_msg: Error message if failed
            source: Source identifier (default: "ocr_backfill")
            duration_ms: Request duration in milliseconds

        Returns:
            APIResponse with result
        """
        try:
            endpoint = f"{self.base_url}/api/admin/ai-usage"

            data = {
                "type": "ocr",
                "model": "gpt-4o",
                "cost": cost,
                "success": success,
                "inputTokens": input_tokens,
                "outputTokens": output_tokens,
                "source": source,
            }

            if error_msg:
                data["errorMsg"] = error_msg

            if duration_ms is not None:
                data["durationMs"] = duration_ms

            logger.debug(f"Tracking OCR usage: {data}")

            response = self.session.post(
                endpoint,
                json=data,
                timeout=self.timeout,
            )

            if response.ok:
                result = response.json()
                logger.debug(f"OCR usage tracked: {result}")
                return APIResponse(
                    success=True,
                    status_code=response.status_code,
                    data=result,
                )
            else:
                error_text = response.text[:500]
                logger.warning(f"Failed to track OCR usage: {response.status_code} - {error_text}")
                return APIResponse(
                    success=False,
                    status_code=response.status_code,
                    error=error_text,
                )

        except requests.exceptions.Timeout:
            logger.warning("Timeout tracking OCR usage")
            return APIResponse(
                success=False,
                status_code=0,
                error="Request timeout",
            )
        except Exception as e:
            logger.warning(f"Error tracking OCR usage: {e}")
            return APIResponse(
                success=False,
                status_code=0,
                error=str(e),
            )

    @classmethod
    def is_industry_table(cls, table_name: str) -> bool:
        """Check if a table is one of the new industry tables.

        Args:
            table_name: Table name to check

        Returns:
            True if it's an industry table
        """
        return table_name in cls.INDUSTRY_TABLES


def test_api_client():
    """Test the API client (requires running server)."""
    from config import WEBHOOK_URL

    # Derive base URL from webhook URL
    base_url = WEBHOOK_URL.replace("/api/webhook", "")
    print(f"Testing API client with base URL: {base_url}")

    client = EVPlatformAPI(base_url)

    # Check health
    healthy = client.check_health()
    print(f"API healthy: {healthy}")

    if not healthy:
        print("API not reachable, skipping tests")
        return

    # Test data submission (dry run - just check endpoint construction)
    print("\nEndpoint mappings:")
    for table_name, endpoint in client.TABLE_TO_ENDPOINT.items():
        full_url = client._get_endpoint(table_name)
        print(f"  {table_name} -> {full_url}")


if __name__ == "__main__":
    test_api_client()
