"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { User, Shield, Link2, Unlink, Bell, Globe, Newspaper, Save, Check, Loader2 } from "lucide-react";

const ALL_BRANDS = [
  { value: "BYD", label: "BYD" },
  { value: "NIO", label: "NIO" },
  { value: "XPENG", label: "XPeng" },
  { value: "LI_AUTO", label: "Li Auto" },
  { value: "ZEEKR", label: "Zeekr" },
  { value: "XIAOMI", label: "Xiaomi" },
  { value: "TESLA_CHINA", label: "Tesla China" },
  { value: "LEAPMOTOR", label: "Leapmotor" },
  { value: "GEELY", label: "Geely" },
] as const;

const ALL_TOPICS = [
  { value: "DELIVERY", labelKey: "topicDelivery" },
  { value: "EARNINGS", labelKey: "topicEarnings" },
  { value: "LAUNCH", labelKey: "topicLaunch" },
  { value: "TECHNOLOGY", labelKey: "topicTechnology" },
  { value: "CHARGING", labelKey: "topicCharging" },
  { value: "POLICY", labelKey: "topicPolicy" },
  { value: "EXPANSION", labelKey: "topicExpansion" },
  { value: "RECALL", labelKey: "topicRecall" },
  { value: "PARTNERSHIP", labelKey: "topicPartnership" },
] as const;

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
  preferences: {
    brands: string[];
    topics: string[];
    digestFrequency: string;
    language: string;
    alertsEnabled: boolean;
    alertThreshold: number;
  } | null;
}

export function SettingsContent({ user, providers, isAdmin, xAccount, preferences }: SettingsContentProps) {
  const t = useTranslations("Settings");
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preference state
  const [selectedBrands, setSelectedBrands] = useState<string[]>(preferences?.brands ?? []);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(preferences?.topics ?? []);
  const [digestFrequency, setDigestFrequency] = useState(preferences?.digestFrequency ?? "DAILY");
  const [language, setLanguage] = useState(preferences?.language ?? "EN");
  const [alertsEnabled, setAlertsEnabled] = useState(preferences?.alertsEnabled ?? true);
  const [alertThreshold, setAlertThreshold] = useState(preferences?.alertThreshold ?? 80);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

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

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
    setSaveStatus("idle");
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
    setSaveStatus("idle");
  };

  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brands: selectedBrands,
          topics: selectedTopics,
          digestFrequency,
          language,
          alertsEnabled,
          alertThreshold,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to save");
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
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
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${providers.includes("x") ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {providers.includes("x") ? t("connected") : t("notConnected")}
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

      {/* News Preferences Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Newspaper className="h-4 w-4 text-ev-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t("newsPreferences")}</h2>
        </div>
        <p className="text-sm text-gray-500 mb-5">{t("newsPreferencesDesc")}</p>

        {/* Brands */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">{t("brands")}</label>
          <div className="flex flex-wrap gap-2">
            {ALL_BRANDS.map((brand) => (
              <button
                key={brand.value}
                onClick={() => toggleBrand(brand.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  selectedBrands.includes(brand.value)
                    ? "bg-ev-green-50 border-ev-green-300 text-ev-green-700"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {brand.label}
              </button>
            ))}
          </div>
        </div>

        {/* Topics */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t("topics")}</label>
          <div className="flex flex-wrap gap-2">
            {ALL_TOPICS.map((topic) => (
              <button
                key={topic.value}
                onClick={() => toggleTopic(topic.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  selectedTopics.includes(topic.value)
                    ? "bg-ev-green-50 border-ev-green-300 text-ev-green-700"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {t(topic.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="h-4 w-4 text-ev-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t("notifications")}</h2>
        </div>
        <p className="text-sm text-gray-500 mb-5">{t("notificationsDesc")}</p>

        {/* Digest Frequency */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">{t("digestFrequency")}</label>
          <div className="flex gap-3">
            {(["DAILY", "WEEKLY", "NONE"] as const).map((freq) => (
              <label
                key={freq}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                  digestFrequency === freq
                    ? "bg-ev-green-50 border-ev-green-300 text-ev-green-700"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="digestFrequency"
                  value={freq}
                  checked={digestFrequency === freq}
                  onChange={() => { setDigestFrequency(freq); setSaveStatus("idle"); }}
                  className="sr-only"
                />
                <span className="text-sm font-medium">
                  {t(freq === "DAILY" ? "daily" : freq === "WEEKLY" ? "weekly" : "none")}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Alerts Enabled */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm font-medium text-gray-700">{t("alertsEnabled")}</p>
            <p className="text-xs text-gray-500">{t("alertsEnabledDesc")}</p>
          </div>
          <button
            onClick={() => { setAlertsEnabled(!alertsEnabled); setSaveStatus("idle"); }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              alertsEnabled ? "bg-ev-green-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                alertsEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Alert Threshold */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">{t("alertThreshold")}</label>
            <span className="text-sm font-medium text-ev-green-700">{alertThreshold}</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={alertThreshold}
            onChange={(e) => { setAlertThreshold(Number(e.target.value)); setSaveStatus("idle"); }}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-ev-green-500"
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-400">{t("lowSensitivity")}</span>
            <span className="text-xs text-gray-400">{t("highSensitivity")}</span>
          </div>
        </div>
      </div>

      {/* Language Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="h-4 w-4 text-ev-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t("languagePref")}</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">{t("languagePrefDesc")}</p>
        <div className="flex gap-3">
          {(["EN", "ZH"] as const).map((lang) => (
            <label
              key={lang}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                language === lang
                  ? "bg-ev-green-50 border-ev-green-300 text-ev-green-700"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="language"
                value={lang}
                checked={language === lang}
                onChange={() => { setLanguage(lang); setSaveStatus("idle"); }}
                className="sr-only"
              />
              <span className="text-sm font-medium">
                {lang === "EN" ? t("english") : t("chinese")}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveStatus === "saving"}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            saveStatus === "saved"
              ? "bg-green-100 text-green-700 border border-green-300"
              : saveStatus === "error"
                ? "bg-red-100 text-red-700 border border-red-300"
                : "bg-ev-green-500 text-white hover:bg-ev-green-600 disabled:opacity-50"
          }`}
        >
          {saveStatus === "saving" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("saving")}
            </>
          ) : saveStatus === "saved" ? (
            <>
              <Check className="h-4 w-4" />
              {t("saved")}
            </>
          ) : saveStatus === "error" ? (
            t("saveError")
          ) : (
            <>
              <Save className="h-4 w-4" />
              {t("save")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
