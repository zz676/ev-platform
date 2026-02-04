"""Extract vehicle specifications from OCR data."""

from typing import Optional
from dataclasses import dataclass


@dataclass
class VehicleSpecData:
    """Extracted vehicle specification data."""
    brand: str
    model: str
    variant: str

    # Basic info
    launch_date: Optional[str] = None
    vehicle_type: Optional[str] = None  # BEV, EREV, PHEV
    segment: Optional[str] = None  # SUV, Sedan, MPV

    # Price (RMB)
    starting_price: Optional[float] = None
    current_price: Optional[float] = None

    # Dimensions (mm)
    length_mm: Optional[int] = None
    width_mm: Optional[int] = None
    height_mm: Optional[int] = None
    wheelbase_mm: Optional[int] = None

    # Performance
    acceleration: Optional[float] = None
    top_speed: Optional[int] = None
    motor_power_kw: Optional[int] = None
    motor_torque_nm: Optional[int] = None

    # Battery & Range
    battery_capacity: Optional[float] = None
    range_cltc: Optional[int] = None
    range_wltp: Optional[int] = None
    range_epa: Optional[int] = None

    # EREV/PHEV specific
    fuel_tank_volume: Optional[float] = None
    engine_displacement: Optional[float] = None

    # Charging
    max_charging_power: Optional[int] = None
    charging_time_10_to_80: Optional[int] = None

    # Metadata
    source_url: Optional[str] = None
    confidence: float = 0.9


