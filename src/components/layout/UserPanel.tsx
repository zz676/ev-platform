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
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/components/context/AuthContext";
import { useUserPanel } from "@/components/context/UserPanelContext";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { icon: Newspaper, label: "My Feed", href: "/" },
  { icon: Bookmark, label: "Saved Articles", href: "/saved" },
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
      <div className="fixed top-16 right-4 z-50 w-[270px] bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* User Profile Section */}
        <div className="p-2">
          <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-ev-green-100 flex-shrink-0">
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
        <div className="p-1.5">
          {navItems.map((item) => {
            const itemPath = `/${locale}${item.href === "/" ? "" : item.href}`;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={itemPath}
                onClick={close}
                className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors"
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
            <div className="p-1.5">
              <Link
                href={`/${locale}/admin`}
                onClick={close}
                className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors"
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
                href={`/${locale}/admin/monitoring`}
                onClick={close}
                className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors"
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
        <div className="p-1.5">
          <Link
            href={`/${locale}/settings`}
            onClick={close}
            className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors"
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
            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
              <LogOut className="h-4 w-4 text-gray-700" />
            </div>
            <span className="flex-1 text-sm font-medium text-gray-900 text-left">
              Log out
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
