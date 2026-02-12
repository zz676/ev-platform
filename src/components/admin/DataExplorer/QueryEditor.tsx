"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Play, RefreshCw, Code, AlertCircle, Copy } from "lucide-react";
import {
  prismaFindManyToSql,
  sqlToPrismaFindMany,
} from "@/lib/data-explorer/sql-preview";

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
  const [sqlOverride, setSqlOverride] = useState<string | null>(null);
  const sqlEditRef = useRef(false);
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

  useEffect(() => {
    if (sqlEditRef.current) {
      sqlEditRef.current = false;
      return;
    }
    setSqlOverride(null);
  }, [query]);

  async function handleCopy() {
    try {
      const text = sqlOverride ?? sqlPreview;
      await navigator.clipboard.writeText(text || "");
      setLocalError(null);
    } catch {
      // Clipboard permissions can fail depending on browser context.
      setLocalError("Failed to copy to clipboard (browser blocked clipboard access).");
    }
  }

  return (
    <div className="border border-ev-green-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-ev-green-50 border-b border-ev-green-200">
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
          <button
            onClick={handleCopy}
            disabled={!sqlPreview && !sqlOverride}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            title="Copy SQL"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy SQL
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
              className="w-full h-[5rem] min-h-[5rem] max-h-[60vh] p-3 font-mono text-sm bg-white text-emerald-700 border border-lime-300 rounded focus:outline-none focus:ring-2 focus:ring-ev-green-500 resize-y overflow-auto whitespace-pre break-normal"
              spellCheck={false}
              wrap="off"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-gray-700 uppercase">SQL</span>
            </div>
            <textarea
              value={sqlOverride ?? sqlPreview}
              onChange={(e) => {
                const next = e.target.value;
                setSqlOverride(next);
                if (!next.trim()) {
                  setLocalError(null);
                  return;
                }
                const parsed = sqlToPrismaFindMany(next);
                if (!parsed) {
                  setLocalError(
                    "SQL parser supports simple SELECT/WHERE/ORDER/LIMIT/OFFSET. Update Prisma JSON for complex queries."
                  );
                  return;
                }
                sqlEditRef.current = true;
                onChange(JSON.stringify(parsed, null, 2));
                setLocalError(null);
              }}
              placeholder="SQL (editable). Supports simple SELECT/WHERE/ORDER/LIMIT/OFFSET."
              className="w-full h-[5rem] min-h-[5rem] max-h-[60vh] p-3 font-mono text-sm bg-lime-100 text-amber-900 border border-lime-300 rounded focus:outline-none focus:ring-2 focus:ring-ev-green-500 resize-y overflow-auto whitespace-pre break-normal"
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
