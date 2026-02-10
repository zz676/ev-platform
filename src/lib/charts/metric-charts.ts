import type { ChartConfiguration, Plugin } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { registerFont } from "canvas";
import nodeFs from "node:fs";
import path from "path";
import {
  BrandTrendData,
  AllBrandsData,
} from "@/lib/metrics/delivery-data";

const CHART_SOURCE_TEXT =
  process.env.CHART_SOURCE_TEXT || "source: evjuice.net";
const CHART_FONT_SCALE = parseFloat(process.env.CHART_FONT_SCALE || "2");
const CHART_FONT_FAMILY = process.env.CHART_FONT_FAMILY || "Noto Sans SC";
const CHART_FONT_CSS_FAMILY = `"${CHART_FONT_FAMILY}", Arial, sans-serif`;
const px = (n: number) => Math.max(1, Math.round(n * CHART_FONT_SCALE));
// Titles read a bit too loud when CHART_FONT_SCALE is high. Reduce by 30%.
const tfs = (n: number) =>
  Math.max(1, Math.round(n * CHART_FONT_SCALE * 0.7));
// Data labels get too large when we scale chart typography for X. Keep them smaller.
// "Reduce by 40%" => multiply by 0.6.
const dls = (n: number) =>
  Math.max(1, Math.round(n * CHART_FONT_SCALE * 0.6));
const ATTRIBUTION_BOTTOM_PADDING = px(12) + px(12) + 6;
const OUTER_PAD = px(22);
const CARD_RADIUS = px(18);
// Reduce left/right padding by an additional ~8% from the previous setting.
const PAD_X_SCALE = 0.736;
const padx = (n: number) => Math.max(0, Math.round(n * PAD_X_SCALE));

let fontsRegistered = false;

function ensureChartFontsRegistered() {
  if (fontsRegistered) return;
  try {
    // In Vercel serverless, there may be *zero* system fonts available.
    // If we don't ship a font, even ASCII digits can render as tofu squares.
    //
    // We include these .otf files in the serverless bundle via
    // `outputFileTracingIncludes` in `next.config.mjs`.
    const fontDir = path.join(process.cwd(), "src/lib/charts/fonts");
    const regularPath = path.join(fontDir, "NotoSansSC-Regular.otf");
    const boldPath = path.join(fontDir, "NotoSansSC-Bold.otf");

    if (nodeFs.existsSync(regularPath)) {
      registerFont(regularPath, {
        family: CHART_FONT_FAMILY,
        weight: "normal",
      });
    }
    if (nodeFs.existsSync(boldPath)) {
      registerFont(boldPath, {
        family: CHART_FONT_FAMILY,
        weight: "bold",
      });
    }

    fontsRegistered = true;
  } catch (err) {
    // If the fonts can't be registered (missing file, runtime differences),
    // we still render with system fonts. This avoids hard-failing chart generation.
    console.warn("[Charts] Failed to register CJK fonts; falling back to system fonts.", err);
  }
}

// Chart dimensions (16:9 aspect ratio, good for X)
const CHART_WIDTH = 1200;
const CHART_HEIGHT = 675;

// Chart colors
const COLORS = {
  primary: "rgba(34, 197, 94, 0.9)", // ev-green-500
  secondary: "rgba(34, 197, 94, 0.4)", // ev-green-500 light
  previousYear: "rgba(156, 163, 175, 0.7)", // gray-400
  currentYear: "rgba(34, 197, 94, 0.9)", // ev-green-500
  text: "rgba(17, 24, 39, 1)", // gray-900
  gridLine: "rgba(229, 231, 235, 1)", // gray-200
  white: "rgba(255, 255, 255, 1)",
};

// Brand-specific colors for variety
const BRAND_COLORS: Record<string, string> = {
  BYD: "rgba(220, 38, 38, 0.9)", // red-600
  NIO: "rgba(59, 130, 246, 0.9)", // blue-500
  XPENG: "rgba(34, 197, 94, 0.9)", // green-500
  LI_AUTO: "rgba(139, 92, 246, 0.9)", // violet-500
  ZEEKR: "rgba(6, 182, 212, 0.9)", // cyan-500
  XIAOMI: "rgba(249, 115, 22, 0.9)", // orange-500
  TESLA_CHINA: "rgba(239, 68, 68, 0.9)", // red-500
  LEAPMOTOR: "rgba(16, 185, 129, 0.9)", // emerald-500
  GEELY: "rgba(99, 102, 241, 0.9)", // indigo-500
  OTHER_BRAND: "rgba(107, 114, 128, 0.9)", // gray-500
};

type ChartJSNodeCanvasType = import("chartjs-node-canvas").ChartJSNodeCanvas;

