"use client";

import { useEffect, useMemo, useState } from "react";
import { Send, RefreshCw, Sparkles, Check, AlertCircle, Wand2, Copy } from "lucide-react";
import { DATA_EXPLORER_POST_PROMPT } from "@/lib/config/prompts";
import { prismaFindManyToSql } from "@/lib/data-explorer/sql-preview";

interface PostComposerProps {
  chartImageBase64: string | null;
  question: string;
  table: string;
  prismaQuery: string;
  results: Record<string, unknown>[];
  chartTitle: string;
  chartType: string;
  onPostSuccess?: () => void;
}

function summarizeResults(data: Record<string, unknown>[]): string {
  if (!data.length) return "No rows returned.";

  const cols = Object.keys(data[0]).slice(0, 12);
  const previewRows = data.slice(0, 8).map((row) => {
    const parts = cols.map((c) => `${c}=${String(row[c])}`);
    return `- ${parts.join(", ")}`;
  });

  return [
    `Row count: ${data.length}`,
    `Columns: ${cols.join(", ")}`,
    "Sample rows:",
    ...previewRows,
  ].join("\n");
}

export function PostComposer({
  chartImageBase64,
  question,
  table,
  prismaQuery,
  results,
  chartTitle,
  chartType,
  onPostSuccess,
}: PostComposerProps) {
  const [content, setContent] = useState("");
  const [attachChart, setAttachChart] = useState(true);
  const [addHashtags, setAddHashtags] = useState(true);
  const [addFooter, setAddFooter] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [success, setSuccess] = useState<{ message: string; tweetUrl?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");

  const sqlPreview = useMemo(() => {
    try {
      const parsed = JSON.parse(prismaQuery) as Record<string, unknown>;
      return prismaFindManyToSql({ table, query: parsed });
    } catch {
      return "";
    }
  }, [prismaQuery, table]);

  const defaultPrompt = useMemo(() => {
    const dataSummary = [
      `Question: ${question || "(none)"}`,
      `Table: ${table}`,
      "",
      summarizeResults(results),
      "",
      sqlPreview ? `SQL:\n${sqlPreview}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const chartDescription = `Title: ${chartTitle}\nType: ${chartType}\nImage attached: ${chartImageBase64 ? "yes" : "no"}`;

    return DATA_EXPLORER_POST_PROMPT.replace("{data_summary}", dataSummary).replace(
      "{chart_description}",
      chartDescription
    );
  }, [question, table, results, sqlPreview, chartTitle, chartType, chartImageBase64]);

  useEffect(() => {
    setPrompt(defaultPrompt);
  }, [defaultPrompt]);

  async function generateContent() {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/data-explorer/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate content");
      }

      const data = await res.json();
      setContent(String(data.content || "").trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate content");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      setError("Failed to copy prompt to clipboard (browser blocked clipboard access).");
    }
  }

  async function handlePostToX() {
    if (!content.trim()) return;

    setIsPosting(true);
    setError(null);
    setSuccess(null);

    try {
      if (!chartImageBase64 || !attachChart) {
        throw new Error("Generate a chart image before posting to X.");
      }
      const now = new Date();
      const basePeriod = now.getMonth() + 1;
      const maxPeriod = 2147483647;
      const buildUniquePeriod = (attempt: number) => {
        const epochSeconds = Math.floor(Date.now() / 1000);
        const jitter = Math.floor(Math.random() * 30);
        return Math.min(maxPeriod, epochSeconds + attempt + jitter);
      };

      // Build final content
      let finalContent = content;

      if (addHashtags) {
        finalContent += "\n\n#ChinaEV #EVNews";
      }

      if (addFooter) {
        finalContent += "\n\n🍋 evjuice.net";
      }

      // Save as metric post and post to X (use unique period to avoid conflicts)
      let post: { id: string } | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const saveRes = await fetch("/api/admin/metric-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postType: "ALL_BRANDS_COMPARISON",
            year: now.getFullYear(),
            period: buildUniquePeriod(attempt),
            content: finalContent,
            dataSnapshot: {
              source: "data-explorer",
              basePeriod,
              createdAt: now.toISOString(),
            },
          }),
        });

        if (saveRes.ok) {
          const saved = await saveRes.json();
          post = saved.post;
          break;
        }

        if (saveRes.status !== 409) {
          const errData = await saveRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to save post");
        }
      }

      if (!post) {
        throw new Error("Failed to save post (conflict). Try again.");
      }

      // Post to X
      const postRes = await fetch(`/api/admin/metric-posts/${post.id}/post-to-x`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: finalContent,
          chartImageBase64: attachChart ? chartImageBase64 : undefined,
        }),
      });

      if (!postRes.ok) {
        const errData = await postRes.json();
        throw new Error(errData.error || "Failed to post to X");
      }

      const result = await postRes.json();
      const tweetUrl =
        result.tweetUrl ||
        (result.tweetId ? `https://x.com/i/status/${result.tweetId}` : undefined);
      setSuccess({
        message: "Posted to X successfully.",
        tweetUrl,
      });
      setContent("");
      onPostSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setIsPosting(false);
    }
  }

  const characterCount = content.length + (addHashtags ? 20 : 0) + (addFooter ? 20 : 0);
  const isOverLimit = characterCount > 280;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Header */}
<<<<<<< Updated upstream
      <div className="flex items-center justify-between border-b border-slate-200 bg-lime-100/35 px-4 py-2.5">
        <span className="text-sm font-semibold text-slate-700">Compose Post</span>
=======
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">Compose Post</span>
>>>>>>> Stashed changes
        <button
          onClick={generateContent}
          disabled={isGenerating}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-lime-600 transition-colors hover:bg-lime-100/50 hover:text-lime-700 disabled:opacity-50"
        >
          {isGenerating ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Generate with AI
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Error/Success Messages */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-lime-300 bg-lime-100/70 p-3 text-sm text-lime-700">
            <Check className="h-4 w-4 flex-shrink-0" />
            <span>{success.message}</span>
            {success.tweetUrl && (
              <a
                href={success.tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-lime-700 hover:text-lime-800 underline underline-offset-2"
              >
                View Tweet
              </a>
            )}
          </div>
        )}

        {/* Prompt Editor */}
<<<<<<< Updated upstream
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 bg-lime-100/35 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Wand2 className="h-4 w-4 text-slate-500" />
=======
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Wand2 className="h-4 w-4 text-gray-500" />
>>>>>>> Stashed changes
              Prompt (editable)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPrompt(defaultPrompt)}
                className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                title="Reset to default prompt"
              >
                Reset
              </button>
              <button
                onClick={copyPrompt}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                title="Copy prompt"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
            </div>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="max-h-[40vh] min-h-[12rem] w-full resize-y overflow-auto whitespace-pre break-normal bg-white p-3 font-mono text-sm text-slate-900 focus:outline-none"
            spellCheck={false}
            wrap="off"
          />
        </div>

        {/* Content Editor */}
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your post content..."
            className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-500"
            rows={4}
          />
          <div className="mt-2 flex justify-between font-mono text-xs text-slate-500">
            <span>{characterCount} characters</span>
            <span className={isOverLimit ? "font-medium text-slate-700" : ""}>
              {isOverLimit
                ? `${characterCount - 280} over limit`
                : `${280 - characterCount} remaining`}
            </span>
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2 font-mono text-sm text-slate-700">
            <input
              type="checkbox"
              checked={attachChart}
              onChange={(e) => setAttachChart(e.target.checked)}
              disabled={!chartImageBase64}
              className="rounded border-slate-300 text-lime-500 focus:ring-lime-500"
            />
            Attach chart image
          </label>
          <label className="flex cursor-pointer items-center gap-2 font-mono text-sm text-slate-700">
            <input
              type="checkbox"
              checked={addHashtags}
              onChange={(e) => setAddHashtags(e.target.checked)}
              className="rounded border-slate-300 text-lime-500 focus:ring-lime-500"
            />
            Add hashtags
          </label>
          <label className="flex cursor-pointer items-center gap-2 font-mono text-sm text-slate-700">
            <input
              type="checkbox"
              checked={addFooter}
              onChange={(e) => setAddFooter(e.target.checked)}
              className="rounded border-slate-300 text-lime-500 focus:ring-lime-500"
            />
            Add footer
          </label>
        </div>

        {/* Post Button */}
        <div className="flex justify-end">
          <button
            onClick={handlePostToX}
            disabled={isPosting || !content.trim() || isOverLimit}
            className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 font-semibold text-white shadow-sm transition-colors hover:bg-lime-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPosting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Post to X
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
