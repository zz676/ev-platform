"use client";

import { useState } from "react";
import {
  X,
  Upload,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

const BRANDS = [
  { value: "INDUSTRY", label: "Industry" },
  { value: "BYD", label: "BYD" },
  { value: "NIO", label: "NIO" },
  { value: "XPENG", label: "XPeng" },
  { value: "LI_AUTO", label: "Li Auto" },
  { value: "ZEEKR", label: "Zeekr" },
  { value: "XIAOMI", label: "Xiaomi" },
  { value: "TESLA_CHINA", label: "Tesla China" },
  { value: "OTHER_BRAND", label: "Other" },
];

const TOPICS = [
  "DELIVERY",
  "EARNINGS",
  "LAUNCH",
  "TECHNOLOGY",
  "CHARGING",
  "POLICY",
  "EXPANSION",
  "RECALL",
  "PARTNERSHIP",
  "EXECUTIVE",
  "OTHER",
];

const CATEGORIES = [
  "BYD",
  "NIO",
  "XPeng",
  "Li Auto",
  "Zeekr",
  "Xiaomi",
  "Tesla",
  "Sales",
  "Technology",
  "Policy",
  "Charging",
  "Market",
];

interface CreatePostFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreatePostForm({ onClose, onSuccess }: CreatePostFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    summary: "",
    sourceUrl: "",
    sourceAuthor: "EVJuicy",
    sourceDate: new Date().toISOString().split("T")[0],
    brand: "INDUSTRY",
    topics: [] as string[],
    categories: [] as string[],
    relevanceScore: 50,
    status: "APPROVED" as "APPROVED" | "PUBLISHED",
    imageUrls: [] as string[],
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formDataUpload,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setFormData((prev) => ({
        ...prev,
        imageUrls: [...prev.imageUrls, data.url],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index),
    }));
  };

  const toggleCategory = (category: string) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  };

  const toggleTopic = (topic: string) => {
    setFormData((prev) => ({
      ...prev,
      topics: prev.topics.includes(topic)
        ? prev.topics.filter((t) => t !== topic)
        : [...prev.topics, topic],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!formData.title.trim()) {
        throw new Error("Title is required");
      }
      if (!formData.content.trim()) {
        throw new Error("Content is required");
      }

      const response = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create post");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRelevanceBadge = () => {
    if (formData.relevanceScore >= 70) {
      return { text: "Featured", color: "bg-green-100 text-green-700" };
    }
    if (formData.relevanceScore >= 40) {
      return { text: "Normal", color: "bg-yellow-100 text-yellow-700" };
    }
    return { text: "Low Priority", color: "bg-gray-100 text-gray-700" };
  };

  const badge = getRelevanceBadge();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Create New Post
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ev-green-500 focus:border-transparent"
              placeholder="Enter post title"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.content}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, content: e.target.value }))
              }
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ev-green-500 focus:border-transparent resize-none"
              placeholder="Enter post content"
            />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Summary{" "}
              <span className="text-gray-400 text-xs">(max 250 chars)</span>
            </label>
            <textarea
              value={formData.summary}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  summary: e.target.value.slice(0, 250),
                }))
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ev-green-500 focus:border-transparent resize-none"
              placeholder="Short summary for cards and social media"
            />
            <p className="mt-1 text-xs text-gray-400 text-right">
              {formData.summary.length}/250
            </p>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Images
            </label>
            <div className="space-y-3">
              {/* Uploaded images preview */}
              {formData.imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {formData.imageUrls.map((url, index) => (
                    <div
                      key={index}
                      className="relative group w-24 h-24 rounded-lg overflow-hidden border border-gray-200"
                    >
                      <img
                        src={url}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      >
                        <Trash2 className="h-5 w-5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button */}
              <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-ev-green-400 hover:bg-ev-green-50 transition-colors">
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                ) : (
                  <Upload className="h-5 w-5 text-gray-400" />
                )}
                <span className="text-sm text-gray-600">
                  {isUploading ? "Uploading..." : "Upload image"}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-400">
                Supported: JPG, PNG, WebP. Max size: 5MB
              </p>
            </div>
          </div>

          {/* Two column layout */}
          <div className="grid grid-cols-2 gap-4">
            {/* Source URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source URL
              </label>
              <input
                type="url"
                value={formData.sourceUrl}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, sourceUrl: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ev-green-500 focus:border-transparent"
                placeholder="https://..."
              />
            </div>

            {/* Author */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Author
              </label>
              <input
                type="text"
                value={formData.sourceAuthor}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    sourceAuthor: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ev-green-500 focus:border-transparent"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={formData.sourceDate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, sourceDate: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ev-green-500 focus:border-transparent"
              />
            </div>

            {/* Brand */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand
              </label>
              <select
                value={formData.brand}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, brand: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ev-green-500 focus:border-transparent"
              >
                {BRANDS.map((brand) => (
                  <option key={brand.value} value={brand.value}>
                    {brand.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Topics */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Topics
            </label>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => toggleTopic(topic)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    formData.topics.includes(topic)
                      ? "bg-ev-green-100 border-ev-green-500 text-ev-green-700"
                      : "bg-white border-gray-300 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {topic.charAt(0) + topic.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    formData.categories.includes(category)
                      ? "bg-ev-green-100 border-ev-green-500 text-ev-green-700"
                      : "bg-white border-gray-300 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Relevance Score */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Relevance Score
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {formData.relevanceScore}
                </span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${badge.color}`}>
                  {badge.text}
                </span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.relevanceScore}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  relevanceScore: parseInt(e.target.value),
                }))
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-ev-green-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0 - Low</span>
              <span>70+ Featured</span>
              <span>100 - Highest</span>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="APPROVED"
                  checked={formData.status === "APPROVED"}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: e.target.value as "APPROVED" | "PUBLISHED",
                    }))
                  }
                  className="w-4 h-4 text-ev-green-500 focus:ring-ev-green-500"
                />
                <span className="text-sm text-gray-700">Approved</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="PUBLISHED"
                  checked={formData.status === "PUBLISHED"}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: e.target.value as "APPROVED" | "PUBLISHED",
                    }))
                  }
                  className="w-4 h-4 text-ev-green-500 focus:ring-ev-green-500"
                />
                <span className="text-sm text-gray-700">Published</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-ev-green-500 rounded-lg hover:bg-ev-green-600 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Post
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
