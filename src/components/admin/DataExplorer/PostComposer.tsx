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
  const [success, setSuccess] = useState<string | null>(null);
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
      setSuccess(`Posted to X! Tweet ID: ${result.tweetId}`);
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
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">Compose Post</span>
        <button
          onClick={generateContent}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-ev-green-600 hover:text-ev-green-800 hover:bg-ev-green-50 rounded transition-colors disabled:opacity-50"
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
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
            <Check className="h-4 w-4 flex-shrink-0" />
            {success}
          </div>
        )}

        {/* Prompt Editor */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Wand2 className="h-4 w-4 text-gray-500" />
              Prompt (editable)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPrompt(defaultPrompt)}
                className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                title="Reset to default prompt"
              >
                Reset
              </button>
              <button
                onClick={copyPrompt}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
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
            className="w-full min-h-[12rem] max-h-[40vh] p-3 font-mono text-xs bg-white text-gray-900 focus:outline-none resize-y overflow-auto whitespace-pre break-normal"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ev-green-500 resize-none text-sm"
            rows={4}
          />
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>{characterCount} characters</span>
            <span className={isOverLimit ? "text-red-600 font-medium" : ""}>
              {isOverLimit
                ? `${characterCount - 280} over limit`
                : `${280 - characterCount} remaining`}
            </span>
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={attachChart}
              onChange={(e) => setAttachChart(e.target.checked)}
              disabled={!chartImageBase64}
              className="rounded border-gray-300 text-ev-green-500 focus:ring-ev-green-500"
            />
            Attach chart image
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={addHashtags}
              onChange={(e) => setAddHashtags(e.target.checked)}
              className="rounded border-gray-300 text-ev-green-500 focus:ring-ev-green-500"
            />
            Add hashtags
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={addFooter}
              onChange={(e) => setAddFooter(e.target.checked)}
              className="rounded border-gray-300 text-ev-green-500 focus:ring-ev-green-500"
            />
            Add footer
          </label>
        </div>

        {/* Post Button */}
        <div className="flex justify-end">
          <button
            onClick={handlePostToX}
            disabled={isPosting || !content.trim() || isOverLimit}
            className="flex items-center gap-2 px-4 py-2 bg-ev-green-500 text-white font-medium rounded-lg hover:bg-ev-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
