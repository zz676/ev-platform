# X Account Login & Linking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add X (Twitter) as a login provider, create a user settings page, and allow admins to link X accounts for publishing.

**Architecture:** Supabase-managed Twitter OAuth for login (mirrors existing Google flow). Custom OAuth 2.0 PKCE flow for admin X account linking with write-scoped tokens. New settings page at `/[locale]/settings/` with profile info, connected accounts, and admin-only X publishing section.

**Tech Stack:** Next.js 15, Supabase Auth, Prisma, TypeScript, Tailwind CSS, next-intl

---

### Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma:314-317` (AuthProvider enum)
- Modify: `prisma/schema.prisma:256-274` (User model)
- Add new model after XPublication (after line 312)

**Step 1: Add TWITTER to AuthProvider enum**

In `prisma/schema.prisma`, change the `AuthProvider` enum at line 314:

```prisma
enum AuthProvider {
  GOOGLE
  GITHUB
  TWITTER
}
```

**Step 2: Add XAccount model after XPublication model (after line 312)**

```prisma
model XAccount {
  id             String   @id @default(cuid())
  userId         String   @unique
  xUserId        String   @unique
  username       String
  displayName    String?
  avatarUrl      String?
  accessToken    String
  refreshToken   String
  tokenExpiresAt DateTime
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  User           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Step 3: Add XAccount relation to User model**

In the User model (line 256-274), add after the `UserPreference` relation:

```prisma
  XAccount          XAccount?
```

**Step 4: Run Prisma migration**

Run: `cd /Users/zhizhou/Downloads/agent/ev-platform-working/Copy4/ev-platform && npx prisma migrate dev --name add-twitter-auth-and-xaccount`

Expected: Migration created and applied successfully.

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add TWITTER auth provider and XAccount model for X login and publishing"
```

---

### Task 2: Add "Continue with X" Login

**Files:**
- Modify: `src/components/context/AuthContext.tsx:22-31` (interface), `src/components/context/AuthContext.tsx:133-145` (add method)
- Modify: `src/components/auth/LoginModal.tsx:14` (destructure), `src/components/auth/LoginModal.tsx:187-214` (add button)
- Modify: `src/messages/en.json:33-47` (Header section)
- Modify: `src/messages/zh.json:33-47` (Header section)

**Step 1: Add loginWithX to AuthContext**

In `src/components/context/AuthContext.tsx`, add to the `AuthContextType` interface (after line 27):

```typescript
  loginWithX: () => Promise<void>;
```

Add the implementation after `loginWithGoogle` (after line 145):

```typescript
  const loginWithX = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "twitter",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      console.error("X login error:", error);
      throw error;
    }
  }, [supabase]);
```

Add `loginWithX` to the context provider value object (around line 206-210).

**Step 2: Add X login button to LoginModal**

In `src/components/auth/LoginModal.tsx`, destructure `loginWithX` from `useAuth()` at line 14:

```typescript
  const { loginWithGoogle, loginWithX, loginWithEmail, signUpWithEmail } = useAuth();
```

Add a handler after `handleGoogleLogin` (after line 55):

```typescript
  const handleXLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await loginWithX();
    } catch {
      setError("Failed to sign in with X. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
```

Add the X button after the Google button (after line 214, before the divider):

```tsx
            {/* X Sign In */}
            <button
              onClick={handleXLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-3"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span className="font-medium text-gray-700">
                {t("continueWithX")}
              </span>
            </button>
```

**Step 3: Add translations**

In `src/messages/en.json`, add to the "Header" object (after "subscribe"):

```json
    "continueWithX": "Continue with X"
```

In `src/messages/zh.json`, add to the "Header" object (after "subscribe"):

```json
    "continueWithX": "使用 X 登录"
```

**Step 4: Verify build**

Run: `cd /Users/zhizhou/Downloads/agent/ev-platform-working/Copy4/ev-platform && npx next build`

Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/components/context/AuthContext.tsx src/components/auth/LoginModal.tsx src/messages/en.json src/messages/zh.json
git commit -m "feat: add Continue with X login button and auth method"
```

---

### Task 3: Create User Settings Page

**Files:**
- Create: `src/app/[locale]/settings/page.tsx`
- Modify: `src/components/layout/UserPanel.tsx:168-179` (fix settings link)
- Modify: `src/messages/en.json` (add Settings namespace)
- Modify: `src/messages/zh.json` (add Settings namespace)

**Step 1: Add Settings translations**

In `src/messages/en.json`, add a "Settings" namespace (before "Terms"):

```json
  "Settings": {
    "title": "Settings",
    "profile": "Profile",
    "email": "Email",
    "name": "Name",
    "role": "Role",
    "connectedAccounts": "Connected Accounts",
    "loginProviders": "Login Providers",
    "loginProvidersDesc": "These are managed by your authentication provider.",
    "xPublishing": "X Publishing Account",
    "xPublishingDesc": "Link your X account to publish platform content from your own account.",
    "connected": "Connected",
    "notConnected": "Not connected",
    "connectXAccount": "Connect X Account",
    "disconnectXAccount": "Disconnect",
    "xHandle": "X Handle",
    "backToHome": "Back to Home"
  },
