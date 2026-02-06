"""GPT-4o Vision OCR for extracting data from images."""

import json
import os
import time
from typing import Optional
from dataclasses import dataclass

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


@dataclass
class OCRResult:
    """Result of OCR extraction."""
    success: bool
    data: list[dict]  # Extracted data as list of dicts
    raw_response: str
    error: Optional[str] = None
    confidence: float = 0.9  # OCR data has lower confidence
    input_tokens: int = 0
    output_tokens: int = 0
    cost: float = 0.0
    duration_ms: int = 0  # Request duration in milliseconds


# GPT-4o Vision pricing (per 1M tokens, as of 2024)
GPT4O_PRICING = {
    "input": 2.50,   # $2.50 per 1M input tokens
    "output": 10.00,  # $10.00 per 1M output tokens
}


def calculate_ocr_cost(input_tokens: int, output_tokens: int) -> float:
    """Calculate cost for GPT-4o Vision OCR call.

    Args:
        input_tokens: Number of input tokens (includes image tokens)
        output_tokens: Number of output tokens

    Returns:
        Cost in dollars
    """
    return (input_tokens * GPT4O_PRICING["input"] + output_tokens * GPT4O_PRICING["output"]) / 1_000_000


def _unwrap_data_array(parsed: dict) -> list:
    """Unwrap a dict response into a flat list of data entries.

    GPT-4o Vision may wrap the array in various wrapper keys like
    "data", "results", "result", "rows", or "entries". This function
    extracts the inner list regardless of wrapper key name.
    """
    # Known wrapper keys (order: most common first)
    for key in ("data", "results", "result", "rows", "entries", "rankings"):
        if key in parsed and isinstance(parsed[key], list):
            return parsed[key]
    # No recognized wrapper — treat as a single object (e.g., vehicle spec)
    return [parsed]


