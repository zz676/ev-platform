"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Inter, JetBrains_Mono } from "next/font/google";
import {
  ArrowLeft,
  Database,
  RefreshCw,
  AlertCircle,
  Check,
  Circle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
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
  fields: string[];
  columns?: Array<{ name: string; description: string }>;
}

interface QueryResult {
  data: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  tableInfo?: { fields: string[]; description: string };
}

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function DataExplorerPage() {
  const router = useRouter();
  const { user, isAdmin, isLoading: authLoading } = useAuth();

  // Options
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<SuggestedQuestions>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [isTablesExpanded, setIsTablesExpanded] = useState(false);
  const [expandedTableName, setExpandedTableName] = useState<string | null>(null);

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
  const expandedTable = expandedTableName
    ? tables.find((tableInfo) => tableInfo.name === expandedTableName) || null
    : null;
  const expandedTableIndex = expandedTableName
    ? tables.findIndex((tableInfo) => tableInfo.name === expandedTableName)
    : -1;
  const desktopDetailsInsertionIndex =
    expandedTableIndex >= 0
      ? expandedTableIndex % 2 === 0
        ? Math.min(expandedTableIndex + 1, tables.length - 1)
        : expandedTableIndex
      : -1;
  const expandedTableColumns = expandedTable
    ? expandedTable.columns && expandedTable.columns.length > 0
      ? expandedTable.columns
      : expandedTable.fields.map((field) => ({
          name: field,
          description: "",
        }))
    : [];

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

  function scrollToStep(stepId: number) {
    const sectionIdByStep: Record<number, string> = {
      1: "step-ask-question",
      2: "step-review-query",
      3: "step-results-chart",
      4: "compose-post",
    };
    const sectionId = sectionIdByStep[stepId];
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const currentStep = chartImage ? 4 : results ? 3 : table || queryString ? 2 : 1;
  const workflowSteps = [
    {
      id: 1,
      title: "Ask a Question",
      detail: question.trim() || "Define your analysis question.",
    },
    {
      id: 2,
      title: "Review / Edit Query",
      detail: table || "Adjust query logic before running.",
    },
    {
      id: 3,
      title: "View Results & Chart",
      detail: results ? `${results.rowCount} rows ready for charting.` : "Run query and preview chart.",
    },
    {
      id: 4,
      title: "Compose & Post",
      detail: chartImage ? "Chart image generated. Compose your post." : "Generate a chart image to continue.",
    },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div
      className={`${inter.className} ${jetbrainsMono.variable} data-explorer-theme min-h-screen bg-slate-50 text-slate-900`}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-lime-200/50 blur-3xl" />
        <div className="absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-lime-300/35 blur-3xl" />
      </div>

      <div className="relative">
        <header className="border-b border-slate-200/90 bg-white/90 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.back()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-lime-300 hover:bg-lime-50 hover:text-lime-700"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-lime-700">
                    EV Data Explorer
                  </p>
                  <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-lime-500 text-white shadow-lg shadow-lime-500/20">
                      <Database className="h-4 w-4" />
                    </span>
                    Market Analysis Workflow
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Analyze EV trends and publish insights powered by AI.
                  </p>
                </div>
              </div>
              <div className="self-end xl:hidden">
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#65a30d] bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-[#65a30d] hover:bg-lime-50 hover:text-lime-700"
                >
                  Start Over
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1200px] px-4 py-7 sm:px-6 lg:px-8">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-6">
              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/90 p-4 text-sm shadow-sm">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-lime-600" />
                  <div>
                    <p className="font-semibold text-slate-900">Error</p>
                    <p className="mt-1 text-slate-700">{error}</p>
                  </div>
                </div>
              )}

              <section
                id="step-ask-question"
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-lime-500 font-mono text-xs font-bold text-white">
                      1
                    </span>
                    <h2 className="text-sm font-semibold tracking-wide text-slate-900">
                      Ask a Question
                    </h2>
                  </div>
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Prompt
                  </span>
                </div>
                <div className="p-5">
                  <QueryInput
                    value={question}
                    onChange={setQuestion}
                    onSubmit={handleGenerateQuery}
                    isLoading={isGenerating}
                    suggestedQuestions={suggestedQuestions}
                  />
                </div>
              </section>

              {(table || queryString) && (
                <section
                  id="step-review-query"
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-lime-500 font-mono text-xs font-bold text-white">
                        2
                      </span>
                      <h2 className="text-sm font-semibold tracking-wide text-slate-900">
                        Review / Edit Query
                      </h2>
                    </div>
                    {table && (
                      <span className="rounded border border-lime-200 bg-lime-50 px-2 py-0.5 font-mono text-[11px] text-lime-700">
                        {table}
                      </span>
                    )}
                  </div>
                  <div className="p-5">
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
                </section>
              )}

              {results && (
                <section
                  id="step-results-chart"
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-lime-500 font-mono text-xs font-bold text-white">
                        3
                      </span>
                      <h2 className="text-sm font-semibold tracking-wide text-slate-900">
                        View Results & Chart
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="rounded border border-slate-200 bg-white px-2 py-1 font-mono">
                        {results.rowCount} rows
                      </span>
                      <span className="rounded border border-slate-200 bg-white px-2 py-1 font-mono">
                        {results.executionTimeMs}ms
                      </span>
                    </div>
                  </div>
                  <div className="space-y-5 p-5">
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
                </section>
              )}

              {results && results.data.length > 0 && (
                <section
                  id="compose-post"
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-lime-500 font-mono text-xs font-bold text-white">
                        4
                      </span>
                      <h2 className="text-sm font-semibold tracking-wide text-slate-900">
                        Compose & Post
                      </h2>
                    </div>
                  </div>
                  <div className="p-5">
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
                </section>
              )}

              {!table && !queryString && !loadingOptions && tables.length > 0 && (
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTablesExpanded((prev) => {
                        const next = !prev;
                        if (!next) setExpandedTableName(null);
                        return next;
                      });
                    }}
                    className="flex w-full items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3 text-left"
                  >
                    <h2 className="text-sm font-semibold tracking-wide text-slate-900">
                      Available Data Tables
                    </h2>
                    {isTablesExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    )}
                  </button>

                  {isTablesExpanded && (
                    <div className="space-y-3 p-5 pt-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {tables.map((t, tableIndex) => {
                          const isExpanded = expandedTableName === t.name;
                          return (
                            <div key={t.name} className="contents">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedTableName((prev) =>
                                    prev === t.name ? null : t.name
                                  )
                                }
                                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                                  isExpanded
                                    ? "border-lime-300 bg-lime-50/70"
                                    : "border-slate-200 bg-slate-50/80 hover:border-lime-300 hover:bg-lime-50/70"
                                }`}
                              >
                                <p className="font-mono text-sm font-medium text-lime-700">{t.name}</p>
                                <p className="mt-1 text-sm text-slate-500">{t.description}</p>
                              </button>

                              {isExpanded && expandedTable && (
                                <div className="rounded-xl border border-lime-300 bg-lime-50/70 p-4 md:hidden">
                                  <div className="space-y-3">
                                    <div>
                                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                        Columns
                                      </p>
                                      {expandedTableColumns.length > 0 ? (
                                        <div className="mt-2 grid grid-cols-1 gap-2">
                                          {expandedTableColumns.map((column) => (
                                            <div
                                              key={column.name}
                                              className="rounded-md border border-lime-200 bg-white px-3 py-2"
                                            >
                                              <p className="font-mono text-xs font-semibold text-lime-700">
                                                {column.name}
                                              </p>
                                              <p className="mt-1 text-xs text-slate-600">
                                                {column.description || "No description available."}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="mt-2 text-sm text-slate-500">
                                          No columns metadata available.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {expandedTable &&
                                desktopDetailsInsertionIndex >= 0 &&
                                tableIndex === desktopDetailsInsertionIndex && (
                                  <div className="hidden rounded-xl border border-lime-300 bg-lime-50/70 p-4 md:block md:col-span-2">
                                    <div className="space-y-3">
                                      <div>
                                        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                          Columns
                                        </p>
                                        {expandedTableColumns.length > 0 ? (
                                          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                                            {expandedTableColumns.map((column) => (
                                              <div
                                                key={column.name}
                                                className="rounded-md border border-lime-200 bg-white px-3 py-2"
                                              >
                                                <p className="font-mono text-xs font-semibold text-lime-700">
                                                  {column.name}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-600">
                                                  {column.description || "No description available."}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="mt-2 text-sm text-slate-500">
                                            No columns metadata available.
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>

            <aside className="hidden h-fit self-start xl:sticky xl:top-24 xl:block">
              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl border border-lime-300 bg-white shadow-sm">
                  <div className="border-b border-lime-200 bg-lime-100/35 px-4 py-3">
                    <p className="text-center font-mono text-[14px] font-semibold uppercase tracking-[0.14em] text-lime-700">
                      Workflow
                    </p>
                  </div>
                  <div className="relative px-4 py-4">
                    <div className="absolute left-8 top-5 h-[calc(100%-2.5rem)] w-px bg-lime-200" />
                    <ol className="space-y-5">
                      {workflowSteps.map((step) => {
                        const isComplete = currentStep > step.id;
                        const isCurrent = currentStep === step.id;
                        return (
                          <li key={step.id}>
                            <button
                              type="button"
                              onClick={() => scrollToStep(step.id)}
                              className="relative flex w-full items-start gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-lime-50/60"
                            >
                              <span
                                className={`relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                                  isComplete
                                    ? "border-lime-500 bg-lime-500 text-white"
                                    : isCurrent
                                      ? "border-lime-500 bg-lime-50 text-lime-600"
                                      : "border-slate-300 bg-white text-slate-300"
                                }`}
                              >
                                {isComplete ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
                              </span>
                              <div className="min-w-0">
                                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                  Step {step.id}
                                </p>
                                <p
                                  className={`mt-0.5 text-sm font-semibold ${
                                    isCurrent ? "text-lime-700" : isComplete ? "text-slate-900" : "text-slate-400"
                                  }`}
                                >
                                  {step.title}
                                </p>
                                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{step.detail}</p>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-4 shadow-sm">
                  <p className="text-center font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-lime-700">
                    Current Step
                  </p>
                  <p className="mt-1 text-[14px] font-semibold text-slate-900">
                    {workflowSteps[currentStep - 1]?.title}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{workflowSteps[currentStep - 1]?.detail}</p>
                </div>

              </div>
            </aside>
          </div>
        </main>
      </div>
      <style jsx global>{`
        .data-explorer-theme .font-mono {
          font-family: var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
        }
      `}</style>
    </div>
  );
}
