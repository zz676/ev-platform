"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { User, Shield, Link2, Unlink } from "lucide-react";

interface SettingsContentProps {
  user: {
    name: string;
    email: string;
    avatarUrl?: string;
    role: string;
  };
  providers: string[];
  isAdmin: boolean;
  xAccount: {
    username: string;
    displayName?: string;
    avatarUrl?: string;
  } | null;
}

export function SettingsContent({ user, providers, isAdmin, xAccount }: SettingsContentProps) {
  const t = useTranslations("Settings");
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnectX = async () => {
    try {
      const res = await fetch("/api/auth/x/link", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to initiate X connection");
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  };

  const handleDisconnectX = async () => {
    setIsUnlinking(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/x/unlink", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect");
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setIsUnlinking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("profile")}</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-ev-green-100 flex items-center justify-center overflow-hidden">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.name} className="w-16 h-16 rounded-full" />
            ) : (
              <User className="h-8 w-8 text-ev-green-700" />
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
            {user.role === "ADMIN" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-ev-green-700 mt-1">
                <Shield className="h-3 w-3" />
                Admin
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Connected Accounts Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{t("connectedAccounts")}</h2>
        <p className="text-sm text-gray-500 mb-4">{t("loginProvidersDesc")}</p>
        <div className="space-y-3">
          {/* Google */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="text-sm font-medium text-gray-900">Google</span>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${providers.includes("google") ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {providers.includes("google") ? t("connected") : t("notConnected")}
            </span>
          </div>

          {/* X / Twitter */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span className="text-sm font-medium text-gray-900">X</span>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${providers.includes("twitter") ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {providers.includes("twitter") ? t("connected") : t("notConnected")}
            </span>
          </div>
        </div>
      </div>

      {/* X Publishing Account (Admin Only) */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{t("xPublishing")}</h2>
          <p className="text-sm text-gray-500 mb-4">{t("xPublishingDesc")}</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {xAccount ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {xAccount.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={xAccount.avatarUrl} alt={xAccount.username} className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </div>
                )}
                <div>
                  <p className="font-medium text-sm text-gray-900">{xAccount.displayName || xAccount.username}</p>
                  <p className="text-xs text-gray-500">@{xAccount.username}</p>
                </div>
                <span className="ml-2 text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                  {t("connected")}
                </span>
              </div>
              <button
                onClick={handleDisconnectX}
                disabled={isUnlinking}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Unlink className="h-4 w-4" />
                {t("disconnectXAccount")}
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectX}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Link2 className="h-4 w-4" />
              {t("connectXAccount")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