class ImageOCR:
    """Extract data from images using GPT-4o Vision."""

    # Prompt templates for different data types
    PROMPTS = {
        "rankings": """
Extract ALL data from every column in this rankings/leaderboard table image.
Return as a JSON array with each entry containing:
- rank: ranking position (integer)
- brand: brand/company name (string)
- value: the most recent period's value (integer or float)
- prior_value: prior period's value if shown (integer or float, optional)
- mom: month-over-month change % (float, negative if down, optional)
- yoy: year-over-year change % (float, negative if down, optional)
- share: most recent market share % (float, optional)
- prior_share: prior period's market share % (float, optional)

IMPORTANT: Extract ALL columns visible in the table. If the table shows data for
multiple time periods (e.g., "Jan-Dec 2024" and "Jan-Dec 2025"), include both as
"prior_value" and "value". If there are multiple share columns (e.g., "2024 Share"
and "2025 Share"), include both as "prior_share" and "share".

Only include fields that are visible in the table.
Example format:
[{"rank": 1, "brand": "BYD", "value": 339854, "mom": 13.6, "yoy": -15.7, "share": 25.4}]
[{"rank": 1, "brand": "CATL", "prior_value": 342.5, "value": 464.7, "yoy": 35.7, "prior_share": 38.0, "share": 39.2}]
""",

        "metrics": """
Extract all numerical data from this table image.
Return as a JSON array with each row containing all visible columns.
Common fields:
- brand: brand/company name
- value: main numeric value
- mom: month-over-month change %
- yoy: year-over-year change %
- share: market share %

Preserve negative values for declines.
Example: [{"brand": "Tesla", "value": 68280, "yoy": 15.2, "mom": -5.3}]
""",

        "specs": """
Extract vehicle specifications from this image.
Return as a JSON object with these fields (use null for missing data):
{
  "brand": "brand name",
  "model": "model name",
  "variant": "trim/variant name",
  "price": starting price in RMB (integer),
  "length_mm": length in mm (integer),
  "width_mm": width in mm (integer),
  "height_mm": height in mm (integer),
  "wheelbase_mm": wheelbase in mm (integer),
  "battery_kwh": battery capacity in kWh (float),
  "range_km": CLTC range in km (integer),
  "motor_kw": motor power in kW (integer),
  "acceleration": 0-100km/h in seconds (float),
  "top_speed": top speed in km/h (integer),
  "vehicle_type": "BEV" or "PHEV" or "EREV"
}
""",

        "trend": """
Extract ALL data from every column in this time-series table or trend chart.
The image may contain line charts, bar charts, or tables showing data over time.

Return as a JSON array sorted by date (earliest first), with each entry containing:
- date: date or period label as shown (string, e.g., "20251201-20251207")
- value: the primary metric value (integer or float)
- yoy: year-over-year change % (float, optional, negative if down)
- mom: month-over-month change % (float, optional, negative if down)
- label: any series/category label if multiple data series are shown (string, optional)

IMPORTANT: If the table has separate columns for different data series (e.g.,
"NEV Retail" and "NEV Wholesale"), create a separate entry for each series at each
time point. Each series may have its own YoY and MoM columns — extract ALL of them.

If the image contains a data table instead of (or in addition to) a chart, extract
the table data. Prefer table data over visually estimated chart values.

Example (table with retail and wholesale, each with YoY and MoM):
[
  {"date": "20251201-20251207", "value": 185000, "yoy": -17.0, "mom": -10.0, "label": "NEV Retail"},
  {"date": "20251201-20251207", "value": 191000, "yoy": -22.0, "mom": -20.0, "label": "NEV Wholesale"}
]
""",

        "general": """
Extract all tabular data from this image.
Return as a JSON array where each element represents a row.
Preserve all column names and values exactly as shown.
Use appropriate data types: integers for counts, floats for percentages.
Mark percentage changes as negative if they indicate decline.
"""
    }

    def __init__(self, api_key: str = None):
        """Initialize the OCR service.

        Args:
            api_key: OpenAI API key. If None, uses OPENAI_API_KEY env var.
        """
        if OpenAI is None:
            raise ImportError("openai package not installed. Run: pip install openai")

        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key not provided")

        self.client = OpenAI(api_key=self.api_key)
        self.model = "gpt-4o"

    async def extract_from_url(
        self,
        image_url: str,
        data_type: str = "general"
    ) -> OCRResult:
        """Extract data from an image URL.

        Args:
            image_url: URL of the image to process
            data_type: Type of data to extract ("rankings", "metrics", "specs", "general")

        Returns:
            OCRResult with extracted data
        """
        prompt = self.PROMPTS.get(data_type, self.PROMPTS["general"])

        start_time = time.monotonic()
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": image_url, "detail": "high"}
                            }
                        ]
                    }
                ],
                response_format={"type": "json_object"},
                max_tokens=4096,
            )
            duration_ms = int((time.monotonic() - start_time) * 1000)

            content = response.choices[0].message.content

            # Extract token usage
            input_tokens = response.usage.prompt_tokens if response.usage else 0
            output_tokens = response.usage.completion_tokens if response.usage else 0
            cost = calculate_ocr_cost(input_tokens, output_tokens)

            # Parse JSON response
            try:
                parsed = json.loads(content)
                # Normalize to list format
                if isinstance(parsed, dict):
                    data = _unwrap_data_array(parsed)
                else:
                    data = parsed

                return OCRResult(
                    success=True,
                    data=data,
                    raw_response=content,
                    confidence=0.9,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost=cost,
                    duration_ms=duration_ms
                )

            except json.JSONDecodeError as e:
                return OCRResult(
                    success=False,
                    data=[],
                    raw_response=content,
                    error=f"JSON parse error: {str(e)}",
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost=cost,
                    duration_ms=duration_ms
                )

        except Exception as e:
            duration_ms = int((time.monotonic() - start_time) * 1000)
            return OCRResult(
                success=False,
                data=[],
                raw_response="",
                error=str(e),
                duration_ms=duration_ms
            )

    def extract_from_url_sync(
        self,
        image_url: str,
        data_type: str = "general"
    ) -> OCRResult:
        """Synchronous version of extract_from_url.

        Args:
            image_url: URL of the image to process
            data_type: Type of data to extract

        Returns:
            OCRResult with extracted data
        """
        prompt = self.PROMPTS.get(data_type, self.PROMPTS["general"])

        start_time = time.monotonic()
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": image_url, "detail": "high"}
                            }
                        ]
                    }
                ],
                response_format={"type": "json_object"},
                max_tokens=4096,
            )
            duration_ms = int((time.monotonic() - start_time) * 1000)

            content = response.choices[0].message.content

            # Extract token usage
            input_tokens = response.usage.prompt_tokens if response.usage else 0
            output_tokens = response.usage.completion_tokens if response.usage else 0
            cost = calculate_ocr_cost(input_tokens, output_tokens)

            try:
                parsed = json.loads(content)
                if isinstance(parsed, dict):
                    data = _unwrap_data_array(parsed)
                else:
                    data = parsed

                return OCRResult(
                    success=True,
                    data=data,
                    raw_response=content,
                    confidence=0.9,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost=cost,
                    duration_ms=duration_ms
                )

            except json.JSONDecodeError as e:
                return OCRResult(
                    success=False,
                    data=[],
                    raw_response=content,
                    error=f"JSON parse error: {str(e)}",
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost=cost,
                    duration_ms=duration_ms
                )

        except Exception as e:
            duration_ms = int((time.monotonic() - start_time) * 1000)
            return OCRResult(
                success=False,
                data=[],
                raw_response="",
                error=str(e),
                duration_ms=duration_ms
            )


# Test function
def test_ocr():
    """Test OCR with a sample image (requires API key)."""
    try:
        ocr = ImageOCR()
        print("ImageOCR initialized successfully")
        print("To test, call: ocr.extract_from_url_sync(image_url, 'rankings')")
    except Exception as e:
        print(f"Could not initialize OCR: {e}")


if __name__ == "__main__":
    test_ocr()