```

In `src/messages/zh.json`, add the matching "Settings" namespace:

```json
  "Settings": {
    "title": "设置",
    "profile": "个人资料",
    "email": "邮箱",
    "name": "姓名",
    "role": "角色",
    "connectedAccounts": "关联账户",
    "loginProviders": "登录方式",
    "loginProvidersDesc": "由身份验证提供商管理。",
    "xPublishing": "X 发布账户",
    "xPublishingDesc": "关联您的 X 账户，以从您自己的账户发布平台内容。",
    "connected": "已关联",
    "notConnected": "未关联",
    "connectXAccount": "关联 X 账户",
    "disconnectXAccount": "断开关联",
    "xHandle": "X 用户名",
    "backToHome": "返回首页"
  },
```

**Step 2: Create settings page**

Create `src/app/[locale]/settings/page.tsx`:

```tsx
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
```

**Step 3: Create SettingsContent client component**

Create `src/components/settings/SettingsContent.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { User, Mail, Shield, Link2, Unlink } from "lucide-react";

interface SettingsContentProps {
  user: {
    name: string;
    email: string;
    avatarUrl?: string;
    role: string;
  };
  providers: string[];
  isAdmin: boolean;
  xAccount: {
    username: string;
    displayName?: string;
    avatarUrl?: string;
  } | null;
}

