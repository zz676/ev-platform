import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const settingsUrl = `${origin}/en/settings`;

  if (error || !code) {
    return NextResponse.redirect(`${settingsUrl}?x_error=${error || "no_code"}`);
  }

  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get("x_code_verifier")?.value;
  const userId = cookieStore.get("x_link_user_id")?.value;

  if (!codeVerifier || !userId) {
    return NextResponse.redirect(`${settingsUrl}?x_error=session_expired`);
  }

  // Clean up cookies
  cookieStore.delete("x_code_verifier");
  cookieStore.delete("x_link_user_id");

  const clientId = process.env.X_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.X_OAUTH_CLIENT_SECRET!;
  const redirectUri = `${origin}/api/auth/x/callback`;

  // Exchange code for tokens
  const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("[X OAuth] Token exchange failed:", errorText);
    return NextResponse.redirect(`${settingsUrl}?x_error=token_exchange_failed`);
  }

  const tokens = await tokenResponse.json();
  const { access_token, refresh_token, expires_in } = tokens;

  // Fetch X user profile
  const profileResponse = await fetch("https://api.twitter.com/2/users/me?user.fields=profile_image_url", {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  if (!profileResponse.ok) {
    console.error("[X OAuth] Profile fetch failed:", await profileResponse.text());
    return NextResponse.redirect(`${settingsUrl}?x_error=profile_fetch_failed`);
  }

  const profile = await profileResponse.json();
  const xUser = profile.data;

  // Upsert XAccount
  await prisma.xAccount.upsert({
    where: { userId },
    update: {
      xUserId: xUser.id,
      username: xUser.username,
      displayName: xUser.name,
      avatarUrl: xUser.profile_image_url,
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
    },
    create: {
      userId,
      xUserId: xUser.id,
      username: xUser.username,
      displayName: xUser.name,
      avatarUrl: xUser.profile_image_url,
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
    },
  });

  return NextResponse.redirect(`${settingsUrl}?x_linked=true`);
}
