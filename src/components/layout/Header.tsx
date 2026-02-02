"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, User, X } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/components/context/AuthContext";
import { useUserPanel } from "@/components/context/UserPanelContext";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, login, isLoading } = useAuth();
  const { open: openPanel } = useUserPanel();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const t = useTranslations("Header");

  // Extract locale from pathname
  const localeMatch = pathname.match(/^\/(en|zh)/);
  const locale = localeMatch ? localeMatch[1] : "en";

  // Navigation items
  const navItems = [
    { href: `/${locale}`, label: t("nav.news"), key: "news" },
    { href: `/${locale}/deliveries`, label: t("nav.deliveries"), key: "deliveries" },
    { href: `/${locale}/tech`, label: t("nav.tech"), key: "tech" },
    { href: `/${locale}/markets`, label: t("nav.markets"), key: "markets" },
    { href: `/${locale}/policy`, label: t("nav.policy"), key: "policy" },
  ];

  // Check if a nav item is active
  const isActive = (href: string, key: string) => {
    if (key === "news") {
      // News is active only on exact homepage match
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
            alt="EV Juicy"
            width={36}
            height={36}
            className="w-9 h-9"
          />
          <span className="font-bold text-xl" style={{ color: '#27c618' }}>EV Juicy</span>
        </Link>

        {/* Navigation - Center */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
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
          ))}
        </nav>

        {/* Right Section - Search + Profile/Login */}
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
              onClick={login}
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
