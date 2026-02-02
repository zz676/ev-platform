"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X,
  User,
  Newspaper,
  TrendingUp,
  Radio,
  Bookmark,
  Settings,
  LogOut,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/context/AuthContext";
import { useUserPanel } from "@/components/context/UserPanelContext";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { icon: <Newspaper className="h-5 w-5" />, label: "My Feed", href: "/" },
  { icon: <TrendingUp className="h-5 w-5" />, label: "Markets", href: "/markets" },
  { icon: <Radio className="h-5 w-5" />, label: "Command Center", href: "/command" },
  { icon: <Bookmark className="h-5 w-5" />, label: "Saved Articles", href: "/saved" },
];

export function UserPanel() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();
  const { isOpen, close } = useUserPanel();

  // Extract locale from pathname
  const localeMatch = pathname.match(/^\/(en|zh)/);
  const locale = localeMatch ? localeMatch[1] : "en";

  const handleLogout = () => {
    logout();
    close();
  };

  if (!user) return null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={close}
        />
      )}

      {/* Panel */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex flex-col w-80 bg-white shadow-xl transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <span className="font-semibold text-gray-900">Account</span>
          <button
            onClick={close}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close panel"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* User Profile Section */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-ev-green-100">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <User className="h-6 w-6 text-ev-green-700" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{user.name}</p>
              <p className="text-sm text-gray-500 truncate">{user.email}</p>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-xs font-medium text-ev-green-700 bg-ev-green-100 rounded-full">
                  <Shield className="h-3 w-3" />
                  Admin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const itemPath = `/${locale}${item.href === "/" ? "" : item.href}`;
            const isActive =
              item.href === "/"
                ? pathname === `/${locale}` || pathname === `/${locale}/`
                : pathname.startsWith(itemPath);

            return (
              <Link
                key={item.href}
                href={itemPath}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-ev-green-50 text-ev-green-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <span
                  className={cn(
                    isActive ? "text-ev-green-600" : "text-gray-400"
                  )}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}

          {/* Admin Panel Link */}
          {isAdmin && (
            <>
              <div className="my-3 border-t border-gray-200" />
              <Link
                href={`/${locale}/admin`}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  pathname.startsWith(`/${locale}/admin`)
                    ? "bg-ev-green-50 text-ev-green-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <span
                  className={cn(
                    pathname.startsWith(`/${locale}/admin`)
                      ? "text-ev-green-600"
                      : "text-gray-400"
                  )}
                >
                  <Shield className="h-5 w-5" />
                </span>
                Admin Panel
              </Link>
            </>
          )}
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t border-gray-200 space-y-1">
          <Link
            href={`/${locale}/settings`}
            onClick={close}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <Settings className="h-5 w-5 text-gray-400" />
            Settings
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
