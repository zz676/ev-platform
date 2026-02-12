"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Database, RefreshCw, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/context/AuthContext";
import {
  QueryInput,
  QueryEditor,
  ResultsTable,
  ChartPreview,
  PostComposer,
} from "@/components/admin/DataExplorer";

interface SuggestedQuestions {
  [category: string]: string[];
}

interface TableInfo {
  name: string;
  description: string;
}

interface QueryResult {
  data: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  tableInfo?: { fields: string[]; description: string };
}

export default function DataExplorerPage() {
  const router = useRouter();
  const { user, isAdmin, isLoading: authLoading } = useAuth();

  // Options
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<SuggestedQuestions>({});
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Query state
  const [question, setQuestion] = useState("");
  const [table, setTable] = useState("");
  const [queryString, setQueryString] = useState("");
  const [explanation, setExplanation] = useState<string | undefined>();

  // Execution state
  const [results, setResults] = useState<QueryResult | null>(null);
  const [chartImage, setChartImage] = useState<string | null>(null);
  const [chartMeta, setChartMeta] = useState<{ title: string; chartType: string } | null>(null);
  const [shouldScrollToChart, setShouldScrollToChart] = useState(false);
  const [shouldScrollToPost, setShouldScrollToPost] = useState(false);

  // Loading states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Fetch options on mount
  useEffect(() => {
    fetchOptions();
  }, []);

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push("/");
    }
  }, [user, isAdmin, authLoading, router]);

  async function fetchOptions() {
    setLoadingOptions(true);
    try {
      const res = await fetch("/api/admin/data-explorer/generate-query");
      if (!res.ok) throw new Error("Failed to fetch options");

      const data = await res.json();
      setTables(data.tables || []);
      setSuggestedQuestions(data.suggestedQuestions || {});
    } catch (err) {
      console.error("Error fetching options:", err);
    } finally {
      setLoadingOptions(false);
    }
  }

  async function handleGenerateQuery() {
    if (!question.trim()) return;

    setIsGenerating(true);
    setError(null);
    setResults(null);
    setChartImage(null);
    setChartMeta(null);

    try {
      const res = await fetch("/api/admin/data-explorer/generate-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate query");
      }

      const data = await res.json();
      setTable(data.table);
      setQueryString(JSON.stringify(data.query, null, 2));
      setExplanation(data.explanation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleExecuteQuery() {
    if (!table || !queryString) return;

    setIsExecuting(true);
    setError(null);

    try {
      // Parse query string
      let query: Record<string, unknown>;
      try {
        query = JSON.parse(queryString);
      } catch {
        throw new Error("Invalid JSON in query");
      }

      const res = await fetch("/api/admin/data-explorer/execute-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, query }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to execute query");
      }

      const data = await res.json();
      setResults(data);
      setShouldScrollToChart(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setIsExecuting(false);
    }
  }

  useEffect(() => {
    if (!shouldScrollToChart || !results) return;
    const timeout = setTimeout(() => {
      const el = document.getElementById("chart-preview");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setShouldScrollToChart(false);
    }, 150);
    return () => clearTimeout(timeout);
  }, [shouldScrollToChart, results]);

  function handleReset() {
    setQuestion("");
    setTable("");
    setQueryString("");
    setExplanation(undefined);
    setResults(null);
    setChartImage(null);
    setChartMeta(null);
    setError(null);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  useEffect(() => {
    if (!shouldScrollToPost || !chartImage) return;
    const timeout = setTimeout(() => {
      const el = document.getElementById("compose-post");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setShouldScrollToPost(false);
    }, 150);
    return () => clearTimeout(timeout);
  }, [shouldScrollToPost, chartImage]);

  return (
    <div className="min-h-screen bg-ev-green-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Database className="h-6 w-6 text-ev-green-600" />
                  Data Explorer
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Query EV industry data with natural language
                </p>
              </div>
            </div>
            <div className="flex flex-col justify-end self-stretch">
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-ev-green-500 text-white text-sm font-medium rounded-lg hover:bg-ev-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Step 1: Query Input */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Step 1: Ask a Question
          </h2>
          <QueryInput
            value={question}
            onChange={setQuestion}
            onSubmit={handleGenerateQuery}
            isLoading={isGenerating}
            suggestedQuestions={suggestedQuestions}
          />
        </div>

        {/* Step 2: Query Editor */}
        {(table || queryString) && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Step 2: Review / Edit Query
            </h2>
            <QueryEditor
              table={table}
              query={queryString}
              onChange={setQueryString}
              onExecute={handleExecuteQuery}
              isLoading={isExecuting}
              error={error}
              explanation={explanation}
            />
          </div>
        )}

        {/* Step 3: Results */}
        {results && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Step 3: View Results & Chart
            </h2>

            <ResultsTable
              data={results.data}
              rowCount={results.rowCount}
              executionTimeMs={results.executionTimeMs}
              tableInfo={results.tableInfo}
            />

            <ChartPreview
              scrollAnchorId="chart-preview"
              data={results.data}
              initialTitle={question || "Data Results"}
              onChartCleared={() => {
                setChartImage(null);
                setChartMeta(null);
              }}
      onChartGenerated={(r) => {
        setChartImage(r.chartImageBase64);
        setChartMeta({ title: r.title, chartType: r.chartType });
        setShouldScrollToPost(true);
      }}
    />
  </div>
)}

        {/* Step 4: Post Composer */}
        {results && results.data.length > 0 && (
          <div id="compose-post">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Step 4: Compose & Post
            </h2>
            <PostComposer
              chartImageBase64={chartImage}
              question={question}
              table={table}
              prismaQuery={queryString}
              results={results.data}
              chartTitle={chartMeta?.title || question || "Data Results"}
              chartType={chartMeta?.chartType || "bar"}
              onPostSuccess={() => {
                // Could refresh or show success state
              }}
            />
          </div>
        )}

        {/* Available Tables (when no query) */}
        {!table && !queryString && !loadingOptions && tables.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Available Data Tables
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tables.map((t) => (
                <div
                  key={t.name}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <p className="font-mono text-sm text-ev-green-700">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
