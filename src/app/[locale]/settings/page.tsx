import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { SettingsContent } from "@/components/settings/SettingsContent";

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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("title")}</h1>

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
        />
      </div>
    </div>
  );
}
