"use client";

import { useState, useEffect } from "react";
import {
  RefreshCw,
  Send,
  BarChart3,
  AlertCircle,
  Check,
  Image as ImageIcon,
} from "lucide-react";
import { Brand } from "@prisma/client";

// Brand display names
const BRAND_DISPLAY_NAMES: Record<string, string> = {
  BYD: "BYD",
  NIO: "NIO",
  XPENG: "XPeng",
  LI_AUTO: "Li Auto",
  ZEEKR: "Zeekr",
  XIAOMI: "Xiaomi",
  TESLA_CHINA: "Tesla China",
  LEAPMOTOR: "Leapmotor",
  GEELY: "Geely",
  OTHER_BRAND: "Other",
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type PostType = "BRAND_TREND" | "ALL_BRANDS_COMPARISON";

interface GenerateOptions {
  years: number[];
  brands: Brand[];
  months: number[];
  currentYear: number;
}

interface GenerateResponse {
  content: string;
  data: unknown;
  characterCount: number;
  chartImageBase64: string;
  warnings: string[];
}

interface MetricPostGeneratorProps {
  onPostSaved?: () => void;
}

export function MetricPostGenerator({ onPostSaved }: MetricPostGeneratorProps) {
  // Form state
  const [postType, setPostType] = useState<PostType>("ALL_BRANDS_COMPARISON");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() || 12);
  const [brand, setBrand] = useState<Brand>("BYD");

  // Options
  const [options, setOptions] = useState<GenerateOptions | null>(null);

  // Preview state
  const [preview, setPreview] = useState<GenerateResponse | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");

  // Loading states
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Error/success states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch available options
  useEffect(() => {
    fetchOptions();
  }, []);

  // Fetch options for a specific year when year changes
  useEffect(() => {
    if (year && options) {
      fetchOptions(year);
    }
  }, [year]);

  async function fetchOptions(targetYear?: number) {
    setLoadingOptions(true);
    try {
      const params = new URLSearchParams();
      if (targetYear) params.append("year", targetYear.toString());

      const res = await fetch(`/api/admin/metric-posts/generate?${params}`);
      if (!res.ok) throw new Error("Failed to fetch options");

      const data = await res.json();
      setOptions(data);

      // Set defaults if this is the first load
      if (!targetYear && data.years.length > 0) {
        setYear(data.currentYear || data.years[0]);
      }
      if (data.months.length > 0 && !targetYear) {
        setMonth(data.months[data.months.length - 1]); // Latest month
      }
      if (data.brands.length > 0 && !targetYear) {
        setBrand(data.brands[0]);
      }
    } catch (err) {
      setError("Failed to load options");
      console.error(err);
    } finally {
      setLoadingOptions(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setSuccess(null);
    setPreview(null);

    try {
      const body: Record<string, unknown> = { postType, year };

      if (postType === "ALL_BRANDS_COMPARISON") {
        body.month = month;
      } else {
        body.brand = brand;
      }

      const res = await fetch("/api/admin/metric-posts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate preview");
      }

      const data: GenerateResponse = await res.json();
      setPreview(data);
      setEditedContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!preview) return;

    setSaving(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        postType,
        year,
        content: editedContent,
        chartImageUrl: null, // Will be set when posting
        dataSnapshot: preview.data,
      };

      if (postType === "ALL_BRANDS_COMPARISON") {
        body.period = month;
      } else {
        body.brand = brand;
      }

      const res = await fetch("/api/admin/metric-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save");
      }

      setSuccess("Post saved as draft");
      onPostSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handlePostToX() {
    if (!preview) return;

    setPosting(true);
    setError(null);
    setSuccess(null);

    try {
      // First save the post
      const saveBody: Record<string, unknown> = {
        postType,
        year,
        content: editedContent,
        dataSnapshot: preview.data,
      };

      if (postType === "ALL_BRANDS_COMPARISON") {
        saveBody.period = month;
      } else {
        saveBody.brand = brand;
      }

      const saveRes = await fetch("/api/admin/metric-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saveBody),
      });

      if (!saveRes.ok) {
        const errData = await saveRes.json();
        throw new Error(errData.error || "Failed to save post");
      }

      const { post } = await saveRes.json();

      // Then post to X with the chart
      const postRes = await fetch(`/api/admin/metric-posts/${post.id}/post-to-x`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: editedContent,
          chartImageBase64: preview.chartImageBase64,
        }),
      });

      if (!postRes.ok) {
        const errData = await postRes.json();
        throw new Error(errData.error || "Failed to post to X");
      }

      const result = await postRes.json();
      setSuccess(`Posted to X successfully! Tweet ID: ${result.tweetId}`);
      setPreview(null);
      setEditedContent("");
      onPostSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Post failed");
    } finally {
      setPosting(false);
    }
  }

  const isFormValid =
    postType === "ALL_BRANDS_COMPARISON"
      ? year && month
      : year && brand;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-ev-green-600" />
          <h3 className="font-semibold text-gray-900">Generate Metric Post</h3>
        </div>
      </div>

      <div className="p-4">
        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
            <Check className="h-4 w-4 flex-shrink-0" />
            {success}
          </div>
        )}

        {/* Form */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Post Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Post Type
            </label>
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value as PostType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ev-green-500 text-sm"
            >
              <option value="ALL_BRANDS_COMPARISON">All Brands (Monthly)</option>
              <option value="BRAND_TREND">Brand Trend (Yearly)</option>
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              disabled={loadingOptions}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ev-green-500 text-sm disabled:bg-gray-100"
            >
              {options?.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Month (for ALL_BRANDS_COMPARISON) */}
          {postType === "ALL_BRANDS_COMPARISON" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Month
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                disabled={loadingOptions}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ev-green-500 text-sm disabled:bg-gray-100"
              >
                {options?.months.map((m) => (
                  <option key={m} value={m}>
                    {MONTH_NAMES[m - 1]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Brand (for BRAND_TREND) */}
          {postType === "BRAND_TREND" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand
              </label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value as Brand)}
                disabled={loadingOptions}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ev-green-500 text-sm disabled:bg-gray-100"
              >
                {options?.brands.map((b) => (
                  <option key={b} value={b}>
                    {BRAND_DISPLAY_NAMES[b] || b}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Generate Button */}
          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              disabled={generating || !isFormValid || loadingOptions}
              className="w-full px-4 py-2 bg-ev-green-500 text-white font-medium rounded-lg hover:bg-ev-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4" />
                  Generate Preview
                </>
              )}
            </button>
          </div>
        </div>

        {/* Warnings */}
        {preview?.warnings && preview.warnings.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
            <div className="font-medium mb-1">Warnings:</div>
            <ul className="list-disc list-inside">
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700">Preview</span>
            </div>

            <div className="p-4 space-y-4">
              {/* Chart Preview */}
              {preview.chartImageBase64 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700">
                    <ImageIcon className="h-4 w-4" />
                    Chart Preview
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview.chartImageBase64}
                      alt="Chart preview"
                      className="w-full max-w-2xl mx-auto"
                    />
                  </div>
                </div>
              )}

              {/* Tweet Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tweet Content
                </label>
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ev-green-500 text-sm font-mono resize-none"
                />
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>{editedContent.length} characters</span>
                  <span
                    className={
                      editedContent.length > 280 ? "text-red-600" : ""
                    }
                  >
                    {editedContent.length > 280
                      ? `${editedContent.length - 280} over limit`
                      : `${280 - editedContent.length} remaining`}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleSave}
                  disabled={saving || !editedContent.trim()}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save as Draft"
                  )}
                </button>
                <button
                  onClick={handlePostToX}
                  disabled={posting || !editedContent.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-ev-green-500 rounded-lg hover:bg-ev-green-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {posting ? (
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
        )}
      </div>
    </div>
  );
}