export function SettingsContent({ user, providers, isAdmin, xAccount }: SettingsContentProps) {
  const t = useTranslations("Settings");
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnectX = () => {
    window.location.href = "/api/auth/x/link";
  };

  const handleDisconnectX = async () => {
    setIsUnlinking(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/x/unlink", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect");
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setIsUnlinking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("profile")}</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-ev-green-100 flex items-center justify-center overflow-hidden">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.name} className="w-16 h-16 rounded-full" />
            ) : (
              <User className="h-8 w-8 text-ev-green-700" />
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
            {user.role === "ADMIN" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-ev-green-700 mt-1">
                <Shield className="h-3 w-3" />
                Admin
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Connected Accounts Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{t("connectedAccounts")}</h2>
        <p className="text-sm text-gray-500 mb-4">{t("loginProvidersDesc")}</p>
        <div className="space-y-3">
          {/* Google */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="text-sm font-medium text-gray-900">Google</span>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${providers.includes("google") ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {providers.includes("google") ? t("connected") : t("notConnected")}
            </span>
          </div>

          {/* X / Twitter */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span className="text-sm font-medium text-gray-900">X</span>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${providers.includes("twitter") ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {providers.includes("twitter") ? t("connected") : t("notConnected")}
            </span>
          </div>
        </div>
      </div>

      {/* X Publishing Account (Admin Only) */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{t("xPublishing")}</h2>
          <p className="text-sm text-gray-500 mb-4">{t("xPublishingDesc")}</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {xAccount ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {xAccount.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={xAccount.avatarUrl} alt={xAccount.username} className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </div>
                )}
                <div>
                  <p className="font-medium text-sm text-gray-900">{xAccount.displayName || xAccount.username}</p>
                  <p className="text-xs text-gray-500">@{xAccount.username}</p>
                </div>
                <span className="ml-2 text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                  {t("connected")}
                </span>
              </div>
              <button
                onClick={handleDisconnectX}
                disabled={isUnlinking}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Unlink className="h-4 w-4" />
                {t("disconnectXAccount")}
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectX}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Link2 className="h-4 w-4" />
              {t("connectXAccount")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Fix Settings link in UserPanel**

In `src/components/layout/UserPanel.tsx`, change line 169 from:

```tsx
            href={`/${locale}/tech`}
```

to:

```tsx
            href={`/${locale}/settings`}
```

**Step 5: Verify build**

Run: `cd /Users/zhizhou/Downloads/agent/ev-platform-working/Copy4/ev-platform && npx next build`

Expected: Build succeeds.

**Step 6: Commit**

```bash
git add src/app/\[locale\]/settings/page.tsx src/components/settings/SettingsContent.tsx src/components/layout/UserPanel.tsx src/messages/en.json src/messages/zh.json
git commit -m "feat: add user settings page with profile and connected accounts"
```

---

### Task 4: X OAuth 2.0 Linking API Routes (Admin)

**Files:**
- Create: `src/app/api/auth/x/link/route.ts`
- Create: `src/app/api/auth/x/callback/route.ts`
- Create: `src/app/api/auth/x/unlink/route.ts`

**Step 1: Create the link initiation route**

Create `src/app/api/auth/x/link/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { cookies } from "next/headers";

export async function POST() {
  // Verify authenticated admin user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!dbUser || dbUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Generate PKCE code verifier and challenge
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  // Store code verifier in httpOnly cookie (5 min expiry)
  const cookieStore = await cookies();
  cookieStore.set("x_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });

  // Store user ID so callback knows which user initiated the flow
  cookieStore.set("x_link_user_id", user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });

  const clientId = process.env.X_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "X OAuth not configured" }, { status: 500 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const redirectUri = `${origin}/api/auth/x/callback`;

  const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "tweet.read tweet.write users.read offline.access");
  authUrl.searchParams.set("state", crypto.randomBytes(16).toString("hex"));
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return NextResponse.json({ url: authUrl.toString() });
}
```

**Step 2: Create the callback route**

Create `src/app/api/auth/x/callback/route.ts`:

```typescript
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
```

**Step 3: Create the unlink route**

Create `src/app/api/auth/x/unlink/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!dbUser || dbUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  await prisma.xAccount.deleteMany({
    where: { userId: user.id },
  });

  return NextResponse.json({ success: true });
}
```

**Step 4: Verify build**

Run: `cd /Users/zhizhou/Downloads/agent/ev-platform-working/Copy4/ev-platform && npx next build`

Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/app/api/auth/x/
git commit -m "feat: add X OAuth 2.0 PKCE link/unlink API routes for admin publishing"
```

---

### Task 5: Update X Publishing to Use Linked Account

**Files:**
- Modify: `src/lib/twitter.ts:10-15` (getCredentials), `src/lib/twitter.ts:195-226` (postTweet)
- Create: `src/lib/x-token.ts` (token refresh helper)

**Step 1: Create token refresh helper**

Create `src/lib/x-token.ts`:

```typescript
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
```

**Step 2: Add OAuth 2.0 Bearer token support to postTweet**

In `src/lib/twitter.ts`, modify `postTweet` to accept an optional bearer token. Change the function signature and add bearer token logic:

Replace the existing `postTweet` function (lines 195-226) with:

```typescript
// Post a tweet (v2 API)
// If bearerToken is provided (from linked user account), uses OAuth 2.0 Bearer.
// Otherwise falls back to app-level OAuth 1.0a.
export async function postTweet(
  text: string,
  mediaIds?: string[],
  bearerToken?: string
): Promise<TweetResponse> {
  let authHeader: string;

  if (bearerToken) {
    authHeader = `Bearer ${bearerToken}`;
  } else {
    const creds = getCredentials();
    if (!creds.apiKey || !creds.apiSecret || !creds.accessToken || !creds.accessTokenSecret) {
      throw new Error("X API credentials not configured");
    }
    authHeader = generateOAuthHeader("POST", TWEETS_URL);
  }

  const payload: { text: string; media?: { media_ids: string[] } } = { text };

  if (mediaIds && mediaIds.length > 0) {
    payload.media = { media_ids: mediaIds };
  }

  const response = await fetch(TWEETS_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    const errorMsg = error.errors?.[0]?.message || error.detail || error.title || "Unknown error";
    throw new Error(`X API error: ${errorMsg}`);
  }

  return response.json();
}
```

**Step 3: Verify build**

Run: `cd /Users/zhizhou/Downloads/agent/ev-platform-working/Copy4/ev-platform && npx next build`

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/lib/x-token.ts src/lib/twitter.ts
git commit -m "feat: support linked X account tokens for publishing with auto-refresh"
```

---

### Task 6: Update SettingsContent to handle link flow redirect

**Files:**
- Modify: `src/components/settings/SettingsContent.tsx` (handle redirect from link/callback)

**Step 1: Update SettingsContent to use redirect for connect**

The link route returns a JSON URL that the client should redirect to. Update `handleConnectX`:

```typescript
  const handleConnectX = async () => {
    try {
      const res = await fetch("/api/auth/x/link", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to initiate X connection");
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  };
```

**Step 2: Verify build**

Run: `cd /Users/zhizhou/Downloads/agent/ev-platform-working/Copy4/ev-platform && npx next build`

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/settings/SettingsContent.tsx
git commit -m "fix: use POST API for X account link initiation flow"
```

---

### Task 7: Final Build Verification

**Step 1: Run full build**

Run: `cd /Users/zhizhou/Downloads/agent/ev-platform-working/Copy4/ev-platform && npx next build`

Expected: Build succeeds with no errors.

**Step 2: Verify Prisma client is up to date**

Run: `cd /Users/zhizhou/Downloads/agent/ev-platform-working/Copy4/ev-platform && npx prisma generate`

Expected: Prisma client generated successfully.

---

## Environment Variables Checklist

Before deploying, ensure these are configured:

**Supabase Dashboard:**
- Enable Twitter provider with X OAuth 2.0 Client ID and Client Secret

**Environment (.env or Vercel):**
```
X_OAUTH_CLIENT_ID=       # X Developer Portal → OAuth 2.0 Client ID
X_OAUTH_CLIENT_SECRET=   # X Developer Portal → OAuth 2.0 Client Secret
```

**X Developer Portal:**
- App type: Web App
- Callback URL: `https://your-domain.com/api/auth/x/callback` (for linking)
- Also add Supabase callback URL for login: check Supabase dashboard for the exact URL
