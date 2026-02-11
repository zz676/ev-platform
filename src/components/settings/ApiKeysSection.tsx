"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Key, Loader2, Plus, Trash2 } from "lucide-react";

type ApiKeyItem = {
  id: string;
  name: string | null;
  tier: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  last4: string;
  revokedAt: string | null;
  usage: {
    usedToday: number;
    limit: number | null;
    remaining: number | null;
    dayBucket: string;
  };
};

export function ApiKeysSection() {
  const t = useTranslations("Settings");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);

  const [createName, setCreateName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadKeys = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/api-keys", { method: "GET" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to load API keys");
      }
      const data = await res.json();
      setKeys(Array.isArray(data?.keys) ? data.keys : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);
    setNewKey(null);
    setCopied(false);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create API key");
      }

      setNewKey(typeof data?.plaintextKey === "string" ? data.plaintextKey : null);
      setCreateName("");
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm(t("apiKeyConfirmRevoke"))) return;
    setError(null);
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to revoke API key");
      }
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key");
    }
  };

  const handleCopy = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const usageLabel = useCallback((k: ApiKeyItem) => {
    if (k.usage.limit === null) return t("apiKeyUnlimited");
    return `${k.usage.usedToday}/${k.usage.limit}`;
  }, [t]);

  const sortedKeys = useMemo(() => {
    return [...keys].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [keys]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Key className="h-4 w-4 text-ev-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">{t("apiAccessTitle")}</h2>
          </div>
          <p className="text-sm text-gray-500">{t("apiAccessDesc")}</p>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Create */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          placeholder={t("apiKeyNamePlaceholder")}
          className="w-full sm:max-w-xs px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ev-green-500"
        />
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-ev-green-600 rounded-lg hover:bg-ev-green-700 transition-colors disabled:opacity-50"
        >
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t("apiKeyCreate")}
        </button>
      </div>

      {/* One-time key display */}
      {newKey && (
        <div className="mt-4 p-4 bg-ev-green-50 border border-ev-green-200 rounded-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ev-green-900">{t("apiKeyCreatedTitle")}</p>
              <p className="text-xs text-ev-green-800 mt-1">{t("apiKeyOneTimeNote")}</p>
            </div>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-ev-green-800 border border-ev-green-200 rounded-lg hover:bg-ev-green-100 transition-colors"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
          <pre className="mt-3 text-xs bg-white border border-ev-green-200 rounded-lg p-3 overflow-auto">
            {newKey}
          </pre>
        </div>
      )}

      {/* List */}
      <div className="mt-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("loading")}
          </div>
        ) : sortedKeys.length === 0 ? (
          <p className="text-sm text-gray-500">{t("apiKeyEmpty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4 font-medium">{t("apiKeyName")}</th>
                  <th className="py-2 pr-4 font-medium">{t("apiKeyTier")}</th>
                  <th className="py-2 pr-4 font-medium">{t("apiKeyLast4")}</th>
                  <th className="py-2 pr-4 font-medium">{t("apiKeyUsageToday")}</th>
                  <th className="py-2 pr-4 font-medium">{t("apiKeyStatus")}</th>
                  <th className="py-2 pr-4 font-medium">{t("apiKeyCreated")}</th>
                  <th className="py-2 pr-4 font-medium">{t("apiKeyLastUsed")}</th>
                  <th className="py-2 pr-0 font-medium">{t("apiKeyActions")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedKeys.map((k) => (
                  <tr key={k.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 text-gray-900">
                      {k.name || <span className="text-gray-500">{t("apiKeyUnnamed")}</span>}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">{k.tier}</td>
                    <td className="py-2 pr-4 text-gray-700">••••{k.last4}</td>
                    <td className="py-2 pr-4 text-gray-700">{usageLabel(k)}</td>
                    <td className="py-2 pr-4">
                      {k.isActive ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                          {t("apiKeyActive")}
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                          {t("apiKeyRevoked")}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {new Date(k.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "-"}
                    </td>
                    <td className="py-2 pr-0">
                      <button
                        onClick={() => handleRevoke(k.id)}
                        disabled={!k.isActive}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("apiKeyRevoke")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
