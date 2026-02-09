"use client";

import { useState, useEffect } from "react";
import { Activity, DollarSign, Zap, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { AIUsageChart } from "@/components/admin/AIUsageChart";

interface UsageSummary {
  totalCost: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
}

interface SourceStats {
  source: string;
  cost: number;
  count: number;
}

interface DailyUsage {
  date: string;
  count: number;
  cost: number;
}

interface RecentUsage {
  id: string;
  type: string;
  model: string;
  size: string | null;
  cost: number;
  success: boolean;
  errorMsg: string | null;
  postId: string | null;
  source: string;
  createdAt: string;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number | null;
}

interface AIUsageData {
  summary: UsageSummary;
  bySource: SourceStats[];
  dailyUsage: DailyUsage[];
  recentUsage: RecentUsage[];
  recentUsagePagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export default function MonitoringPage() {
  const [data, setData] = useState<AIUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fetchData = async (page: number = currentPage) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/ai-usage?page=${page}&limit=${pageSize}&sortBy=${encodeURIComponent(
          sortBy
        )}&sortDir=${sortDir}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch AI usage data");
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage);
  }, [currentPage, sortBy, sortDir]);

  const toggleSort = (field: string) => {
    setCurrentPage(1);
    setSortBy((prev) => {
      if (prev === field) {
        setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("desc");
      return field;
    });
  };

  const sortIndicator = (field: string) => {
    if (sortBy !== field) return null;
    return (
      <span className="ml-1 text-[0.65rem] text-gray-400">
        {sortDir === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  const successRate = data?.summary
    ? data.summary.totalCalls > 0
      ? ((data.summary.successfulCalls / data.summary.totalCalls) * 100).toFixed(1)
      : "0"
    : "0";

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 lg:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-ev-green-100">
              <Activity className="h-5 w-5 text-ev-green-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Monitoring</h1>
              <p className="text-sm text-gray-500">AI Usage & Cost Tracking</p>
            </div>
          </div>
          <button
            onClick={() => void fetchData()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {isLoading && !data ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100">
                  <DollarSign className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Cost</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${data.summary.totalCost.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
                  <Zap className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Calls</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {data.summary.totalCalls}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100">
                  <CheckCircle className="h-5 w-5 text-purple-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Success Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{successRate}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Daily Cost (Last 30 Days)
            </h2>
            <AIUsageChart data={data.dailyUsage} />
          </div>

          {/* By Source and By Model sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">By Source</h2>
              {data.bySource.length > 0 ? (
                <div className="space-y-3">
                  {data.bySource.map((source) => (
                    <div
                      key={source.source}
                      className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-gray-700 capitalize">{source.source}</span>
                      <div className="text-right">
                        <span className="font-medium text-gray-900">
                          ${source.cost.toFixed(4)}
                        </span>
                        <span className="text-gray-500 text-sm ml-2">
                          ({source.count} calls)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No data available</p>
              )}
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Success / Failure
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-gray-700">Successful</span>
                  </div>
                  <span className="font-medium text-gray-900">
                    {data.summary.successfulCalls}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-gray-700">Failed</span>
                  </div>
                  <span className="font-medium text-gray-900">
                    {data.summary.failedCalls}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity Table */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => toggleSort("createdAt")}
                        className="inline-flex items-center hover:text-gray-700"
                      >
                        Time
                        {sortIndicator("createdAt")}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => toggleSort("model")}
                        className="inline-flex items-center hover:text-gray-700"
                      >
                        Model
                        {sortIndicator("model")}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => toggleSort("source")}
                        className="inline-flex items-center hover:text-gray-700"
                      >
                        Source
                        {sortIndicator("source")}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => toggleSort("tokens")}
                        className="inline-flex items-center hover:text-gray-700"
                      >
                        Tokens
                        {sortIndicator("tokens")}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => toggleSort("cost")}
                        className="inline-flex items-center hover:text-gray-700"
                      >
                        Cost
                        {sortIndicator("cost")}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => toggleSort("durationMs")}
                        className="inline-flex items-center hover:text-gray-700"
                      >
                        Duration
                        {sortIndicator("durationMs")}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => toggleSort("success")}
                        className="inline-flex items-center hover:text-gray-700"
                      >
                        Status
                        {sortIndicator("success")}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.recentUsage.length > 0 ? (
                    data.recentUsage.map((usage) => (
                      <tr key={usage.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(usage.createdAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {usage.model}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                          {usage.source}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {usage.inputTokens != null && usage.outputTokens != null ? (
                            <span title={`Input: ${usage.inputTokens}, Output: ${usage.outputTokens}`}>
                              {(usage.inputTokens + usage.outputTokens).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${usage.cost.toFixed(4)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {usage.durationMs != null ? (
                            <span>
                              {usage.durationMs >= 1000
                                ? `${(usage.durationMs / 1000).toFixed(1)}s`
                                : `${usage.durationMs}ms`}
                            </span>
                          ) : (
                            <span className="text-gray-400">&mdash;</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {usage.success ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                              <CheckCircle className="h-3 w-3" />
                              Success
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full"
                              title={usage.errorMsg || "Unknown error"}
                            >
                              <XCircle className="h-3 w-3" />
                              Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        No recent activity
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {data.recentUsagePagination && data.recentUsagePagination.total > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  Page {data.recentUsagePagination.page} of {data.recentUsagePagination.totalPages} ·{" "}
                  {data.recentUsagePagination.total.toLocaleString()} records
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={isLoading || data.recentUsagePagination.page <= 1}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) =>
                        Math.min(prev + 1, data.recentUsagePagination!.totalPages)
                      )
                    }
                    disabled={
                      isLoading || !data.recentUsagePagination.hasMore
                    }
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
