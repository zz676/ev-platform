import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration, ChartTypeRegistry } from "chart.js";
import {
  BrandTrendData,
  AllBrandsData,
  BRAND_DISPLAY_NAMES,
} from "@/lib/metrics/delivery-data";

// Register datalabels plugin types
declare module "chart.js" {
  interface PluginOptionsByType<TType extends keyof ChartTypeRegistry> {
    datalabels?: {
      display?: boolean;
      anchor?: "start" | "center" | "end";
      align?: "start" | "center" | "end" | "top" | "bottom" | "left" | "right";
      formatter?: (value: number, context: { dataIndex: number }) => string;
      font?: { size?: number; weight?: string };
      color?: string;
      padding?: { left?: number };
    };
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

// Create chart canvas with plugin registration
const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width: CHART_WIDTH,
  height: CHART_HEIGHT,
  backgroundColour: "white",
  plugins: {
    modern: ["chartjs-plugin-datalabels"],
  },
});

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
          font: { size: 24, weight: "bold" },
          color: COLORS.text,
          padding: { top: 20, bottom: 20 },
        },
        legend: {
          display: true,
          position: "bottom",
          labels: {
            font: { size: 14 },
            color: COLORS.text,
            padding: 20,
          },
        },
        datalabels: {
          display: true,
          anchor: "end",
          align: "top",
          formatter: (value: number) => (value > 0 ? formatNumber(value) : ""),
          font: { size: 11, weight: "bold" },
          color: COLORS.text,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 12 }, color: COLORS.text },
        },
        y: {
          beginAtZero: true,
          grid: { color: COLORS.gridLine },
          ticks: {
            font: { size: 12 },
            color: COLORS.text,
            callback: (value) => formatNumber(value as number),
          },
          title: {
            display: true,
            text: "Deliveries",
            font: { size: 14 },
            color: COLORS.text,
          },
        },
      },
    },
    plugins: [
      {
        id: "customBackground",
        beforeDraw: (chart) => {
          const ctx = chart.ctx;
          ctx.save();
          ctx.fillStyle = COLORS.white;
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        },
      },
    ],
  };

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
          font: { size: 24, weight: "bold" },
          color: COLORS.text,
          padding: { top: 20, bottom: 20 },
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
          font: { size: 12, weight: "bold" },
          color: COLORS.text,
          padding: { left: 8 },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: COLORS.gridLine },
          ticks: {
            font: { size: 12 },
            color: COLORS.text,
            callback: (value) => formatNumber(value as number),
          },
          title: {
            display: true,
            text: "Deliveries",
            font: { size: 14 },
            color: COLORS.text,
          },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 13, weight: "bold" }, color: COLORS.text },
        },
      },
      layout: {
        padding: { right: 80 }, // Space for data labels
      },
    },
    plugins: [
      {
        id: "customBackground",
        beforeDraw: (chart) => {
          const ctx = chart.ctx;
          ctx.save();
          ctx.fillStyle = COLORS.white;
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        },
      },
    ],
  };

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
          font: { size: 24, weight: "bold" },
          color: COLORS.text,
          padding: { top: 20, bottom: 20 },
        },
        legend: {
          display: datasets.length > 1,
          position: "bottom",
          labels: {
            font: { size: 14 },
            color: COLORS.text,
            padding: 20,
          },
        },
        datalabels: {
          display: false, // Line charts don't need data labels on each point
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 12 }, color: COLORS.text },
        },
        y: {
          beginAtZero: true,
          grid: { color: COLORS.gridLine },
          ticks: {
            font: { size: 12 },
            color: COLORS.text,
            callback: (value) => formatNumber(value as number),
          },
        },
      },
    },
    plugins: [
      {
        id: "customBackground",
        beforeDraw: (chart) => {
          const ctx = chart.ctx;
          ctx.save();
          ctx.fillStyle = COLORS.white;
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        },
      },
    ],
  };

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
          font: { size: 24, weight: "bold" },
          color: COLORS.text,
          padding: { top: 20, bottom: 20 },
        },
        legend: { display: false },
        datalabels: {
          display: true,
          anchor: "end",
          align: isHorizontal ? "right" : "top",
          formatter: (value: number, context) => {
            const yoy = options?.showYoY?.[context.dataIndex];
            const yoyStr =
              yoy !== undefined
                ? ` (${yoy >= 0 ? "+" : ""}${yoy.toFixed(0)}%)`
                : "";
            return `${formatNumber(value)}${yoyStr}`;
          },
          font: { size: 11, weight: "bold" },
          color: COLORS.text,
        },
      },
      scales: {
        x: {
          beginAtZero: isHorizontal,
          grid: { display: isHorizontal, color: COLORS.gridLine },
          ticks: {
            font: { size: 12 },
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
            font: { size: 12 },
            color: COLORS.text,
            callback: !isHorizontal
              ? (value) => formatNumber(value as number)
              : undefined,
          },
        },
      },
      layout: isHorizontal ? { padding: { right: 80 } } : undefined,
    },
    plugins: [
      {
        id: "customBackground",
        beforeDraw: (chart) => {
          const ctx = chart.ctx;
          ctx.save();
          ctx.fillStyle = COLORS.white;
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        },
      },
    ],
  };

  return chartJSNodeCanvas.renderToBuffer(config);
}

// Export colors and utilities for use in other modules
export { COLORS, BRAND_COLORS, formatNumber };
