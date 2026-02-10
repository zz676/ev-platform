"use client";

import { useMemo, useState } from "react";
import { RefreshCw, BarChart3, TrendingUp, Image as ImageIcon } from "lucide-react";

type ChartType = "bar" | "line" | "horizontalBar";

const DEFAULT_CHART_FONT_SCALE = 2;
const DEFAULT_PAD_X_SCALE = 0.736;
const defaultPx = (n: number) =>
  Math.max(1, Math.round(n * DEFAULT_CHART_FONT_SCALE));
const defaultPadx = (n: number) =>
  Math.max(0, Math.round(n * DEFAULT_PAD_X_SCALE));
const DEFAULT_OUTER_PAD = defaultPx(22);
const DEFAULT_ATTRIBUTION_BOTTOM_PADDING =
  defaultPx(12) + defaultPx(12) + 6;
const DEFAULT_PADDING = {
  top: DEFAULT_OUTER_PAD,
  right: DEFAULT_OUTER_PAD + defaultPadx(defaultPx(48)),
  bottom: DEFAULT_OUTER_PAD + DEFAULT_ATTRIBUTION_BOTTOM_PADDING,
  left: DEFAULT_OUTER_PAD + defaultPadx(defaultPx(48)),
};

interface ChartPreviewProps {
  data: Record<string, unknown>[];
  initialChartType?: ChartType;
  initialTitle?: string;
  onChartGenerated?: (result: {
    chartImageBase64: string;
    title: string;
    chartType: ChartType;
  }) => void;
}

