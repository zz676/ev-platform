"use client";

import { useMemo, useState } from "react";
import { Play, RefreshCw, Code, AlertCircle, Copy, Wand2 } from "lucide-react";
import { prismaFindManyToSql } from "@/lib/data-explorer/sql-preview";

interface QueryEditorProps {
  table: string;
  query: string;
  onChange: (query: string) => void;
  onExecute: () => void;
  isLoading: boolean;
  error: string | null;
  explanation?: string;
}

export function QueryEditor({
  table,
  query,
  onChange,
  onExecute,
  isLoading,
  error,
  explanation,
}: QueryEditorProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"prisma" | "sql">("prisma");

  const effectiveError = error || localError;

  const prettyQuery = useMemo(() => query || "", [query]);

  const sqlPreview = useMemo(() => {
    if (!table || !query) return "";
    try {
      const parsed = JSON.parse(query) as Record<string, unknown>;
      return prismaFindManyToSql({ table, query: parsed });
    } catch {
      return "";
    }
  }, [table, query]);

  function handleFormat() {
    try {
      const parsed = JSON.parse(query);
      onChange(JSON.stringify(parsed, null, 2));
      setLocalError(null);
    } catch {
      setLocalError("Query JSON is invalid. Fix it before formatting/executing.");
    }
  }

  async function handleCopy() {
    try {
      const text = activeTab === "sql" ? sqlPreview : prettyQuery;
      await navigator.clipboard.writeText(text);
      setLocalError(null);
    } catch {
      // Clipboard permissions can fail depending on browser context.
      setLocalError("Failed to copy to clipboard (browser blocked clipboard access).");
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            Generated Query
          </span>
          <span className="px-2 py-0.5 text-xs font-mono bg-blue-100 text-blue-700 rounded">
            {table}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
            <button
              onClick={() => setActiveTab("prisma")}
              className={`px-2 py-1 text-xs font-medium transition-colors ${
                activeTab === "prisma"
                  ? "bg-lime-200 text-lime-900"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
              title="Copy target: Prisma findMany JSON"
            >
              Prisma
            </button>
            <button
              onClick={() => setActiveTab("sql")}
              className={`px-2 py-1 text-xs font-medium transition-colors ${
                activeTab === "sql"
                  ? "bg-lime-200 text-lime-900"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
              title="Copy target: SQL preview for Postgres/Supabase"
            >
              SQL
            </button>
          </div>
          <button
            onClick={handleFormat}
            disabled={!query}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            title="Format JSON"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Format
          </button>
          <button
            onClick={handleCopy}
            disabled={activeTab === "sql" ? !sqlPreview : !query}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            title={activeTab === "sql" ? "Copy SQL" : "Copy Prisma JSON"}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>
          <button
            onClick={onExecute}
            disabled={isLoading || !query}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-ev-green-500 text-white text-sm font-medium rounded-lg hover:bg-ev-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Query
              </>
            )}
          </button>
        </div>
      </div>

      {/* Explanation */}
      {explanation && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-sm text-blue-700 break-words overflow-x-auto">
          {explanation}
        </div>
      )}

      {/* Query Display/Editor */}
      <div className="p-4 bg-lime-50 border-t border-lime-100">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-gray-700 uppercase">Prisma</span>
            </div>
            <textarea
              value={prettyQuery}
              onChange={(e) => {
                onChange(e.target.value);
                setLocalError(null);
              }}
              className={`w-full h-[5rem] min-h-[5rem] max-h-[60vh] p-3 font-mono text-sm bg-white text-emerald-700 border rounded focus:outline-none focus:ring-2 focus:ring-ev-green-500 resize-y overflow-auto whitespace-pre break-normal ${
                activeTab === "prisma" ? "border-lime-300" : "border-lime-200"
              }`}
              spellCheck={false}
              wrap="off"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-gray-700 uppercase">SQL</span>
            </div>
            <textarea
              value={sqlPreview || "-- Invalid JSON (fix Prisma query first)."}
              readOnly
              className={`w-full h-[5rem] min-h-[5rem] max-h-[60vh] p-3 font-mono text-sm bg-lime-100 text-amber-900 border rounded focus:outline-none resize-y overflow-auto whitespace-pre break-normal ${
                activeTab === "sql" ? "border-lime-300" : "border-lime-200"
              }`}
              spellCheck={false}
              wrap="off"
            />
          </div>
        </div>
      </div>

      {/* Error Display */}
      {effectiveError && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-200 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-700">{effectiveError}</span>
        </div>
      )}
    </div>
  );
}
