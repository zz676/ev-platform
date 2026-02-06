import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { SettingsContent } from "@/components/settings/SettingsContent";
import { Settings, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      role: true,
      XAccount: {
        select: {
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      UserPreference: true,
    },
  });

  if (!dbUser) {
    redirect("/");
  }

  const t = await getTranslations("Settings");

  const identities = user.identities || [];
  const providers = identities.map((i) => i.provider);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-ev-green-700 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToHome")}
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-ev-green-100">
            <Settings className="h-5 w-5 text-ev-green-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-sm text-gray-500">{t("subtitle")}</p>
          </div>
        </div>

        <SettingsContent
          user={{
            name: dbUser.name || "",
            email: dbUser.email,
            avatarUrl: dbUser.avatarUrl || undefined,
            role: dbUser.role,
          }}
          providers={providers}
          isAdmin={dbUser.role === "ADMIN"}
          xAccount={dbUser.XAccount ? {
            username: dbUser.XAccount.username,
            displayName: dbUser.XAccount.displayName || undefined,
            avatarUrl: dbUser.XAccount.avatarUrl || undefined,
          } : null}
          preferences={dbUser.UserPreference ? {
            brands: dbUser.UserPreference.brands,
            topics: dbUser.UserPreference.topics,
            digestFrequency: dbUser.UserPreference.digestFrequency,
            language: dbUser.UserPreference.language,
            alertsEnabled: dbUser.UserPreference.alertsEnabled,
            alertThreshold: dbUser.UserPreference.alertThreshold,
          } : null}
        />
      </div>
    </div>
  );
}
