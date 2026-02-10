"use client";

import { useState } from "react";
import { Play, RefreshCw, Code, AlertCircle } from "lucide-react";

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
  const [isEditing, setIsEditing] = useState(false);

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
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
          >
            {isEditing ? "View" : "Edit"}
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
      <div className="p-4 bg-gray-900">
        {isEditing ? (
          <textarea
            value={query}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-48 p-3 font-mono text-sm bg-gray-800 text-green-400 border border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-ev-green-500 resize-none"
            spellCheck={false}
          />
        ) : (
          <pre className="p-3 font-mono text-sm text-green-400 bg-gray-800 rounded overflow-auto max-h-[28rem]">
            <code>{query || "// No query generated"}</code>
          </pre>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-200 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}
    </div>
  );
}
