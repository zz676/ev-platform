export type MonthCandidate = { year: number; month: number };

/**
 * Picks the newest month that is considered "complete" based on a minimum brand count.
 *
 * Callers can pass unordered candidates; this function will sort them by (year desc, month desc).
 */
export async function findLatestCompleteMonth(params: {
  candidates: MonthCandidate[];
  minBrands: number;
  getBrandCount: (year: number, month: number) => Promise<number>;
}): Promise<{ year: number; month: number; brandCount: number } | null> {
  const ordered = [...params.candidates].sort(
    (a, b) => b.year - a.year || b.month - a.month
  );

  for (const c of ordered) {
    const brandCount = await params.getBrandCount(c.year, c.month);
    if (brandCount >= params.minBrands) {
      return { year: c.year, month: c.month, brandCount };
    }
  }

  return null;
}

