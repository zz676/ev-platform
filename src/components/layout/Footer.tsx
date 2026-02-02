"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export function Footer() {
  const pathname = usePathname();
  const t = useTranslations("Footer");

  // Extract locale from pathname
  const localeMatch = pathname.match(/^\/(en|zh)/);
  const locale = localeMatch ? localeMatch[1] : "en";

  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="px-4 lg:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Links - Left */}
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Link
            href={`/${locale}/terms`}
            className="text-gray-600 hover:text-gray-900 underline"
          >
            {t("terms")}
          </Link>
          <Link
            href={`/${locale}/privacy`}
            className="text-gray-600 hover:text-gray-900 underline"
          >
            {t("privacy")}
          </Link>
          <Link
            href={`/${locale}#subscribe`}
            className="text-gray-600 hover:text-gray-900 underline"
          >
            {t("subscribe")}
          </Link>
          <Link
            href={`/${locale}/contact`}
            className="text-gray-600 hover:text-gray-900 underline"
          >
            {t("contact")}
          </Link>
        </nav>

        {/* Social - Right */}
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>{t("followUs")}</span>
          <a
            href="https://x.com/evjuicy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-900"
            aria-label="Follow us on X"
          >
            {/* X (Twitter) icon */}
            <svg
              className="h-5 w-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
