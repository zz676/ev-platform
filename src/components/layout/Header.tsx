"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, User, X } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/components/context/AuthContext";
import { useUserPanel } from "@/components/context/UserPanelContext";
import { useLoginModal } from "@/components/context/LoginModalContext";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { open: openPanel } = useUserPanel();
  const { open: openLoginModal } = useLoginModal();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const t = useTranslations("Header");

  // Extract locale from pathname
  const localeMatch = pathname.match(/^\/(en|zh)/);
  const locale = localeMatch ? localeMatch[1] : "en";

  // Navigation items
  const navItems = [
    { href: `/${locale}`, label: t("nav.market"), key: "market", enabled: true },
    { href: `/${locale}/tech`, label: t("nav.tech"), key: "tech", enabled: true },
    { href: `/${locale}/tesla`, label: t("nav.tesla"), key: "tesla", enabled: true },
    { href: `/${locale}/policy`, label: t("nav.policy"), key: "policy", enabled: true },
  ];

  // Check if a nav item is active
  const isActive = (href: string, key: string) => {
    if (key === "market") {
      // Market is active only on exact homepage match
      return pathname === `/${locale}` || pathname === `/${locale}/`;
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Logo - Left */}
        <Link href={`/${locale}`} className="flex items-center gap-2 flex-shrink-0">
          <Image
            src="/icon-48.png"
            alt={t("brand")}
            width={36}
            height={36}
            className="w-9 h-9"
          />
          <span className="font-bold text-[1.4375rem]" style={{ color: '#27c618' }}>{t("brand")}</span>
        </Link>

        {/* Navigation - Center */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) =>
            item.enabled ? (
              <Link
                key={item.key}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  isActive(item.href, item.key)
                    ? "text-ev-green-600 font-semibold"
                    : "text-gray-600 hover:text-ev-green-600"
                }`}
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.key}
                className="text-sm font-medium text-gray-600 cursor-default"
              >
                {item.label}
              </span>
            )
          )}
          {/* Subscribe Link */}
          <button
            onClick={() => document.getElementById('subscribe')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-sm font-medium text-gray-600 hover:text-ev-green-600 underline transition-colors animate-shimmer bg-gradient-to-r from-gray-600 via-ev-green-500 to-gray-600 bg-[length:200%_100%] bg-clip-text text-transparent"
          >
            {t("subscribe")}
          </button>
        </nav>

        {/* Right Section - Search + Language + Profile/Login */}
        <div className="flex items-center gap-3">
          {/* Search Button */}
          <div className="relative">
            {showSearch ? (
              <form
                className="flex items-center"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (searchQuery.trim()) {
                    router.push(`/${locale}/search?q=${encodeURIComponent(searchQuery.trim())}`);
                    setShowSearch(false);
                    setSearchQuery("");
                  }
                }}
              >
                <input
                  type="text"
                  placeholder={t("search")}
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 lg:w-64 pl-3 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-ev-green-500 focus:border-transparent"
                  onBlur={(e) => {
                    // Don't close if clicking the X button
                    if (!e.relatedTarget?.closest('button')) {
                      setShowSearch(false);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowSearch(false);
                    setSearchQuery("");
                  }}
                  className="absolute right-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Language Toggle */}
          <button
            onClick={() => {
              const newLocale = locale === "en" ? "zh" : "en";
              const newPath = pathname.replace(/^\/(en|zh)/, `/${newLocale}`);
              router.push(newPath);
            }}
            className="flex items-center justify-between h-7 bg-gray-200 rounded-full px-2 relative w-[61px]"
            aria-label="Switch language"
          >
            <span
              className={`text-[10px] font-semibold z-10 transition-colors duration-200 ${
                locale === "en" ? "text-transparent" : "text-gray-500"
              }`}
            >
              EN
            </span>
            <span
              className={`text-[10px] font-semibold z-10 transition-colors duration-200 ${
                locale === "zh" ? "text-transparent" : "text-gray-500"
              }`}
            >
              CH
            </span>
            {/* Sliding flag button */}
            <span
              className={`absolute top-0.5 h-6 w-8 bg-white rounded-full shadow-sm transition-all duration-200 flex items-center justify-center ${
                locale === "zh" ? "right-0.5" : "left-0.5"
              }`}
            >
              <span className="text-sm">
                {locale === "en" ? "🇺🇸" : "🇨🇳"}
              </span>
            </span>
          </button>

          {/* Login/Profile Button */}
          {user ? (
            <button
              onClick={openPanel}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
              aria-label="Open user menu"
            >
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <User className="h-5 w-5 text-gray-600" />
              )}
            </button>
          ) : (
            <button
              onClick={openLoginModal}
              disabled={isLoading}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
              aria-label="Login"
            >
              <User className="h-5 w-5 text-gray-600" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
