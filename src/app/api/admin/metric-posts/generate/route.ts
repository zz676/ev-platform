import { NextResponse } from "next/server";
import { Brand } from "@prisma/client";
import { requireApiAdmin } from "@/lib/auth/api-auth";
import {
  getBrandMonthlyTrend,
  getAllBrandsComparison,
  getYearsWithData,
  getMonthsWithData,
  getBrandsWithData,
} from "@/lib/metrics/delivery-data";
import {
  generateBrandTrendChart,
  generateAllBrandsChart,
} from "@/lib/charts/metric-charts";
import {
  generateBrandTrendContent,
  generateAllBrandsContent,
  formatMetricPostTweet,
} from "@/lib/llm/metric-posts";

// POST: Generate preview content and chart
export async function POST(request: Request) {
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const { postType, year, month, brand } = body;

    if (!postType || !year) {
      return NextResponse.json(
        { error: "postType and year are required" },
        { status: 400 }
      );
    }

    if (postType === "ALL_BRANDS_COMPARISON" && !month) {
      return NextResponse.json(
        { error: "month is required for ALL_BRANDS_COMPARISON" },
        { status: 400 }
      );
    }

    if (postType === "BRAND_TREND" && !brand) {
      return NextResponse.json(
        { error: "brand is required for BRAND_TREND" },
        { status: 400 }
      );
    }

    let content: string;
    let chartImageBase64: string;
    let data: unknown;
    const warnings: string[] = [];

    if (postType === "BRAND_TREND") {
      // Get brand trend data
      const trendData = await getBrandMonthlyTrend(brand as Brand, year);

      if (trendData.months.length === 0) {
        return NextResponse.json(
          { error: `No delivery data found for ${brand} in ${year}` },
          { status: 404 }
        );
      }

      // Check for missing months
      const existingMonths = new Set(trendData.months.map((m) => m.month));
      for (let i = 1; i <= 12; i++) {
        if (!existingMonths.has(i)) {
          warnings.push(`Missing data for month ${i}`);
        }
      }

      // Generate content
      const rawContent = await generateBrandTrendContent(trendData);
      content = formatMetricPostTweet(rawContent, [brand as Brand]);

      // Generate chart
      const chartBuffer = await generateBrandTrendChart(trendData);
      chartImageBase64 = `data:image/png;base64,${chartBuffer.toString("base64")}`;

      data = trendData;
    } else if (postType === "ALL_BRANDS_COMPARISON") {
      // Get all brands comparison data
      const comparisonData = await getAllBrandsComparison(year, month);

      if (comparisonData.brands.length === 0) {
        return NextResponse.json(
          { error: `No delivery data found for ${month}/${year}` },
          { status: 404 }
        );
      }

      // Generate content
      const rawContent = await generateAllBrandsContent(comparisonData);
      const brandList = comparisonData.brands.map((b) => b.brand);
      content = formatMetricPostTweet(rawContent, brandList);

      // Generate chart
      const chartBuffer = await generateAllBrandsChart(comparisonData);
      chartImageBase64 = `data:image/png;base64,${chartBuffer.toString("base64")}`;

      data = comparisonData;
    } else {
      return NextResponse.json(
        { error: `Unknown postType: ${postType}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      content,
      data,
      characterCount: content.length,
      chartImageBase64,
      warnings,
    });
  } catch (error) {
    console.error("Error generating metric post:", error);
    return NextResponse.json(
      { error: `Failed to generate metric post: ${error}` },
      { status: 500 }
    );
  }
}

// GET: Get available options for generating posts
export async function GET(request: Request) {
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");

    // Get available years
    const years = await getYearsWithData();

    // Get available brands and months for specified year (or most recent year)
    const targetYear = year ? parseInt(year) : years[0] || new Date().getFullYear();
    const [brands, months] = await Promise.all([
      getBrandsWithData(targetYear),
      getMonthsWithData(targetYear),
    ]);

    return NextResponse.json({
      years,
      brands,
      months,
      currentYear: targetYear,
    });
  } catch (error) {
    console.error("Error fetching generate options:", error);
    return NextResponse.json(
      { error: "Failed to fetch options" },
      { status: 500 }
    );
  }
}