let chartCanvasPromise: Promise<ChartJSNodeCanvasType> | null = null;

const sourceAttributionPlugin: Plugin = {
  id: "sourceAttribution",
  afterDraw: (chart) => {
    if (!CHART_SOURCE_TEXT) return;
    const ctx = chart.ctx;
    const text = CHART_SOURCE_TEXT.replace(/^source:/i, "source:");
    ctx.save();
    ctx.font = `italic ${px(12)}px ${CHART_FONT_CSS_FAMILY}`;
    ctx.fillStyle = "#3eb265";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    const padding = px(12);
    ctx.fillText(
      text,
      chart.width - OUTER_PAD - padding - px(16),
      chart.height - OUTER_PAD - padding
    );
    ctx.restore();
  },
};

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

const cardBackgroundPlugin: Plugin = {
  id: "cardBackground",
  beforeDraw: (chart) => {
    const ctx = chart.ctx;
    ctx.save();

    // Light page background
    ctx.fillStyle = "rgba(249, 250, 251, 1)"; // gray-50
    ctx.fillRect(0, 0, chart.width, chart.height);

    // White card with subtle shadow + border
    const x = OUTER_PAD;
    const y = OUTER_PAD;
    const w = chart.width - OUTER_PAD * 2;
    const h = chart.height - OUTER_PAD * 2;

    ctx.shadowColor = "rgba(0, 0, 0, 0.14)";
    ctx.shadowBlur = px(28);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = px(12);

    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    roundedRect(ctx, x, y, w, h, CARD_RADIUS);
    ctx.fill();

    // Reset shadow before stroke
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.lineWidth = px(1);
    ctx.strokeStyle = "rgba(17, 24, 39, 0.08)";
    roundedRect(ctx, x, y, w, h, CARD_RADIUS);
    ctx.stroke();

    ctx.restore();
  },
};

async function getChartCanvas(): Promise<ChartJSNodeCanvasType> {
  if (!chartCanvasPromise) {
    chartCanvasPromise = (async () => {
      const { ChartJSNodeCanvas } = await import("chartjs-node-canvas");
      ensureChartFontsRegistered();
      return new ChartJSNodeCanvas({
        width: CHART_WIDTH,
        height: CHART_HEIGHT,
        backgroundColour: "white",
        // NOTE: We register plugins via chartCallback instead of `plugins.modern = ["..."]`
        // because Vercel output tracing can miss dynamically required modules.
        chartCallback: (ChartJS) => {
          ChartJS.register(ChartDataLabels);
          ChartJS.defaults.font.family = CHART_FONT_CSS_FAMILY;
        },
      });
    })();
  }

  return chartCanvasPromise;
}

