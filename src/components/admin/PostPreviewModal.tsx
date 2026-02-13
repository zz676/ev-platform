"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2, Upload, Image as ImageIcon, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Platform = "x" | "discord";

interface PreviewData {
  x: {
    text: string;
    characterCount: number;
  };
  discord: {
    title: string;
    description: string;
    color: number;
    category: string;
  };
  imageUrl: string | null;
  availableImages: string[];
  postDetails: {
    source: string;
    sourceUrl: string;
    publishedToX: boolean;
    publishedToDiscord: boolean;
  };
}

interface PostPreviewModalProps {
  postId: string;
  platform: Platform;
  onClose: () => void;
  onSuccess: (platform: Platform) => void;
}

const X_CHAR_LIMIT = 280;

export function PostPreviewModal({
  postId,
  platform: initialPlatform,
  onClose,
  onSuccess,
}: PostPreviewModalProps) {
  const [platform, setPlatform] = useState<Platform>(initialPlatform);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable content
  const [xText, setXText] = useState("");
  const [discordTitle, setDiscordTitle] = useState("");
  const [discordDescription, setDiscordDescription] = useState("");
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch preview data
  useEffect(() => {
    const fetchPreview = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/posts/${postId}/preview`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to load preview");
        }
        const data: PreviewData = await response.json();
        setPreviewData(data);
        setXText(data.x.text);
        setDiscordTitle(data.discord.title);
        setDiscordDescription(data.discord.description);
        setSelectedImageUrl(data.imageUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load preview");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreview();
  }, [postId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload image");
      }

      const data = await response.json();
      setSelectedImageUrl(data.url);

      // Add to available images if not already present
      if (previewData && !previewData.availableImages.includes(data.url)) {
        setPreviewData({
          ...previewData,
          availableImages: [data.url, ...previewData.availableImages],
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handlePost = async () => {
    setIsPosting(true);
    setError(null);

    try {
      const endpoint =
        platform === "x"
          ? `/api/admin/posts/${postId}/post-to-x`
          : `/api/admin/posts/${postId}/post-to-discord`;

      const body =
        platform === "x"
          ? { text: xText, imageUrl: selectedImageUrl }
          : {
              title: discordTitle,
              description: discordDescription,
              imageUrl: selectedImageUrl,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to post to ${platform === "x" ? "X" : "Discord"}`);
      }

      onSuccess(platform);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setIsPosting(false);
    }
  };

  const xCharCount = xText.length;
  const isOverLimit = xCharCount > X_CHAR_LIMIT;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Preview & Post
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Platform Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setPlatform("x")}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors",
              platform === "x"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700 hover:bg-white"
            )}
          >
            X (Twitter)
          </button>
          <button
            onClick={() => setPlatform("discord")}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors",
              platform === "discord"
                ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50"
                : "text-gray-500 hover:text-gray-700 hover:bg-white"
            )}
          >
            Discord
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : error && !previewData ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
              <p className="text-red-600">{error}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Error Alert */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* X Content */}
              {platform === "x" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      Tweet Content
                    </label>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isOverLimit ? "text-red-600" : xCharCount > X_CHAR_LIMIT - 20 ? "text-yellow-600" : "text-gray-500"
                      )}
                    >
                      {xCharCount}/{X_CHAR_LIMIT}
                    </span>
                  </div>
                  <textarea
                    value={xText}
                    onChange={(e) => setXText(e.target.value)}
                    rows={8}
                    className={cn(
                      "w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-none",
                      isOverLimit
                        ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                        : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                    )}
                  />
                  {isOverLimit && (
                    <p className="text-sm text-red-600">
                      Tweet exceeds character limit by {xCharCount - X_CHAR_LIMIT} characters
                    </p>
                  )}
                </div>
              )}

              {/* Discord Content */}
              {platform === "discord" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Title
                    </label>
                    <input
                      type="text"
                      value={discordTitle}
                      onChange={(e) => setDiscordTitle(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      value={discordDescription}
                      onChange={(e) => setDiscordDescription(e.target.value)}
                      rows={5}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Image Section */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">
                  Image
                </label>
                <div className="flex gap-3">
                  {/* Image Preview */}
                  <div className="flex-shrink-0 w-32 h-32 bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
                    {selectedImageUrl ? (
                      <img
                        src={selectedImageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                  </div>

                  {/* Image Selection */}
                  <div className="flex-1 space-y-2">
                    {/* Upload Button */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Upload New
                    </button>

                    {/* Existing Images */}
                    {previewData && previewData.availableImages.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">
                          Or select from existing:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {previewData.availableImages.map((url, index) => (
                            <button
                              key={index}
                              onClick={() => setSelectedImageUrl(url)}
                              className={cn(
                                "w-12 h-12 rounded border-2 overflow-hidden transition-colors",
                                selectedImageUrl === url
                                  ? "border-blue-500"
                                  : "border-gray-200 hover:border-gray-300"
                              )}
                            >
                              <img
                                src={url}
                                alt={`Option ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                          <button
                            onClick={() => setSelectedImageUrl(null)}
                            className={cn(
                              "w-12 h-12 rounded border-2 overflow-hidden transition-colors flex items-center justify-center bg-white",
                              selectedImageUrl === null
                                ? "border-blue-500"
                                : "border-gray-200 hover:border-gray-300"
                            )}
                          >
                            <X className="h-4 w-4 text-gray-400" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-white">
          <button
            onClick={onClose}
            disabled={isPosting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePost}
            disabled={isLoading || isPosting || (platform === "x" && isOverLimit)}
            className={cn(
              "px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50",
              platform === "x"
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-indigo-500 hover:bg-indigo-600"
            )}
          >
            {isPosting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Posting...
              </span>
            ) : (
              `Post to ${platform === "x" ? "X" : "Discord"}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
