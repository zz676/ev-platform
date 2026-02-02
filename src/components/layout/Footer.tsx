"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function Footer() {
  const pathname = usePathname();
  const t = useTranslations("Footer");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  // Extract locale from pathname
  const localeMatch = pathname.match(/^\/(en|zh)/);
  const locale = localeMatch ? localeMatch[1] : "en";

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <footer className="bg-ev-green-50 text-gray-700">
      <div className="px-6 lg:px-8 pt-4 pb-[0.8rem]">
        {/* Top Row */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          {/* Left - Stay Updated */}
          <div id="subscribe" className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <h3 className="text-gray-800 font-semibold">{t("stayUpdated")}</h3>
            {status === "success" ? (
              <p className="text-sm text-ev-green-600 font-medium">{t("subscribeSuccess")}</p>
            ) : (
              <form onSubmit={handleSubscribe} className="flex items-center gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  required
                  className="px-3 py-1.5 text-sm bg-white border border-ev-green-200 rounded-md focus:outline-none focus:ring-1 focus:ring-ev-green-500 focus:border-transparent w-40 sm:w-48 focus:w-[11.5rem] sm:focus:w-[13.8rem] transition-all duration-200 text-gray-800 placeholder-gray-400"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-ev-green-500 hover:bg-ev-green-600 rounded-md transition-colors disabled:opacity-50"
                >
                  {t("subscribeButton")}
                </button>
              </form>
            )}
            {status === "error" && (
              <p className="text-xs text-red-500">{t("subscribeError")}</p>
            )}
          </div>

          {/* Right - Navigation */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-4">
              <Link href={`/${locale}`} className="text-gray-600 hover:text-ev-green-600 transition-colors">{t("navNews")}</Link>
              <Link href={`/${locale}/deliveries`} className="text-gray-600 hover:text-ev-green-600 transition-colors">{t("navDeliveries")}</Link>
              <Link href={`/${locale}/tech`} className="text-gray-600 hover:text-ev-green-600 transition-colors">{t("navTech")}</Link>
            </div>
            <span className="text-ev-green-300">|</span>
            <div className="flex items-center gap-4">
              <Link href={`/${locale}/terms`} className="text-gray-600 hover:text-ev-green-600 transition-colors">{t("terms")}</Link>
              <Link href={`/${locale}/privacy`} className="text-gray-600 hover:text-ev-green-600 transition-colors">{t("privacy")}</Link>
              <Link href={`/${locale}/contact`} className="text-gray-600 hover:text-ev-green-600 transition-colors">{t("contact")}</Link>
            </div>
            <span className="text-ev-green-300">|</span>
            <a
              href="https://x.com/evjuice"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-ev-green-600 transition-colors"
              aria-label="Follow us on X"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="flex justify-between items-center mt-3 pt-[0.45rem] border-t border-ev-green-200 text-xs text-gray-500">
          <p>© 2025 {t("brand")}</p>
          <p className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-ev-green-500 rounded-full"></span>
            {t("tagline")}
          </p>
        </div>
      </div>
    </footer>
  );
}