class SpecExtractor:
    """Extract vehicle specifications from OCR data."""

    # Brand name normalization
    BRAND_MAP = {
        "byd": "BYD",
        "nio": "NIO",
        "xpeng": "XPENG",
        "li auto": "LI_AUTO",
        "li": "LI_AUTO",
        "zeekr": "ZEEKR",
        "xiaomi": "XIAOMI",
        "tesla": "TESLA_CHINA",
        "tesla china": "TESLA_CHINA",
        "geely": "OTHER_BRAND",
        "changan": "OTHER_BRAND",
        "saic": "OTHER_BRAND",
        "gac": "OTHER_BRAND",
        "aion": "OTHER_BRAND",
        "avatr": "OTHER_BRAND",
        "denza": "OTHER_BRAND",
        "yangwang": "BYD",  # BYD sub-brand
        "fangchengbao": "BYD",  # BYD sub-brand
        "deepal": "OTHER_BRAND",
        "voyah": "OTHER_BRAND",
        "im": "OTHER_BRAND",
        "rising": "OTHER_BRAND",
        "leapmotor": "OTHER_BRAND",
        "neta": "OTHER_BRAND",
        "arcfox": "OTHER_BRAND",
    }

    # Field name mappings from OCR output
    FIELD_MAPPINGS = {
        # Dimensions
        "length": "length_mm",
        "length_mm": "length_mm",
        "width": "width_mm",
        "width_mm": "width_mm",
        "height": "height_mm",
        "height_mm": "height_mm",
        "wheelbase": "wheelbase_mm",
        "wheelbase_mm": "wheelbase_mm",

        # Battery
        "battery": "battery_capacity",
        "battery_kwh": "battery_capacity",
        "battery_capacity": "battery_capacity",

        # Range
        "range": "range_cltc",
        "range_km": "range_cltc",
        "range_cltc": "range_cltc",
        "cltc_range": "range_cltc",
        "range_wltp": "range_wltp",
        "wltp_range": "range_wltp",
        "range_epa": "range_epa",
        "epa_range": "range_epa",

        # Power
        "power": "motor_power_kw",
        "motor_kw": "motor_power_kw",
        "motor_power": "motor_power_kw",
        "motor_power_kw": "motor_power_kw",
        "torque": "motor_torque_nm",
        "motor_torque": "motor_torque_nm",
        "motor_torque_nm": "motor_torque_nm",

        # Performance
        "acceleration": "acceleration",
        "0_100": "acceleration",
        "0-100": "acceleration",
        "top_speed": "top_speed",
        "max_speed": "top_speed",

        # Price
        "price": "starting_price",
        "starting_price": "starting_price",
        "msrp": "starting_price",

        # Charging
        "charging_power": "max_charging_power",
        "max_charging": "max_charging_power",
        "max_charging_power": "max_charging_power",
        "charging_time": "charging_time_10_to_80",
        "charge_time": "charging_time_10_to_80",

        # Vehicle type
        "type": "vehicle_type",
        "vehicle_type": "vehicle_type",
        "powertrain": "vehicle_type",
    }

    def extract(self, ocr_data: dict, source_url: str = None) -> Optional[VehicleSpecData]:
        """Extract vehicle spec from OCR data.

        Args:
            ocr_data: Dictionary from OCR extraction
            source_url: Source URL for tracking

        Returns:
            VehicleSpecData or None if extraction fails
        """
        if not ocr_data:
            return None

        # Normalize keys to lowercase
        data = {k.lower().replace(" ", "_"): v for k, v in ocr_data.items()}

        # Extract required fields
        brand = self._extract_brand(data)
        model = data.get("model")
        variant = data.get("variant", data.get("trim", "Standard"))

        if not brand or not model:
            return None

        # Create spec object
        spec = VehicleSpecData(
            brand=brand,
            model=model,
            variant=variant,
            source_url=source_url,
            confidence=0.9  # OCR data has lower confidence
        )

        # Map all other fields
        for ocr_key, spec_field in self.FIELD_MAPPINGS.items():
            if ocr_key in data and data[ocr_key] is not None:
                value = self._convert_value(data[ocr_key], spec_field)
                if value is not None:
                    setattr(spec, spec_field, value)

        # Handle vehicle type normalization
        if spec.vehicle_type:
            spec.vehicle_type = self._normalize_vehicle_type(spec.vehicle_type)

        # Extract segment from model name or data
        spec.segment = data.get("segment", self._infer_segment(model))

        return spec

    def _extract_brand(self, data: dict) -> Optional[str]:
        """Extract and normalize brand name."""
        brand = data.get("brand", "")
        if not brand:
            return None

        brand_lower = brand.lower()
        return self.BRAND_MAP.get(brand_lower, "OTHER_BRAND")

    def _convert_value(self, value, field_name: str):
        """Convert value to appropriate type for field."""
        if value is None:
            return None

        # Integer fields
        int_fields = [
            "length_mm", "width_mm", "height_mm", "wheelbase_mm",
            "top_speed", "motor_power_kw", "motor_torque_nm",
            "range_cltc", "range_wltp", "range_epa",
            "max_charging_power", "charging_time_10_to_80"
        ]

        # Float fields
        float_fields = [
            "battery_capacity", "acceleration",
            "starting_price", "current_price",
            "fuel_tank_volume", "engine_displacement"
        ]

        try:
            if field_name in int_fields:
                # Handle string values like "4,950" or "4950mm"
                if isinstance(value, str):
                    value = value.replace(",", "").replace("mm", "").replace("km", "").replace("kw", "").strip()
                return int(float(value))
            elif field_name in float_fields:
                if isinstance(value, str):
                    value = value.replace(",", "").replace("kwh", "").replace("s", "").strip()
                return float(value)
            else:
                return str(value)
        except (ValueError, TypeError):
            return None

    def _normalize_vehicle_type(self, vtype: str) -> Optional[str]:
        """Normalize vehicle type to enum value."""
        if not vtype:
            return None

        vtype_lower = vtype.lower()

        if "bev" in vtype_lower or "battery electric" in vtype_lower or "pure electric" in vtype_lower:
            return "BEV"
        elif "erev" in vtype_lower or "extended range" in vtype_lower or "range extender" in vtype_lower:
            return "EREV"
        elif "phev" in vtype_lower or "plug-in hybrid" in vtype_lower:
            return "PHEV"
        elif "hev" in vtype_lower or "hybrid" in vtype_lower:
            return "HEV"

        return None

    def _infer_segment(self, model: str) -> Optional[str]:
        """Infer segment from model name."""
        if not model:
            return None

        model_lower = model.lower()

        # SUV indicators
        if any(kw in model_lower for kw in ["suv", "x9", "l9", "l8", "l7", "l6", "es6", "es8", "el8", "ec6", "ec7", "g9", "g6"]):
            return "SUV"

        # Sedan indicators
        if any(kw in model_lower for kw in ["sedan", "et5", "et7", "p7", "p5", "model 3", "model s", "su7", "han"]):
            return "Sedan"

        # MPV indicators
        if any(kw in model_lower for kw in ["mpv", "mega", "d9", "denza d9"]):
            return "MPV"

        return None

    def to_prisma_data(self, spec: VehicleSpecData) -> dict:
        """Convert VehicleSpecData to Prisma-compatible dict.

        Args:
            spec: VehicleSpecData object

        Returns:
            Dictionary ready for Prisma create/update
        """
        return {
            "brand": spec.brand,
            "model": spec.model,
            "variant": spec.variant,
            "launchDate": spec.launch_date,
            "vehicleType": spec.vehicle_type,
            "segment": spec.segment,
            "startingPrice": spec.starting_price,
            "currentPrice": spec.current_price,
            "lengthMm": spec.length_mm,
            "widthMm": spec.width_mm,
            "heightMm": spec.height_mm,
            "wheelbaseMm": spec.wheelbase_mm,
            "acceleration": spec.acceleration,
            "topSpeed": spec.top_speed,
            "motorPowerKw": spec.motor_power_kw,
            "motorTorqueNm": spec.motor_torque_nm,
            "batteryCapacity": spec.battery_capacity,
            "rangeCltc": spec.range_cltc,
            "rangeWltp": spec.range_wltp,
            "rangeEpa": spec.range_epa,
            "fuelTankVolume": spec.fuel_tank_volume,
            "engineDisplacement": spec.engine_displacement,
            "maxChargingPower": spec.max_charging_power,
            "chargingTime10To80": spec.charging_time_10_to_80,
            "sourceUrl": spec.source_url,
            "confidence": spec.confidence,
        }


# Test function
def test_spec_extractor():
    """Test spec extraction with sample data."""
    extractor = SpecExtractor()

    sample_ocr_data = {
        "brand": "NIO",
        "model": "ET7",
        "variant": "100 kWh",
        "price": 458000,
        "length": 5101,
        "width": 1987,
        "height": 1509,
        "wheelbase": 3060,
        "battery_kwh": 100,
        "range_km": 675,
        "motor_kw": 480,
        "acceleration": 3.8,
        "top_speed": 200,
        "vehicle_type": "BEV"
    }

    spec = extractor.extract(sample_ocr_data, "https://example.com/nio-et7")
    if spec:
        print(f"Extracted spec:")
        print(f"  Brand: {spec.brand}")
        print(f"  Model: {spec.model} {spec.variant}")
        print(f"  Price: {spec.starting_price} RMB")
        print(f"  Dimensions: {spec.length_mm}x{spec.width_mm}x{spec.height_mm} mm")
        print(f"  Battery: {spec.battery_capacity} kWh")
        print(f"  Range: {spec.range_cltc} km")
        print(f"  Power: {spec.motor_power_kw} kW")
        print(f"  0-100: {spec.acceleration}s")
    else:
        print("Extraction failed")


if __name__ == "__main__":
    test_spec_extractor()
