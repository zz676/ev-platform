"use client";

import { useState } from "react";
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

  if (data.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
        <Table className="h-12 w-12 mx-auto mb-3 text-gray-400" />
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
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 cursor-pointer"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Table className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Results</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
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
        <button className="text-xs text-gray-500 hover:text-gray-700">
          {isCollapsed ? "Show" : "Hide"}
        </button>
      </div>

      {/* Table Info */}
      {tableInfo && !isCollapsed && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
          {tableInfo.description}
        </div>
      )}

      {/* Table */}
      {!isCollapsed && (
        <>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-100">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap border-b border-gray-200"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pageData.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {columns.map((col) => (
                      <td
                        key={col}
                        className="px-3 py-2 text-gray-700 whitespace-nowrap"
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
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                Showing {startIndex + 1}-{endIndex} of {data.length}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 text-xs text-gray-600">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
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
