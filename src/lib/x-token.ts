import { prisma } from "@/lib/prisma";

/**
 * Get a valid access token for a linked X account.
 * Refreshes the token if expired.
 * Returns null if no account is linked or refresh fails.
 */
export async function getLinkedXToken(userId: string): Promise<string | null> {
  const xAccount = await prisma.xAccount.findUnique({
    where: { userId },
  });

  if (!xAccount) return null;

  // Check if token is still valid (with 5 min buffer)
  if (xAccount.tokenExpiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return xAccount.accessToken;
  }

  // Token expired — refresh
  const clientId = process.env.X_OAUTH_CLIENT_ID;
  const clientSecret = process.env.X_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  try {
    const response = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: xAccount.refreshToken,
      }),
    });

    if (!response.ok) {
      console.error("[X Token] Refresh failed:", await response.text());
      return null;
    }

    const tokens = await response.json();

    await prisma.xAccount.update({
      where: { userId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return tokens.access_token;
  } catch (error) {
    console.error("[X Token] Refresh error:", error);
    return null;
  }
}
