# X Account Login & Linking Design

## Summary

Add X (Twitter) as a login provider and allow admins to link their X account for publishing platform content from their own X account.

## Scope

1. **Sign in with X** (all users) — via Supabase's built-in Twitter OAuth provider
2. **User Settings page** (all users) — profile info and connected login providers
3. **Link X account for publishing** (admin-only) — custom OAuth 2.0 PKCE flow to obtain write-scoped tokens, displayed on settings page only for admins

## 1. Sign in with X (Supabase)

**Prerequisites:** Enable Twitter provider in Supabase dashboard with X OAuth 2.0 Client ID and Client Secret.

**Changes:**

- `LoginModal.tsx` — Add "Continue with X" button alongside Google button
- `AuthContext.tsx` — Add `loginWithX()` method using `supabase.auth.signInWithOAuth({ provider: "twitter" })`
- `sync-user.ts` — No changes needed; already handles arbitrary Supabase providers generically
- `callback/route.ts` — No changes needed; Supabase callback is provider-agnostic
- `prisma/schema.prisma` — Add `TWITTER` to `AuthProvider` enum
- Translation files (`en.json`, `zh.json`) — Add "Continue with X" strings

**Flow:** Same as Google — Supabase redirects to X, user authorizes, callback exchanges code for session, user synced to Prisma DB.

## 2. User Settings Page

**New route:** `/[locale]/settings/page.tsx`

**Sections:**
- **Profile** — Name, email, avatar (read-only, from Supabase)
- **Connected Accounts** — Shows which login providers are linked (Google, X). No connect/disconnect for login providers (managed by Supabase)
- **X Publishing Account** (admin-only) — Connect/disconnect X account for publishing. Shows linked X handle and avatar when connected.

**Navigation:** Add "Settings" link to the user panel dropdown (`UserPanel.tsx`).

**Files:**
- `src/app/[locale]/settings/page.tsx` — New settings page (protected)
- `src/app/[locale]/settings/layout.tsx` — Optional layout wrapper
- Translation files — Add "Settings" namespace strings
- `UserPanel.tsx` — Add settings link

## 3. Custom X OAuth 2.0 Flow for Linking (Admin Publishing)

**New Prisma model:**

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

Add `XAccount? xAccount` relation to User model.

**New API routes:**

- `POST /api/auth/x/link` — Initiates OAuth 2.0 PKCE flow
  - Requires authenticated admin user
  - Generates code verifier + challenge
  - Stores verifier in httpOnly cookie (5 min expiry)
  - Redirects to `https://twitter.com/i/oauth2/authorize` with scopes: `tweet.read tweet.write users.read offline.access`

- `GET /api/auth/x/callback` — Handles X redirect
  - Exchanges authorization code + verifier for tokens via `https://api.twitter.com/2/oauth2/token`
  - Fetches user profile from `https://api.twitter.com/2/users/me`
  - Upserts `XAccount` record with tokens
  - Redirects back to settings page

- `POST /api/auth/x/unlink` — Removes linked X account
  - Requires authenticated admin user
  - Deletes `XAccount` record for current user
  - Returns success

**Environment variables needed:**
```
X_OAUTH_CLIENT_ID=       # From X Developer Portal (OAuth 2.0)
X_OAUTH_CLIENT_SECRET=   # From X Developer Portal (OAuth 2.0)
```

These are separate from the existing X_API_KEY/X_API_SECRET (OAuth 1.0a app-level keys).

## 4. Publishing Integration

Update `twitter.ts` and `x-publication.ts`:

1. When publishing, check if the triggering admin has a linked `XAccount` with valid tokens
2. If yes — use their OAuth 2.0 tokens (Bearer token for v2 API)
3. If tokens expired — refresh using stored refresh token, update DB
4. If refresh fails or no linked account — fall back to existing app-level OAuth 1.0a keys

Zero breaking changes to current publishing behavior.

## File Change Summary

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add TWITTER to AuthProvider, add XAccount model, add relation to User |
| `src/components/auth/LoginModal.tsx` | Add "Continue with X" button |
| `src/components/context/AuthContext.tsx` | Add `loginWithX()` method |
| `src/app/[locale]/settings/page.tsx` | New settings page |
| `src/app/api/auth/x/link/route.ts` | New — initiate X OAuth link flow |
| `src/app/api/auth/x/callback/route.ts` | New — handle X OAuth callback for linking |
| `src/app/api/auth/x/unlink/route.ts` | New — unlink X account |
| `src/lib/twitter.ts` | Support user-specific OAuth 2.0 tokens |
| `src/lib/x-publication.ts` | Check for linked XAccount before publishing |
| `src/components/user/UserPanel.tsx` | Add Settings link |
| `src/messages/en.json` | Add Settings and X login translations |
| `src/messages/zh.json` | Add Settings and X login translations |
