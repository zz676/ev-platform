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
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Header */}
<<<<<<< Updated upstream
      <div className="flex items-center justify-between border-b border-slate-200 bg-lime-100/35 px-4 py-2.5">
=======
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
>>>>>>> Stashed changes
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">
            Generated Query
          </span>
          <span className="rounded bg-lime-100 px-2 py-0.5 font-mono text-xs text-lime-700">
            {table}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={!sqlPreview && !sqlOverride}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            title="Copy SQL"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy SQL
          </button>
          <button
            onClick={onExecute}
            disabled={isLoading || !query}
            className="inline-flex items-center gap-1.5 rounded-lg bg-lime-500 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-lime-600 disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="overflow-x-auto break-words border-b border-lime-200 bg-lime-100/45 px-4 py-2 text-sm text-lime-700">
          {explanation}
        </div>
      )}

      {/* Query Display/Editor */}
      <div className="border-t border-slate-200 bg-lime-100/30 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Prisma
              </span>
            </div>
            <textarea
              value={prettyQuery}
              onChange={(e) => {
                onChange(e.target.value);
                setLocalError(null);
              }}
              className="h-[5rem] min-h-[5rem] max-h-[60vh] w-full resize-y overflow-auto whitespace-pre break-normal rounded-lg border border-lime-300 bg-lime-100/60 p-3 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-lime-500"
              spellCheck={false}
              wrap="off"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                SQL
              </span>
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
              className="h-[5rem] min-h-[5rem] max-h-[60vh] w-full resize-y overflow-auto whitespace-pre break-normal rounded-lg border border-lime-300 bg-lime-100/60 p-3 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-lime-500"
              spellCheck={false}
              wrap="off"
            />
          </div>
        </div>
      </div>

      {/* Error Display */}
      {effectiveError && (
        <div className="flex items-start gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-lime-600" />
          <span className="text-sm text-slate-700">{effectiveError}</span>
        </div>
      )}
    </div>
  );
}
