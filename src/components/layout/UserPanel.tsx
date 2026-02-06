"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Newspaper,
  Bookmark,
  Settings,
  LogOut,
  Shield,
  Activity,
  BarChart3,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/components/context/AuthContext";
import { useUserPanel } from "@/components/context/UserPanelContext";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { icon: Newspaper, label: "My Feed", href: "/tech" },
  { icon: Bookmark, label: "Saved Articles", href: "/tech" },
];

export function UserPanel() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();
  const { isOpen, close } = useUserPanel();

  // Extract locale from pathname
  const localeMatch = pathname.match(/^\/(en|zh)/);
  const locale = localeMatch ? localeMatch[1] : "en";

  const handleLogout = async () => {
    await logout();
    close();
  };

  if (!user || !isOpen) return null;

  return (
    <>
      {/* Backdrop - transparent for click-outside-to-close */}
      <div
        className="fixed inset-0 z-40"
        onClick={close}
      />

      {/* Dropdown Panel */}
      <div className="fixed top-16 right-4 z-50 w-[270px] bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.12),0_0_20px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* User Profile Section */}
        <div className="px-2 py-1">
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
            <div className="relative flex-shrink-0">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-ev-green-100">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <User className="h-5 w-5 text-ev-green-700" />
                )}
              </div>
              {/* Dropdown arrow indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full shadow-sm border border-gray-200 flex items-center justify-center">
                <ChevronDown className="h-3 w-3 text-gray-600" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">{user.name}</p>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-ev-green-700">
                  <Shield className="h-3 w-3" />
                  Admin
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200" />

        {/* Navigation Items */}
        <div className="px-1.5 py-1">
          {navItems.map((item) => {
            const itemPath = `/${locale}${item.href === "/" ? "" : item.href}`;
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={itemPath}
                onClick={close}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-gray-700" />
                </div>
                <span className="flex-1 text-sm font-medium text-gray-900">
                  {item.label}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>
            );
          })}
        </div>

        {/* Admin Section */}
        {isAdmin && (
          <>
            <div className="border-t border-gray-200" />
            <div className="px-1.5 py-1">
              <Link
                href={`/${locale}/admin`}
                onClick={close}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <Shield className="h-4 w-4 text-gray-700" />
                </div>
                <span className="flex-1 text-sm font-medium text-gray-900">
                  Admin Panel
                </span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>
              <Link
                href={`/${locale}/admin/data-explorer`}
                onClick={close}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="h-4 w-4 text-gray-700" />
                </div>
                <span className="flex-1 text-sm font-medium text-gray-900">
                  Data Explorer
                </span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>
              <Link
                href={`/${locale}/admin/monitoring`}
                onClick={close}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <Activity className="h-4 w-4 text-gray-700" />
                </div>
                <span className="flex-1 text-sm font-medium text-gray-900">
                  Monitoring
                </span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>
            </div>
          </>
        )}

        {/* Settings & Logout */}
        <div className="border-t border-gray-200" />
        <div className="px-1.5 py-1">
          <Link
            href={`/${locale}/settings`}
            onClick={close}
            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
              <Settings className="h-4 w-4 text-gray-700" />
            </div>
            <span className="flex-1 text-sm font-medium text-gray-900">
              Settings
            </span>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 bg-ev-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <LogOut className="h-4 w-4 text-ev-green-600" />
            </div>
            <span className="flex-1 text-sm font-medium text-ev-green-600 text-left">
              Log out
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
