import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api-auth";
import { generateBarChart, generateLineChart } from "@/lib/charts/metric-charts";

interface ChartDataset {
  label: string;
  data: number[];
  color?: string;
}

interface BarChartStyleOptions {
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  fontColor?: string;
  titleSize?: number;
  titleColor?: string;
  backgroundColor?: string;
  xAxisFontSize?: number;
  yAxisFontSize?: number;
  xAxisFontColor?: string;
  yAxisFontColor?: string;
  barColor?: string;
  minBarWidth?: number;
  maxWidth?: number;
}

// POST: Generate chart from query results
export async function POST(request: Request) {
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const {
      data,
      chartType,
      title,
      xField,
      yField,
      groupField,
      chartOptions,
    }: {
      data: Record<string, unknown>[];
      chartType: string;
      title?: string;
      xField?: string;
      yField?: string;
      groupField?: string;
      chartOptions?: BarChartStyleOptions;
    } = body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: "Data array is required and must not be empty" },
        { status: 400 }
      );
    }

    if (!chartType) {
      return NextResponse.json(
        { error: "Chart type is required" },
        { status: 400 }
      );
    }

    // Extract labels and values from data
    const labels: string[] = [];
    const values: number[] = [];
    const yoyChanges: number[] = [];
    const datasets: ChartDataset[] = [];

    // Try to auto-detect fields if not specified
    const sampleRow = data[0];
    const detectedXField =
      xField ||
      (sampleRow.month && sampleRow.year
        ? "month"
        : sampleRow.brand
          ? "brand"
          : sampleRow.maker
            ? "maker"
            : sampleRow.automaker
              ? "automaker"
              : Object.keys(sampleRow).find((k) =>
                  ["name", "label", "period", "date"].includes(k.toLowerCase())
                ));

    const detectedYField =
      yField ||
      (sampleRow.value !== undefined
        ? "value"
        : sampleRow.installation !== undefined
          ? "installation"
          : sampleRow.retailSales !== undefined
            ? "retailSales"
            : Object.keys(sampleRow).find(
                (k) =>
                  typeof sampleRow[k] === "number" &&
                  !["year", "month", "period", "ranking"].includes(k)
              ));

    if (!detectedXField || !detectedYField) {
      return NextResponse.json(
        { error: "Could not detect x/y fields from data" },
        { status: 400 }
      );
    }

    // Handle grouped data (multiple series)
    if (groupField && sampleRow[groupField] !== undefined) {
      const groups = new Map<string, { x: string[]; y: number[] }>();

      for (const row of data) {
        const groupKey = String(row[groupField]);
        const xValue = String(row[detectedXField]);
        const yValue = Number(row[detectedYField]) || 0;

        if (!groups.has(groupKey)) {
          groups.set(groupKey, { x: [], y: [] });
        }
        const group = groups.get(groupKey)!;
        group.x.push(xValue);
        group.y.push(yValue);
      }

      // Use first group's x values as labels
      const firstGroup = groups.values().next().value;
      if (firstGroup) {
        labels.push(...firstGroup.x);
      }

      // Build datasets
      for (const [label, group] of groups) {
        datasets.push({ label, data: group.y });
      }
    } else {
      // Single series
      for (const row of data) {
        let labelValue: string;

        // Format label based on field type
        if (detectedXField === "month" && row.year) {
          const monthNames = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
          ];
          labelValue = `${monthNames[(row.month as number) - 1]} ${row.year}`;
        } else {
          labelValue = String(row[detectedXField]);
        }

        labels.push(labelValue);
        values.push(Number(row[detectedYField]) || 0);

        // Capture YoY change if available
        if (row.yoyChange !== undefined && row.yoyChange !== null) {
          yoyChanges.push(Number(row.yoyChange));
        }
      }
    }

    // Generate chart
    let chartBuffer: Buffer;
    const chartTitle = title || "Data Results";

    if (chartType === "line") {
      if (datasets.length > 0) {
        chartBuffer = await generateLineChart(chartTitle, labels, datasets);
      } else {
        chartBuffer = await generateLineChart(chartTitle, labels, [
          { label: "Value", data: values, color: chartOptions?.barColor },
        ]);
      }
    } else {
      // bar or horizontalBar
      const isHorizontal = chartType === "horizontalBar";
      const barColors =
        chartOptions?.barColor ? labels.map(() => chartOptions.barColor as string) : undefined;
      chartBuffer = await generateBarChart(chartTitle, labels, values, {
        horizontal: isHorizontal,
        showYoY: yoyChanges.length === values.length ? yoyChanges : undefined,
        colors: barColors,
        style: chartOptions,
      });
    }

    const chartImageBase64 = `data:image/png;base64,${chartBuffer.toString("base64")}`;

    return NextResponse.json({
      chartImageBase64,
      chartType,
      title: chartTitle,
      dataPoints: labels.length,
    });
  } catch (error) {
    console.error("Error generating chart:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate chart";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
