"""GPT-4o Vision OCR for extracting data from images."""

import json
import os
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


class ImageOCR:
    """Extract data from images using GPT-4o Vision."""

    # Prompt templates for different data types
    PROMPTS = {
        "rankings": """
Extract all data from this rankings/leaderboard table image.
Return as a JSON array with each entry containing:
- rank: ranking position (integer)
- brand: brand/company name (string)
- value: sales/delivery count (integer)
- mom: month-over-month change % (float, negative if down)
- yoy: year-over-year change % (float, negative if down)
- share: market share % (float, optional)

Only include fields that are visible in the table.
Example format:
[{"rank": 1, "brand": "BYD", "value": 339854, "mom": 13.6, "yoy": -15.7, "share": 25.4}]
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
                    # Check if it's a wrapper with a data array
                    if "data" in parsed:
                        data = parsed["data"]
                    elif "results" in parsed:
                        data = parsed["results"]
                    elif "rows" in parsed:
                        data = parsed["rows"]
                    else:
                        # Single spec object
                        data = [parsed]
                else:
                    data = parsed

                return OCRResult(
                    success=True,
                    data=data,
                    raw_response=content,
                    confidence=0.9,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost=cost
                )

            except json.JSONDecodeError as e:
                return OCRResult(
                    success=False,
                    data=[],
                    raw_response=content,
                    error=f"JSON parse error: {str(e)}",
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost=cost
                )

        except Exception as e:
            return OCRResult(
                success=False,
                data=[],
                raw_response="",
                error=str(e)
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

            content = response.choices[0].message.content

            # Extract token usage
            input_tokens = response.usage.prompt_tokens if response.usage else 0
            output_tokens = response.usage.completion_tokens if response.usage else 0
            cost = calculate_ocr_cost(input_tokens, output_tokens)

            try:
                parsed = json.loads(content)
                if isinstance(parsed, dict):
                    if "data" in parsed:
                        data = parsed["data"]
                    elif "results" in parsed:
                        data = parsed["results"]
                    elif "rows" in parsed:
                        data = parsed["rows"]
                    else:
                        data = [parsed]
                else:
                    data = parsed

                return OCRResult(
                    success=True,
                    data=data,
                    raw_response=content,
                    confidence=0.9,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost=cost
                )

            except json.JSONDecodeError as e:
                return OCRResult(
                    success=False,
                    data=[],
                    raw_response=content,
                    error=f"JSON parse error: {str(e)}",
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost=cost
                )

        except Exception as e:
            return OCRResult(
                success=False,
                data=[],
                raw_response="",
                error=str(e)
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
