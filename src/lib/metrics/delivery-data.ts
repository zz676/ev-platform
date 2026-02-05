import { prisma } from "@/lib/prisma";
import { Brand } from "@prisma/client";

// Month names for display
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// Brand display names for charts/posts
export const BRAND_DISPLAY_NAMES: Record<Brand, string> = {
  BYD: "BYD",
  NIO: "NIO",
  XPENG: "XPeng",
  LI_AUTO: "Li Auto",
  ZEEKR: "Zeekr",
  XIAOMI: "Xiaomi",
  TESLA_CHINA: "Tesla China",
  LEAPMOTOR: "Leapmotor",
  GEELY: "Geely",
  OTHER_BRAND: "Other",
  INDUSTRY: "Industry",
};

// Type definitions
export interface MonthData {
  month: number;
  monthName: string;
  current: { value: number; year: number };
  previous: { value: number; year: number } | null;
  yoyChange: number | null;
}

export interface BrandTrendData {
  brand: Brand;
  brandName: string;
  year: number;
  months: MonthData[];
  yearTotal: {
    current: number;
    previous: number | null;
    yoyChange: number | null;
  };
}

export interface BrandComparisonEntry {
  brand: Brand;
  brandName: string;
  value: number;
  yoyChange: number | null;
  ranking: number;
}

export interface AllBrandsData {
  year: number;
  month: number;
  monthName: string;
  brands: BrandComparisonEntry[];
  industryTotal: {
    value: number;
    yoyChange: number | null;
  } | null;
}

/**
 * Get 12-month delivery trend for a brand with YoY comparison
 */
export async function getBrandMonthlyTrend(
  brand: Brand,
  year: number
): Promise<BrandTrendData> {
  // Get current year data
  const currentYearData = await prisma.eVMetric.findMany({
    where: {
      brand,
      metric: "DELIVERY",
      periodType: "MONTHLY",
      year,
    },
    orderBy: { period: "asc" },
  });

  // Get previous year data for comparison
  const previousYearData = await prisma.eVMetric.findMany({
    where: {
      brand,
      metric: "DELIVERY",
      periodType: "MONTHLY",
      year: year - 1,
    },
    orderBy: { period: "asc" },
  });

  // Create a map for previous year data
  const previousYearMap = new Map(
    previousYearData.map((d) => [d.period, d.value])
  );

  // Build months array
  const months: MonthData[] = currentYearData.map((d) => {
    const previousValue = previousYearMap.get(d.period);
    const yoyChange = previousValue
      ? ((d.value - previousValue) / previousValue) * 100
      : null;

    return {
      month: d.period,
      monthName: MONTH_NAMES[d.period - 1],
      current: { value: d.value, year },
      previous: previousValue
        ? { value: previousValue, year: year - 1 }
        : null,
      yoyChange,
    };
  });

  // Calculate totals
  const currentTotal = currentYearData.reduce((sum, d) => sum + d.value, 0);
  const previousTotal = previousYearData.reduce((sum, d) => sum + d.value, 0);
  const yoyTotalChange =
    previousTotal > 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : null;

  return {
    brand,
    brandName: BRAND_DISPLAY_NAMES[brand],
    year,
    months,
    yearTotal: {
      current: currentTotal,
      previous: previousTotal > 0 ? previousTotal : null,
      yoyChange: yoyTotalChange,
    },
  };
}

/**
 * Get all brands delivery comparison for a single month
 */
export async function getAllBrandsComparison(
  year: number,
  month: number
): Promise<AllBrandsData> {
  // Get current month data for all brands (excluding INDUSTRY)
  const currentMonthData = await prisma.eVMetric.findMany({
    where: {
      metric: "DELIVERY",
      periodType: "MONTHLY",
      year,
      period: month,
      brand: { not: "INDUSTRY" },
    },
    orderBy: { value: "desc" },
  });

  // Get same month previous year for YoY comparison
  const previousYearData = await prisma.eVMetric.findMany({
    where: {
      metric: "DELIVERY",
      periodType: "MONTHLY",
      year: year - 1,
      period: month,
      brand: { not: "INDUSTRY" },
    },
  });

  // Create a map for previous year data
  const previousYearMap = new Map(
    previousYearData.map((d) => [d.brand, d.value])
  );

  // Build brands array with rankings
  const brands: BrandComparisonEntry[] = currentMonthData.map((d, index) => {
    const previousValue = previousYearMap.get(d.brand);
    const yoyChange = previousValue
      ? ((d.value - previousValue) / previousValue) * 100
      : null;

    return {
      brand: d.brand,
      brandName: BRAND_DISPLAY_NAMES[d.brand],
      value: d.value,
      yoyChange,
      ranking: index + 1,
    };
  });

  // Try to get industry total from CPCA or CAAM data
  let industryTotal: AllBrandsData["industryTotal"] = null;

  const cpcaRetail = await prisma.cpcaNevRetail.findUnique({
    where: { year_month: { year, month } },
  });

  if (cpcaRetail) {
    industryTotal = {
      value: cpcaRetail.value,
      yoyChange: cpcaRetail.yoyChange,
    };
  } else {
    // Fallback: sum of all brands
    const totalValue = brands.reduce((sum, b) => sum + b.value, 0);
    const previousTotal = Array.from(previousYearMap.values()).reduce(
      (sum, v) => sum + v,
      0
    );
    industryTotal = {
      value: totalValue,
      yoyChange:
        previousTotal > 0
          ? ((totalValue - previousTotal) / previousTotal) * 100
          : null,
    };
  }

  return {
    year,
    month,
    monthName: MONTH_NAMES[month - 1],
    brands,
    industryTotal,
  };
}

/**
 * Get the latest month with complete delivery data
 */
export async function getLatestCompleteMonth(): Promise<{
  year: number;
  month: number;
}> {
  const latest = await prisma.eVMetric.findFirst({
    where: {
      metric: "DELIVERY",
      periodType: "MONTHLY",
    },
    orderBy: [{ year: "desc" }, { period: "desc" }],
  });

  if (!latest) {
    // Default to current month - 1
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() || 12, // If January, return December of prev year
    };
  }

  return { year: latest.year, month: latest.period };
}

/**
 * Get all brands that have delivery data for a given year
 */
export async function getBrandsWithData(year: number): Promise<Brand[]> {
  const results = await prisma.eVMetric.findMany({
    where: {
      metric: "DELIVERY",
      periodType: "MONTHLY",
      year,
      brand: { not: "INDUSTRY" },
    },
    distinct: ["brand"],
    select: { brand: true },
  });

  return results.map((r) => r.brand);
}

/**
 * Get years that have delivery data
 */
export async function getYearsWithData(): Promise<number[]> {
  const results = await prisma.eVMetric.findMany({
    where: {
      metric: "DELIVERY",
      periodType: "MONTHLY",
    },
    distinct: ["year"],
    select: { year: true },
    orderBy: { year: "desc" },
  });

  return results.map((r) => r.year);
}

/**
 * Get months with data for a specific year
 */
export async function getMonthsWithData(year: number): Promise<number[]> {
  const results = await prisma.eVMetric.findMany({
    where: {
      metric: "DELIVERY",
      periodType: "MONTHLY",
      year,
    },
    distinct: ["period"],
    select: { period: true },
    orderBy: { period: "asc" },
  });

  return results.map((r) => r.period);
}
