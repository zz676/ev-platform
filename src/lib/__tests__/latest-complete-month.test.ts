import { findLatestCompleteMonth } from "@/lib/metric-posts/latest-complete-month";

describe("findLatestCompleteMonth", () => {
  it("returns the newest candidate meeting the minimum brand count", async () => {
    const candidates = [
      { year: 2025, month: 11 },
      { year: 2026, month: 1 },
      { year: 2025, month: 12 },
    ];

    const counts: Record<string, number> = {
      "2026-1": 5,
      "2025-12": 8,
      "2025-11": 10,
    };

    const result = await findLatestCompleteMonth({
      candidates,
      minBrands: 8,
      getBrandCount: async (year, month) => counts[`${year}-${month}`] ?? 0,
    });

    expect(result).toEqual({ year: 2025, month: 12, brandCount: 8 });
  });

  it("returns null when no candidate meets the minimum brand count", async () => {
    const candidates = [
      { year: 2026, month: 1 },
      { year: 2025, month: 12 },
    ];

    const result = await findLatestCompleteMonth({
      candidates,
      minBrands: 8,
      getBrandCount: async () => 3,
    });

    expect(result).toBeNull();
  });
});

