import { prisma } from "@/lib/prisma";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// Admin emails that should be granted admin role
const ADMIN_EMAILS = [
  "admin@evjuice.com",
  "zhishengzhou1984@gmail.com",
  "ev.juice.info@gmail.com",
];

export async function syncUserToPrisma(supabaseUser: SupabaseUser) {
  const email = supabaseUser.email;
  if (!email) {
    throw new Error("User email is required");
  }

  const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
  const name = supabaseUser.user_metadata?.full_name ||
               supabaseUser.user_metadata?.name ||
               email.split("@")[0];
  const avatarUrl = supabaseUser.user_metadata?.avatar_url ||
                    supabaseUser.user_metadata?.picture;

  // Upsert user - create if doesn't exist, update if exists
  // Note: role is only set on create, not on update - allows manual role management in DB
  const user = await prisma.user.upsert({
    where: { id: supabaseUser.id },
    update: {
      email,
      name,
      avatarUrl,
      emailVerified: supabaseUser.email_confirmed_at != null,
      updatedAt: new Date(),
      // Don't overwrite role - preserve manually set roles in database
    },
    create: {
      id: supabaseUser.id,
      email,
      name,
      avatarUrl,
      emailVerified: supabaseUser.email_confirmed_at != null,
      role: isAdmin ? "ADMIN" : "USER",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return user;
}

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
