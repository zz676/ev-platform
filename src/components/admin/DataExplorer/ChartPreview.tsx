"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  RefreshCw,
  BarChart3,
  TrendingUp,
  Image as ImageIcon,
  Download,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from "recharts";

type ChartType = "bar" | "line" | "horizontalBar";

const DEFAULT_PADDING = {
  top: 20,
  right: 20,
  bottom: 20,
  left: 20,
};

interface ChartPreviewProps {
  data: Record<string, unknown>[];
  initialChartType?: ChartType;
  initialTitle?: string;
  onChartCleared?: () => void;
  onChartGenerated?: (result: {
    chartImageBase64: string;
    title: string;
    chartType: ChartType;
  }) => void;
  scrollAnchorId?: string;
}

export function ChartPreview({
  data,
  initialChartType = "bar",
  initialTitle = "Data Results",
  onChartCleared,
  onChartGenerated,
  scrollAnchorId,
}: ChartPreviewProps) {
  const [chartType, setChartType] = useState<ChartType>(initialChartType);
  const [title, setTitle] = useState(initialTitle);
  const [chartImage, setChartImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCustomize, setShowCustomize] = useState(false);
  const [paddingTop, setPaddingTop] = useState(String(DEFAULT_PADDING.top));
  const [paddingRight, setPaddingRight] = useState(String(DEFAULT_PADDING.right));
  const [paddingBottom, setPaddingBottom] = useState(String(DEFAULT_PADDING.bottom));
  const [paddingLeft, setPaddingLeft] = useState(String(DEFAULT_PADDING.left));
  const [fontColor, setFontColor] = useState("#0f172a");
  const [titleColor, setTitleColor] = useState("#0f172a");
  const [titleSize, setTitleSize] = useState("24");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [xAxisFontSize, setXAxisFontSize] = useState("12");
  const [yAxisFontSize, setYAxisFontSize] = useState("12");
  const [xAxisFontColor, setXAxisFontColor] = useState("#0f172a");
  const [yAxisFontColor, setYAxisFontColor] = useState("#0f172a");
  const [sourceText, setSourceText] = useState("source: evjuice.net");
  const [sourceFontSize, setSourceFontSize] = useState("12");
  const [sourceColor, setSourceColor] = useState("#65a30d");
  const [xAxisField, setXAxisField] = useState("auto");
  const [barColor, setBarColor] = useState("#84cc16");
  const [toast, setToast] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chartImageRef = useRef(chartImage);
  const onChartClearedRef = useRef(onChartCleared);

  useEffect(() => {
    chartImageRef.current = chartImage;
  }, [chartImage]);

  useEffect(() => {
    onChartClearedRef.current = onChartCleared;
  }, [onChartCleared]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const parsedPadding = useMemo(() => {
    const topValue = Number(paddingTop);
    const rightValue = Number(paddingRight);
    const bottomValue = Number(paddingBottom);
    const leftValue = Number(paddingLeft);
    return {
      top: Number.isFinite(topValue) ? topValue : DEFAULT_PADDING.top,
      right: Number.isFinite(rightValue) ? rightValue : DEFAULT_PADDING.right,
      bottom: Number.isFinite(bottomValue) ? bottomValue : DEFAULT_PADDING.bottom,
      left: Number.isFinite(leftValue) ? leftValue : DEFAULT_PADDING.left,
    };
  }, [paddingTop, paddingRight, paddingBottom, paddingLeft]);

  const parsedTitleSize = Number(titleSize);
  const parsedXAxisFontSize = Number(xAxisFontSize);
  const parsedYAxisFontSize = Number(yAxisFontSize);
  const parsedSourceFontSize = Number(sourceFontSize);

  const resolvedTitleSize = Number.isFinite(parsedTitleSize) ? parsedTitleSize : 24;
  const resolvedXAxisFontSize = Number.isFinite(parsedXAxisFontSize)
    ? parsedXAxisFontSize
    : 12;
  const resolvedYAxisFontSize = Number.isFinite(parsedYAxisFontSize)
    ? parsedYAxisFontSize
    : 12;
  const resolvedSourceFontSize = Number.isFinite(parsedSourceFontSize)
    ? parsedSourceFontSize
    : 12;

  const detectXField = (row: Record<string, unknown>) => {
    if (row.month !== undefined && row.year !== undefined) return "month";
    if (row.brand !== undefined) return "brand";
    if (row.maker !== undefined) return "maker";
    if (row.automaker !== undefined) return "automaker";
    return Object.keys(row).find((k) =>
      ["name", "label", "period", "date"].includes(k.toLowerCase())
    );
  };

  const detectYField = (row: Record<string, unknown>) => {
    if (row.value !== undefined) return "value";
    if (row.installation !== undefined) return "installation";
    if (row.retailSales !== undefined) return "retailSales";
    return Object.keys(row).find(
      (k) =>
        typeof row[k] === "number" &&
        !["year", "month", "period", "ranking"].includes(k)
    );
  };

  const { chartData, previewError } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [] as Array<{ label: string; value: number }>, previewError: null as string | null };
    }
    const sampleRow = data[0];
    const resolvedXField = xAxisField !== "auto" ? xAxisField : detectXField(sampleRow);
    const resolvedYField = detectYField(sampleRow);

    if (!resolvedXField || !resolvedYField) {
      return {
        chartData: [],
        previewError: "Could not detect chart fields. Select a valid X-Axis field.",
      };
    }

    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const rows = data.map((row) => {
      let label: string;
      if (
        resolvedXField === "month" &&
        row.year !== undefined &&
        row.month !== undefined
      ) {
        const monthIndex = Number(row.month) - 1;
        label = `${monthNames[monthIndex] || row.month} ${row.year}`;
      } else {
        label = String(row[resolvedXField]);
      }
      const rawValue = Number(row[resolvedYField]) || 0;
      return { label, value: rawValue };
    });

    return { chartData: rows, previewError: null };
  }, [data, xAxisField]);

  const previewWidth = Math.max(640, chartData.length * 60);
  const previewHeight =
    chartType === "horizontalBar"
      ? Math.max(320, chartData.length * 28)
      : 420;

  useEffect(() => {
    if (!chartImageRef.current) return;
    setChartImage(null);
    onChartClearedRef.current?.();
  }, [
    chartType,
    title,
    xAxisField,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    fontColor,
    titleColor,
    titleSize,
    backgroundColor,
    xAxisFontSize,
    yAxisFontSize,
    xAxisFontColor,
    yAxisFontColor,
    sourceText,
    sourceFontSize,
    sourceColor,
    barColor,
    data,
  ]);

  const availableColumns = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data]);

  async function generateChart() {
    if (data.length === 0) return;

    setIsLoading(true);
    setError(null);
    setToast({ type: "info", message: "Generating chart image..." });
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    try {
      const padding: Record<string, number> = {};
      if (Number.isFinite(parsedPadding.top)) padding.top = parsedPadding.top;
      if (Number.isFinite(parsedPadding.right)) padding.right = parsedPadding.right;
      if (Number.isFinite(parsedPadding.bottom)) padding.bottom = parsedPadding.bottom;
      if (Number.isFinite(parsedPadding.left)) padding.left = parsedPadding.left;
      const chartOptions = {
        padding: Object.keys(padding).length > 0 ? padding : undefined,
        fontColor,
        titleColor,
        titleSize: resolvedTitleSize,
        backgroundColor,
        xAxisFontSize: resolvedXAxisFontSize,
        yAxisFontSize: resolvedYAxisFontSize,
        xAxisFontColor,
        yAxisFontColor,
        sourceText,
        sourceColor,
        sourceFontSize: resolvedSourceFontSize,
        barColor,
      };

      const res = await fetch("/api/admin/data-explorer/generate-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          chartType,
          title,
          xField: xAxisField !== "auto" ? xAxisField : undefined,
          chartOptions,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate chart");
      }

      const result = await res.json();
      const generatedImage = typeof result?.chartImageBase64 === "string" ? result.chartImageBase64 : "";
      if (!generatedImage || generatedImage.length < 100) {
        setChartImage(null);
        throw new Error("Chart image generation failed (no image returned).");
      }
      setChartImage(generatedImage);
      onChartGenerated?.({
        chartImageBase64: generatedImage,
        title,
        chartType,
      });
      setToast({ type: "success", message: "Chart image generated." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chart generation failed";
      setError(message);
      setToast({ type: "error", message });
    } finally {
      setIsLoading(false);
      toastTimerRef.current = setTimeout(() => setToast(null), 3500);
    }
  }

  const chartTypes: { value: ChartType; label: string; icon: typeof BarChart3 }[] = [
    { value: "bar", label: "Bar", icon: BarChart3 },
    { value: "line", label: "Line", icon: TrendingUp },
    { value: "horizontalBar", label: "Horizontal", icon: BarChart3 },
  ];

  return (
    <div
      id={scrollAnchorId}
      className="relative overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      {toast && (
        <div
          className={`absolute right-3 top-3 z-10 rounded-lg border px-3 py-2 text-xs font-medium shadow-md ${
            toast.type === "success"
              ? "border-lime-300 bg-lime-100/80 text-lime-700"
              : toast.type === "error"
                ? "border-slate-300 bg-slate-100 text-slate-700"
                : "border-slate-200 bg-slate-100 text-slate-700"
          }`}
        >
          {toast.message}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-lime-100/35 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Chart Preview</span>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3 border-b border-slate-200 px-4 py-3">
        {/* Chart Type Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600">Type:</span>
          <div className="flex items-center gap-1">
            {chartTypes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setChartType(value)}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                  chartType === value
                    ? "border-lime-200 bg-lime-100 text-lime-700"
                    : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Icon className={`h-3 w-3 ${value === "horizontalBar" ? "rotate-90" : ""}`} />
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">X-Axis:</span>
            <select
              value={xAxisField}
              onChange={(e) => setXAxisField(e.target.value)}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
            >
              <option value="auto">Auto</option>
              {availableColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setShowCustomize((prev) => !prev)}
            className="ml-auto text-xs font-semibold text-lime-600 underline underline-offset-2 hover:text-lime-700"
          >
            {showCustomize ? "Hide Customization" : "Customize Chart"}
          </button>
        </div>

        {!showCustomize && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Title:</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 rounded border border-slate-300 px-2 py-1 font-mono text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-lime-500"
              placeholder="Chart title..."
            />
          </div>
        )}

        {showCustomize && (
          <div className="space-y-2.5 border-t border-slate-200 pt-3 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex items-center gap-2">
                <span className="font-mono text-xs font-medium text-slate-600">Chart Background</span>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="h-8 w-10 rounded-md border border-slate-300 bg-white p-0.5"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="font-mono text-xs font-medium text-slate-600">Title Size</span>
                <input
                  type="number"
                  value={titleSize}
                  onChange={(e) => setTitleSize(e.target.value)}
                  className="h-8 w-20 rounded border border-slate-300 bg-white px-2 py-1 text-center font-mono text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-lime-500"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="font-mono text-xs font-medium text-slate-600">Title Color</span>
                <input
                  type="color"
                  value={titleColor}
                  onChange={(e) => setTitleColor(e.target.value)}
                  className="h-8 w-10 rounded-md border border-slate-300 bg-white p-0.5"
                />
              </label>
              <label className="flex min-w-[18rem] flex-1 items-center gap-2">
                <span className="font-mono text-xs font-medium text-slate-600">Title</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-center font-mono text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-lime-500"
                  placeholder="Chart title..."
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <label className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                <span className="whitespace-nowrap font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Padding Top
                </span>
                <input
                  type="number"
                  value={paddingTop}
                  onChange={(e) => setPaddingTop(e.target.value)}
                  className="h-8 w-20 rounded-md border border-slate-300 bg-white px-2.5 text-center text-[13px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-lime-500"
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                <span className="whitespace-nowrap font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Padding Right
                </span>
                <input
                  type="number"
                  value={paddingRight}
                  onChange={(e) => setPaddingRight(e.target.value)}
                  className="h-8 w-20 rounded-md border border-slate-300 bg-white px-2.5 text-center text-[13px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-lime-500"
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                <span className="whitespace-nowrap font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Padding Bottom
                </span>
                <input
                  type="number"
                  value={paddingBottom}
                  onChange={(e) => setPaddingBottom(e.target.value)}
                  className="h-8 w-20 rounded-md border border-slate-300 bg-white px-2.5 text-center text-[13px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-lime-500"
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                <span className="whitespace-nowrap font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Padding Left
                </span>
                <input
                  type="number"
                  value={paddingLeft}
                  onChange={(e) => setPaddingLeft(e.target.value)}
                  className="h-8 w-20 rounded-md border border-slate-300 bg-white px-2.5 text-center text-[13px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-lime-500"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-6">
              <label className="min-w-0 flex items-center justify-between gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1">
                <span className="whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
                  Bar Color
                </span>
                <input
                  type="color"
                  value={barColor}
                  onChange={(e) => setBarColor(e.target.value)}
                  className="h-7 w-8 rounded border border-slate-300 bg-white p-0.5"
                />
              </label>
              <label className="min-w-0 flex items-center justify-between gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1">
                <span className="whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
                  Bar Font
                </span>
                <input
                  type="color"
                  value={fontColor}
                  onChange={(e) => setFontColor(e.target.value)}
                  className="h-7 w-8 rounded border border-slate-300 bg-white p-0.5"
                />
              </label>
              <label className="min-w-0 flex items-center justify-between gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1">
                <span className="whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
                  X Size
                </span>
                <input
                  type="number"
                  value={xAxisFontSize}
                  onChange={(e) => setXAxisFontSize(e.target.value)}
                  className="h-7 w-12 rounded border border-slate-300 bg-white px-1.5 text-center text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-lime-500"
                />
              </label>
              <label className="min-w-0 flex items-center justify-between gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1">
                <span className="whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
                  X Color
                </span>
                <input
                  type="color"
                  value={xAxisFontColor}
                  onChange={(e) => setXAxisFontColor(e.target.value)}
                  className="h-7 w-8 rounded border border-slate-300 bg-white p-0.5"
                />
              </label>
              <label className="min-w-0 flex items-center justify-between gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1">
                <span className="whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
                  Y Size
                </span>
                <input
                  type="number"
                  value={yAxisFontSize}
                  onChange={(e) => setYAxisFontSize(e.target.value)}
                  className="h-7 w-12 rounded border border-slate-300 bg-white px-1.5 text-center text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-lime-500"
                />
              </label>
              <label className="min-w-0 flex items-center justify-between gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1">
                <span className="whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
                  Y Color
                </span>
                <input
                  type="color"
                  value={yAxisFontColor}
                  onChange={(e) => setYAxisFontColor(e.target.value)}
                  className="h-7 w-8 rounded border border-slate-300 bg-white p-0.5"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr]">
              <label className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Source Text
                </span>
                <input
                  type="text"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 text-center text-[13px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-lime-500"
                  placeholder="source: evjuice.net"
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Source Size
                </span>
                <input
                  type="number"
                  value={sourceFontSize}
                  onChange={(e) => setSourceFontSize(e.target.value)}
                  className="h-8 w-20 rounded-md border border-slate-300 bg-white px-2.5 text-center text-[13px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-lime-500"
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Source Color
                </span>
                <input
                  type="color"
                  value={sourceColor}
                  onChange={(e) => setSourceColor(e.target.value)}
                  className="h-8 w-10 rounded-md border border-slate-300 bg-white p-0.5"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Chart Display */}
      <div className="space-y-4 bg-lime-100/35 p-4">
        {previewError ? (
          <div className="text-center text-slate-700">
            <p className="font-medium">Preview Error</p>
            <p className="text-sm mt-1">{previewError}</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div
              className="relative rounded-lg border border-slate-200 shadow-sm"
              style={{
                backgroundColor,
                minWidth: previewWidth,
              }}
            >
              <div
                className="pt-4 pb-2 text-center font-semibold"
                style={{ color: titleColor, fontSize: `${resolvedTitleSize}px` }}
              >
                {title || "Data Results"}
              </div>
              <div style={{ height: previewHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "line" ? (
                    <LineChart
                      data={chartData}
                      margin={parsedPadding}
                    >
                      <CartesianGrid stroke="#e5e7eb" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: resolvedXAxisFontSize, fill: xAxisFontColor }}
                      />
                      <YAxis
                        tick={{ fontSize: resolvedYAxisFontSize, fill: yAxisFontColor }}
                      />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={barColor}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  ) : chartType === "horizontalBar" ? (
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={parsedPadding}
                    >
                      <CartesianGrid stroke="#e5e7eb" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: resolvedXAxisFontSize, fill: xAxisFontColor }}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        tick={{ fontSize: resolvedYAxisFontSize, fill: yAxisFontColor }}
                        width={80}
                      />
                      <Tooltip />
                      <Bar dataKey="value" fill={barColor} radius={[6, 6, 6, 6]}>
                        <LabelList dataKey="value" position="right" fill={fontColor} fontSize={11} />
                      </Bar>
                    </BarChart>
                  ) : (
                    <BarChart data={chartData} margin={parsedPadding}>
                      <CartesianGrid stroke="#e5e7eb" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: resolvedXAxisFontSize, fill: xAxisFontColor }}
                      />
                      <YAxis
                        tick={{ fontSize: resolvedYAxisFontSize, fill: yAxisFontColor }}
                      />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} fill={barColor}>
                        <LabelList dataKey="value" position="top" fill={fontColor} fontSize={11} />
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
              <div
                className="absolute bottom-3 right-4 italic"
                style={{ color: sourceColor, fontSize: `${resolvedSourceFontSize}px` }}
              >
                {sourceText}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center text-slate-700">
            <p className="font-medium">Image Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {chartImage ? (
          <div className="w-full overflow-x-auto">
            <div className="mb-2 text-center text-xs font-medium text-slate-600">
              Generated image
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={chartImage}
              alt="Generated chart"
              className="block h-auto max-w-none mx-auto rounded-lg shadow-sm"
            />
            <div className="mt-3 flex justify-end">
              <a
                href={chartImage}
                download={`chart-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "data"}.png`}
                className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-lime-600"
              >
                <Download className="h-4 w-4" />
                Download Image
              </a>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-center sm:text-left">
                Generate an image to download or attach when posting to X.
              </span>
              <button
                onClick={generateChart}
                disabled={isLoading || data.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-lime-600 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-4 w-4" />
                    Generate Image
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
