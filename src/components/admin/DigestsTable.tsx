"use client";

import { useState } from "react";
import { RefreshCw, Trash2, ExternalLink, ChevronLeft, ChevronRight, Calendar, FileText, Pencil, X } from "lucide-react";

interface Digest {
  id: string;
  scheduledFor: string;
  content: string;
  postIds: string[];
  topPostId: string;
  status: string;
  postedAt: string | null;
  tweetId: string | null;
  createdAt: string;
}

interface DigestsTableProps {
  digests: Digest[];
  onDelete: (id: string) => Promise<void>;
  onEdit: (id: string, content: string) => Promise<void>;
  onRefresh: () => void;
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    POSTED: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${styles[status] || "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function truncateContent(content: string, maxLength: number = 100): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + "...";
}

interface EditModalProps {
  digest: Digest;
  onClose: () => void;
  onSave: (id: string, content: string) => Promise<void>;
}

function EditModal({ digest, onClose, onSave }: EditModalProps) {
  const [content, setContent] = useState(digest.content);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    try {
      await onSave(digest.id, content);
      onClose();
    } catch (error) {
      console.error("Error saving digest:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Edit Digest</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4">
          <div className="mb-4">
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
              <span>Scheduled: {formatDateTime(digest.scheduledFor)}</span>
              <StatusBadge status={digest.status} />
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ev-green-500 focus:border-transparent resize-none text-sm"
            placeholder="Enter digest content..."
          />
          <div className="mt-2 text-xs text-gray-500 text-right">
            {content.length} characters
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !content.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-ev-green-500 rounded-lg hover:bg-ev-green-600 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DigestsTable({
  digests,
  onDelete,
  onEdit,
  onRefresh,
  isLoading,
  currentPage,
  totalPages,
  onPageChange,
}: DigestsTableProps) {
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [editingDigest, setEditingDigest] = useState<Digest | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this digest? A new one will be generated on the next cron run.")) {
      return;
    }

    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await onDelete(id);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const getTweetUrl = (tweetId: string | null): string | null => {
    if (!tweetId) return null;
    return `https://x.com/i/status/${tweetId}`;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Edit Modal */}
      {editingDigest && (
        <EditModal
          digest={editingDigest}
          onClose={() => setEditingDigest(null)}
          onSave={onEdit}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="font-semibold text-gray-900">Daily Digests</h2>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Table */}
      {isLoading && digests.length === 0 ? (
        <div className="px-4 py-12 text-center text-gray-500">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-gray-400" />
          <p>Loading digests...</p>
        </div>
      ) : digests.length === 0 ? (
        <div className="px-4 py-12 text-center text-gray-500">
          <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-400" />
          <p className="font-medium text-gray-900">No digests found</p>
          <p className="text-sm mt-1">Digests are generated automatically by the cron job.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scheduled For
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Content
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Posts
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {digests.map((digest) => {
                const tweetUrl = getTweetUrl(digest.tweetId);
                const isDeleting = deletingIds.has(digest.id);

                return (
                  <tr key={digest.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {formatDateTime(digest.scheduledFor)}
                      </div>
                      {digest.postedAt && (
                        <div className="text-xs text-gray-500 mt-1">
                          Posted: {formatDateTime(digest.postedAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={digest.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700 max-w-md" title={digest.content}>
                          {truncateContent(digest.content, 120)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                        {digest.postIds.length}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {tweetUrl && (
                          <a
                            href={tweetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            title="View tweet"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View
                          </a>
                        )}
                        <button
                          onClick={() => setEditingDigest(digest)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                          title="Edit digest"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(digest.id)}
                          disabled={isDeleting}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Delete digest"
                        >
                          {isDeleting ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
