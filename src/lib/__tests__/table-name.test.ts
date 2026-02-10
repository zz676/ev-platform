import { normalizeTableName } from "@/lib/data-explorer/table-name";

describe("normalizeTableName", () => {
  test.each([
    ["eVMetric", "eVMetric"],
    ["EVMetric", "eVMetric"],
    ["evmetric", "eVMetric"],
    ["ev_metric", "eVMetric"],
    [" vehicleSpec ", "vehicleSpec"],
    ["VehicleSpec", "vehicleSpec"],
    ['"EVMetric"', "eVMetric"],
    ["`EVMetric`", "eVMetric"],
  ])('normalizes "%s" -> "%s"', (raw, expected) => {
    expect(normalizeTableName(raw)).toBe(expected);
  });
});

