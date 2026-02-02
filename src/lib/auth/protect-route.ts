import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function requireAuth(redirectTo: string = "/") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(redirectTo);
  }

  return user;
}

export async function requireAdmin(redirectTo: string = "/") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(redirectTo);
  }

  // Check if user is admin in database
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!dbUser || dbUser.role !== "ADMIN") {
    redirect(redirectTo);
  }

  return user;
}

export async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getAuthUserWithRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, name: true, avatarUrl: true },
  });

  return {
    ...user,
    role: dbUser?.role || "USER",
    name: dbUser?.name || user.user_metadata?.full_name || user.email?.split("@")[0],
    avatarUrl: dbUser?.avatarUrl || user.user_metadata?.avatar_url,
  };
}