// Helper to format numbers (e.g., 210000 -> "210K")
function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)}K`;
  }
  return value.toString();
}

/**
 * Generate brand trend chart (grouped bar: current year vs previous year)
 */
export async function generateBrandTrendChart(
  data: BrandTrendData
): Promise<Buffer> {
  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: data.months.map((m) => m.monthName),
      datasets: [
        {
          label: `${data.year - 1}`,
          data: data.months.map((m) => m.previous?.value || 0),
          backgroundColor: COLORS.previousYear,
          borderColor: "rgba(156, 163, 175, 1)",
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: `${data.year}`,
          data: data.months.map((m) => m.current.value),
          backgroundColor: BRAND_COLORS[data.brand] || COLORS.currentYear,
          borderColor:
            BRAND_COLORS[data.brand]?.replace("0.9", "1") ||
            "rgba(34, 197, 94, 1)",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `${data.brandName} Monthly Deliveries: ${data.year - 1} vs ${data.year}`,
          font: { size: tfs(24), weight: "bold" },
          color: COLORS.text,
          padding: { top: px(20), bottom: px(20) },
        },
        legend: {
          display: true,
          position: "bottom",
          labels: {
            font: { size: px(14) },
            color: COLORS.text,
            padding: px(20),
          },
        },
        datalabels: {
          display: true,
          anchor: "end",
          align: "top",
          formatter: (value: number) => (value > 0 ? formatNumber(value) : ""),
          font: { size: dls(11), weight: "bold" },
          color: COLORS.text,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: px(12) }, color: COLORS.text },
        },
        y: {
          beginAtZero: true,
          grid: { color: COLORS.gridLine },
          ticks: {
            font: { size: px(12) },
            color: COLORS.text,
            callback: (value) => formatNumber(value as number),
          },
          title: {
            display: true,
            text: "Deliveries",
            font: { size: px(14) },
            color: COLORS.text,
          },
        },
      },
      layout: {
        padding: {
          top: OUTER_PAD,
          left: OUTER_PAD + padx(px(28)),
          right: OUTER_PAD + padx(px(28)),
          bottom: OUTER_PAD + ATTRIBUTION_BOTTOM_PADDING,
        },
      },
    },
    plugins: [
      cardBackgroundPlugin,
      sourceAttributionPlugin,
    ],
  };

  const chartJSNodeCanvas = await getChartCanvas();
  return chartJSNodeCanvas.renderToBuffer(config);
}

/**
 * Generate all brands comparison chart (horizontal bar)
 */
export async function generateAllBrandsChart(
  data: AllBrandsData
): Promise<Buffer> {
  // Sort by value descending and take top brands
  const sortedBrands = [...data.brands]
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // Top 10 brands

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: sortedBrands.map((b) => b.brandName),
      datasets: [
        {
          data: sortedBrands.map((b) => b.value),
          backgroundColor: sortedBrands.map(
            (b) => BRAND_COLORS[b.brand] || COLORS.primary
          ),
          borderColor: sortedBrands.map(
            (b) =>
              BRAND_COLORS[b.brand]?.replace("0.9", "1") ||
              "rgba(34, 197, 94, 1)"
          ),
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y", // Horizontal bars
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `${data.monthName} ${data.year} China EV Deliveries`,
          font: { size: tfs(24), weight: "bold" },
          color: COLORS.text,
          padding: { top: px(20), bottom: px(20) },
        },
        legend: { display: false },
        datalabels: {
          display: true,
          anchor: "end",
          align: "right",
          formatter: (value: number, context) => {
            const brand = sortedBrands[context.dataIndex];
            const yoy =
              brand.yoyChange !== null
                ? ` (${brand.yoyChange >= 0 ? "+" : ""}${brand.yoyChange.toFixed(0)}%)`
                : "";
            return `${formatNumber(value)}${yoy}`;
          },
          font: { size: dls(12), weight: "bold" },
          color: COLORS.text,
          padding: { left: 8 },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: COLORS.gridLine },
          ticks: {
            font: { size: px(12) },
            color: COLORS.text,
            callback: (value) => formatNumber(value as number),
          },
          title: {
            display: true,
            text: "Deliveries",
            font: { size: px(14) },
            color: COLORS.text,
          },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: px(13), weight: "bold" }, color: COLORS.text },
        },
      },
      layout: {
        padding: {
          top: OUTER_PAD,
          left: OUTER_PAD + padx(px(28)),
          right: OUTER_PAD + padx(px(80)), // Space for data labels + source line
          bottom: OUTER_PAD + ATTRIBUTION_BOTTOM_PADDING,
        },
      },
    },
    plugins: [
      cardBackgroundPlugin,
      sourceAttributionPlugin,
    ],
  };

  const chartJSNodeCanvas = await getChartCanvas();
  return chartJSNodeCanvas.renderToBuffer(config);
}

/**
 * Generate a generic line chart for time series data
 */
export async function generateLineChart(
  title: string,
  labels: string[],
  datasets: Array<{
    label: string;
    data: number[];
    color?: string;
  }>
): Promise<Buffer> {
  const config: ChartConfiguration = {
    type: "line",
    data: {
      labels,
      datasets: datasets.map((ds, index) => ({
        label: ds.label,
        data: ds.data,
        borderColor:
          ds.color || Object.values(BRAND_COLORS)[index] || COLORS.primary,
        backgroundColor: "transparent",
        borderWidth: 3,
        pointRadius: 4,
        pointBackgroundColor: ds.color || COLORS.primary,
        tension: 0.1,
      })),
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: title,
          font: { size: tfs(24), weight: "bold" },
          color: COLORS.text,
          padding: { top: px(20), bottom: px(20) },
        },
        legend: {
          display: datasets.length > 1,
          position: "bottom",
          labels: {
            font: { size: px(14) },
            color: COLORS.text,
            padding: px(20),
          },
        },
        datalabels: {
          display: false, // Line charts don't need data labels on each point
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: px(12) }, color: COLORS.text },
        },
        y: {
          beginAtZero: true,
          grid: { color: COLORS.gridLine },
          ticks: {
            font: { size: px(12) },
            color: COLORS.text,
            callback: (value) => formatNumber(value as number),
          },
        },
      },
      layout: {
        padding: {
          top: OUTER_PAD,
          left: OUTER_PAD + padx(px(28)),
          right: OUTER_PAD + padx(px(28)),
          bottom: OUTER_PAD + ATTRIBUTION_BOTTOM_PADDING,
        },
      },
    },
    plugins: [
      cardBackgroundPlugin,
      sourceAttributionPlugin,
    ],
  };

  const chartJSNodeCanvas = await getChartCanvas();
  return chartJSNodeCanvas.renderToBuffer(config);
}

/**
 * Generate a bar chart from generic data
 */
export async function generateBarChart(
  title: string,
  labels: string[],
  data: number[],
  options?: {
    horizontal?: boolean;
    showYoY?: number[]; // YoY changes to show on bars
    colors?: string[];
  }
): Promise<Buffer> {
  const isHorizontal = options?.horizontal ?? false;
  const showYoY = options?.showYoY;

  const topRightValueLabelsPlugin: Plugin = {
    id: "topRightValueLabels",
    afterDatasetsDraw: (chart) => {
      if (isHorizontal) return;
      const ctx = chart.ctx;
      const chartArea = chart.chartArea;
      const meta = chart.getDatasetMeta(0);
      if (!meta?.data?.length) return;

      ctx.save();
      ctx.font = `${dls(11)}px ${CHART_FONT_CSS_FAMILY}`;
      ctx.fillStyle = "rgba(17, 24, 39, 0.95)";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";

      const insetX = px(6);
      const insetY = px(6);
      const minY = chartArea.top + dls(11) + px(2);

      meta.data.forEach((el, i) => {
        // BarElement exposes x/y and width in Chart.js v4, but the type isn't exported cleanly.
        const bar = el as unknown as { x?: number; y?: number; width?: number };
        const xCenter = bar.x;
        const yTop = bar.y;
        const w = bar.width;
        const raw = data[i] ?? 0;
        if (typeof xCenter !== "number" || typeof yTop !== "number" || typeof w !== "number") return;
        if (!Number.isFinite(raw) || raw <= 0) return;

        const yoy = showYoY?.[i];
        const yoyStr =
          yoy !== undefined && Number.isFinite(yoy)
            ? ` (${yoy >= 0 ? "+" : ""}${(yoy as number).toFixed(0)}%)`
            : "";
        const text = `${formatNumber(raw)}${yoyStr}`;

        let x = xCenter + w / 2 - insetX;
        let y = yTop - insetY;

        // Keep the label inside the chart area
        x = Math.min(chartArea.right - insetX, Math.max(chartArea.left + insetX, x));
        y = Math.max(minY, y);

        ctx.fillText(text, x, y);
      });

      ctx.restore();
    },
  };

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor:
            options?.colors ||
            data.map((_, i) => Object.values(BRAND_COLORS)[i] || COLORS.primary),
          borderRadius: 4,
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: isHorizontal ? "y" : "x",
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: title,
          font: { size: tfs(24), weight: "bold" },
          color: COLORS.text,
          padding: { top: px(20), bottom: px(20) },
        },
        legend: { display: false },
        datalabels: {
          // For vertical bars we draw with a custom plugin to place top-right.
          display: isHorizontal,
          anchor: "end",
          align: "right",
          textAlign: "start",
          formatter: (value: number, context) => {
            const yoy = showYoY?.[context.dataIndex];
            const yoyStr =
              yoy !== undefined
                ? ` (${yoy >= 0 ? "+" : ""}${yoy.toFixed(0)}%)`
                : "";
            return `${formatNumber(value)}${yoyStr}`;
          },
          font: { size: dls(11), weight: "bold" },
          color: COLORS.text,
          clamp: true,
          clip: false,
        },
      },
      scales: {
        x: {
          beginAtZero: isHorizontal,
          grid: { display: isHorizontal, color: COLORS.gridLine },
          ticks: {
            font: { size: px(12) },
            color: COLORS.text,
            callback: isHorizontal
              ? (value) => formatNumber(value as number)
              : undefined,
          },
        },
        y: {
          beginAtZero: !isHorizontal,
          grid: { display: !isHorizontal, color: COLORS.gridLine },
          ticks: {
            font: { size: px(12) },
            color: COLORS.text,
            callback: !isHorizontal
              ? (value) => formatNumber(value as number)
              : undefined,
          },
        },
      },
      layout: isHorizontal
        ? {
            padding: {
              top: OUTER_PAD,
              left: OUTER_PAD + padx(px(28)),
              right: OUTER_PAD + padx(px(80)),
              bottom: OUTER_PAD + ATTRIBUTION_BOTTOM_PADDING,
            },
          }
        : {
            padding: {
              top: OUTER_PAD,
              left: OUTER_PAD + padx(px(48)),
              right: OUTER_PAD + padx(px(48)),
              bottom: OUTER_PAD + ATTRIBUTION_BOTTOM_PADDING,
            },
          },
    },
    plugins: [
      cardBackgroundPlugin,
      topRightValueLabelsPlugin,
      sourceAttributionPlugin,
    ],
  };

  const chartJSNodeCanvas = await getChartCanvas();
  return chartJSNodeCanvas.renderToBuffer(config);
}

// Export colors and utilities for use in other modules
export { COLORS, BRAND_COLORS, formatNumber };
