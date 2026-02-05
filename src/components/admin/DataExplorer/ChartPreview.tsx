"use client";

import { useState } from "react";
import { RefreshCw, BarChart3, TrendingUp, Image as ImageIcon } from "lucide-react";

type ChartType = "bar" | "line" | "horizontalBar";

interface ChartPreviewProps {
  data: Record<string, unknown>[];
  initialChartType?: ChartType;
  initialTitle?: string;
  onChartGenerated?: (chartImageBase64: string) => void;
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

  async function generateChart() {
    if (data.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/data-explorer/generate-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          chartType,
          title,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate chart");
      }

      const result = await res.json();
      setChartImage(result.chartImageBase64);
      onChartGenerated?.(result.chartImageBase64);
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
        <div className="flex items-center gap-2">
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
      </div>

      {/* Chart Display */}
      <div className="p-4 min-h-[300px] bg-gray-50 flex items-center justify-center">
        {error ? (
          <div className="text-center text-red-600">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : chartImage ? (
          <div className="w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={chartImage}
              alt="Generated chart"
              className="w-full max-w-3xl mx-auto rounded-lg shadow-sm"
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