export function ChartPreview({
  data,
  initialChartType = "bar",
  initialTitle = "Data Results",
  onChartGenerated,
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
  const [fontColor, setFontColor] = useState("#111827");
  const [titleColor, setTitleColor] = useState("#111827");
  const [titleSize, setTitleSize] = useState("24");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [xAxisFontSize, setXAxisFontSize] = useState("12");
  const [yAxisFontSize, setYAxisFontSize] = useState("12");
  const [xAxisFontColor, setXAxisFontColor] = useState("#111827");
  const [yAxisFontColor, setYAxisFontColor] = useState("#111827");
  const [sourceText, setSourceText] = useState("source: evjuice.net");
  const [sourceFontSize, setSourceFontSize] = useState("12");
  const [sourceColor, setSourceColor] = useState("#3eb265");
  const [xAxisField, setXAxisField] = useState("auto");

  const availableColumns = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data]);

  async function generateChart() {
    if (data.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const padding: Record<string, number> = {};
      const topValue = Number(paddingTop);
      const rightValue = Number(paddingRight);
      const bottomValue = Number(paddingBottom);
      const leftValue = Number(paddingLeft);
      if (paddingTop.trim() !== "" && Number.isFinite(topValue)) {
        padding.top = topValue;
      }
      if (paddingRight.trim() !== "" && Number.isFinite(rightValue)) {
        padding.right = rightValue;
      }
      if (paddingBottom.trim() !== "" && Number.isFinite(bottomValue)) {
        padding.bottom = bottomValue;
      }
      if (paddingLeft.trim() !== "" && Number.isFinite(leftValue)) {
        padding.left = leftValue;
      }

      const parsedTitleSize = Number(titleSize);
      const parsedXAxisFontSize = Number(xAxisFontSize);
      const parsedYAxisFontSize = Number(yAxisFontSize);
      const parsedSourceFontSize = Number(sourceFontSize);
      const chartOptions = showCustomize
        ? {
            padding: Object.keys(padding).length > 0 ? padding : undefined,
            fontColor,
            titleColor,
            titleSize: Number.isFinite(parsedTitleSize)
              ? parsedTitleSize
              : undefined,
            backgroundColor,
            xAxisFontSize: Number.isFinite(parsedXAxisFontSize)
              ? parsedXAxisFontSize
              : undefined,
            yAxisFontSize: Number.isFinite(parsedYAxisFontSize)
              ? parsedYAxisFontSize
              : undefined,
            xAxisFontColor,
            yAxisFontColor,
            sourceText,
            sourceColor,
            sourceFontSize: Number.isFinite(parsedSourceFontSize)
              ? parsedSourceFontSize
              : undefined,
          }
        : undefined;

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
      setChartImage(result.chartImageBase64);
      onChartGenerated?.({
        chartImageBase64: result.chartImageBase64,
        title,
        chartType,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chart generation failed");
    } finally {
      setIsLoading(false);
    }
  }

  const chartTypes: { value: ChartType; label: string; icon: typeof BarChart3 }[] = [
    { value: "bar", label: "Bar", icon: BarChart3 },
    { value: "line", label: "Line", icon: TrendingUp },
    { value: "horizontalBar", label: "Horizontal", icon: BarChart3 },
  ];

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Chart Preview</span>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-b border-gray-200 space-y-3">
        {/* Chart Type Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-600">Type:</span>
          <div className="flex items-center gap-1">
            {chartTypes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setChartType(value)}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors ${
                  chartType === value
                    ? "bg-ev-green-100 text-ev-green-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Icon className={`h-3 w-3 ${value === "horizontalBar" ? "rotate-90" : ""}`} />
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">X-Axis:</span>
            <select
              value={xAxisField}
              onChange={(e) => setXAxisField(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
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
            className="ml-auto text-xs font-medium text-ev-green-600 underline underline-offset-2 hover:text-ev-green-700"
          >
            {showCustomize ? "Hide Customization" : "Customize Chart"}
          </button>
        </div>

        {/* Title Input */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-600">Title:</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-ev-green-500"
            placeholder="Chart title..."
          />
          <button
            onClick={generateChart}
            disabled={isLoading || data.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-ev-green-500 text-white text-sm font-medium rounded-lg hover:bg-ev-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4" />
                Generate Chart
              </>
            )}
          </button>
        </div>

        {showCustomize && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs text-gray-600">
            <div className="space-y-2">
              <div className="font-semibold text-gray-700">Padding (px)</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input
                  type="number"
                  value={paddingTop}
                  onChange={(e) => setPaddingTop(e.target.value)}
                  placeholder="Top"
                  className="w-full px-2 py-1 border border-gray-300 rounded"
                />
                <input
                  type="number"
                  value={paddingRight}
                  onChange={(e) => setPaddingRight(e.target.value)}
                  placeholder="Right"
                  className="w-full px-2 py-1 border border-gray-300 rounded"
                />
                <input
                  type="number"
                  value={paddingBottom}
                  onChange={(e) => setPaddingBottom(e.target.value)}
                  placeholder="Bottom"
                  className="w-full px-2 py-1 border border-gray-300 rounded"
                />
                <input
                  type="number"
                  value={paddingLeft}
                  onChange={(e) => setPaddingLeft(e.target.value)}
                  placeholder="Left"
                  className="w-full px-2 py-1 border border-gray-300 rounded"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-gray-700">Typography</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2">
                  <span>Font</span>
                  <input
                    type="color"
                    value={fontColor}
                    onChange={(e) => setFontColor(e.target.value)}
                    className="h-6 w-8 border border-gray-300 rounded"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span>Title</span>
                  <input
                    type="color"
                    value={titleColor}
                    onChange={(e) => setTitleColor(e.target.value)}
                    className="h-6 w-8 border border-gray-300 rounded"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span>Title Size</span>
                  <input
                    type="number"
                    value={titleSize}
                    onChange={(e) => setTitleSize(e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-gray-700">Axes</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2">
                  <span>X Size</span>
                  <input
                    type="number"
                    value={xAxisFontSize}
                    onChange={(e) => setXAxisFontSize(e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span>X Color</span>
                  <input
                    type="color"
                    value={xAxisFontColor}
                    onChange={(e) => setXAxisFontColor(e.target.value)}
                    className="h-6 w-8 border border-gray-300 rounded"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span>Y Size</span>
                  <input
                    type="number"
                    value={yAxisFontSize}
                    onChange={(e) => setYAxisFontSize(e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span>Y Color</span>
                  <input
                    type="color"
                    value={yAxisFontColor}
                    onChange={(e) => setYAxisFontColor(e.target.value)}
                    className="h-6 w-8 border border-gray-300 rounded"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-gray-700">Source</div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded"
                  placeholder="source: evjuice.net"
                />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2">
                    <span>Size</span>
                    <input
                      type="number"
                      value={sourceFontSize}
                      onChange={(e) => setSourceFontSize(e.target.value)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span>Color</span>
                    <input
                      type="color"
                      value={sourceColor}
                      onChange={(e) => setSourceColor(e.target.value)}
                      className="h-6 w-8 border border-gray-300 rounded"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-gray-700">Background</div>
              <label className="flex items-center gap-2">
                <span>Chart</span>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="h-6 w-8 border border-gray-300 rounded"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Chart Display */}
      <div className="p-4 min-h-[300px] bg-gray-50 flex items-center justify-center">
        {error ? (
          <div className="text-center text-red-600">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : chartImage ? (
          <div className="w-full overflow-x-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={chartImage}
              alt="Generated chart"
              className="block h-auto max-w-none mx-auto rounded-lg shadow-sm"
            />
          </div>
        ) : (
          <div className="text-center text-gray-500">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p className="font-medium">No chart generated</p>
            <p className="text-sm mt-1">Click &quot;Generate Chart&quot; to create a visualization</p>
          </div>
        )}
      </div>
    </div>
  );
}
