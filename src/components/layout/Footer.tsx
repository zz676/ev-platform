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
      <div className="px-6 lg:px-8 pt-2 pb-[0.4rem]">
        {/* Top Row */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          {/* Left - Stay Updated */}
          <div id="subscribe" className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <h3 className="text-gray-500 font-semibold">{t("stayJuiced")}</h3>
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
                  className="px-3 py-1.5 text-sm bg-white border border-ev-green-200 rounded-md focus:outline-none focus:ring-1 focus:ring-ev-green-500 focus:border-transparent w-32 sm:w-38 focus:w-64 sm:focus:w-76 transition-all duration-200 text-gray-800 placeholder-gray-400 placeholder:italic"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="px-4 py-[0.4125rem] text-btn-sm font-medium text-white rounded-md transition-colors disabled:opacity-50 hover:opacity-80 italic"
                  style={{ backgroundColor: 'rgb(81, 191, 36)' }}
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
              <Link href={`/${locale}/tesla`} className="text-gray-600 hover:text-ev-green-600 transition-colors">{t("navTesla")}</Link>
              <Link href={`/${locale}/tech`} className="text-gray-600 hover:text-ev-green-600 transition-colors">{t("navTech")}</Link>
            </div>
            <span className="text-ev-green-300">|</span>
            <div className="flex items-center gap-4">
              <Link href={`/${locale}/terms`} className="text-gray-600 hover:text-ev-green-600 transition-colors">{t("terms")}</Link>
              <Link href={`/${locale}/privacy`} className="text-gray-600 hover:text-ev-green-600 transition-colors">{t("privacy")}</Link>
              <a href="mailto:ev.juice.info@gmail.com" className="text-gray-600 hover:text-ev-green-600 transition-colors">{t("contact")}</a>
            </div>
            <span className="text-ev-green-300">|</span>
            <div className="flex items-center gap-3">
              <a
                href="https://x.com/the_ev_juice"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-ev-green-600 transition-colors"
                aria-label="Follow us on X"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://www.reddit.com/r/electricvehicles/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-[#FF4500] transition-colors"
                aria-label="Visit us on Reddit"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
                </svg>
              </a>
              <a
                href="https://www.linkedin.com/company/evjuice/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-[#0A66C2] transition-colors"
                aria-label="Follow us on LinkedIn"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a
                href="https://www.facebook.com/evjuice"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-[#1877F2] transition-colors"
                aria-label="Follow us on Facebook"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
            </div>
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
