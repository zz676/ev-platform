"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Table, Clock, Rows } from "lucide-react";

interface ResultsTableProps {
  data: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  tableInfo?: { fields: string[]; description: string };
}

const PAGE_SIZE = 20;

export function ResultsTable({
  data,
  rowCount,
  executionTimeMs,
  tableInfo,
}: ResultsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    // Reset paging whenever a new query result set arrives.
    setCurrentPage(1);
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        <Table className="h-12 w-12 mx-auto mb-3 text-slate-400" />
        <p className="font-medium">No results</p>
        <p className="text-sm mt-1">The query returned no data.</p>
      </div>
    );
  }

  // Get column headers from first row
  const columns = Object.keys(data[0]);

  // Pagination
  const totalPages = Math.ceil(data.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, data.length);
  const pageData = data.slice(startIndex, endIndex);

  // Format cell value for display
  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number") {
      if (Number.isInteger(value)) return value.toLocaleString();
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div
        className="flex cursor-pointer items-center justify-between border-b border-slate-200 bg-lime-100/35 px-4 py-2.5"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Table className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Results</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Rows className="h-3 w-3" />
              {rowCount} rows
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {executionTimeMs}ms
            </span>
          </div>
        </div>
        <button className="text-xs text-slate-500 hover:text-slate-700">
          {isCollapsed ? "Show" : "Hide"}
        </button>
      </div>

      {/* Table Info */}
      {tableInfo && !isCollapsed && (
        <div className="border-b border-lime-200 bg-lime-100/45 px-4 py-2 text-xs text-lime-700">
          {tableInfo.description}
        </div>
      )}

      {/* Table */}
      {!isCollapsed && (
        <>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full font-mono text-sm">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-900"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pageData.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="hover:bg-lime-100/35 transition-colors"
                  >
                    {columns.map((col) => (
                      <td
                        key={col}
                        className="whitespace-nowrap px-3 py-2 text-sm text-slate-900"
                      >
                        {formatCellValue(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-lime-100/35 px-4 py-2">
              <div className="text-xs text-slate-500">
                Showing {startIndex + 1}-{endIndex} of {data.length}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 text-xs text-slate-600">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
