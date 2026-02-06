# X Account Login & Linking

## Overview

Users can log in with their X (Twitter) account via Supabase OAuth 2.0. Admins can additionally link an X account for publishing platform content directly from their own X handle.

## Architecture

### Login Flow (All Users)
- Uses Supabase-managed X OAuth 2.0 (provider: `"x"`)
- Mirrors the existing Google login flow
- "Continue with X" button in the login modal
- Supabase handles token management for login sessions

### Account Linking Flow (Admin Only)
- Custom OAuth 2.0 PKCE flow for write-scoped tokens
- Separate from login — allows admins to link an X account for publishing
- Tokens stored in `XAccount` table with auto-refresh
- Available from the Settings page under "X Publishing Account"

## Database

### AuthProvider Enum
Added `TWITTER` to the `AuthProvider` enum in `prisma/schema.prisma`.

### XAccount Model
Stores linked X account credentials for publishing:
- `userId` — unique, one linked account per user
- `xUserId` — X platform user ID
- `username`, `displayName`, `avatarUrl` — profile info
- `accessToken`, `refreshToken`, `tokenExpiresAt` — OAuth 2.0 tokens

## Key Files

### Login
- `src/components/context/AuthContext.tsx` — `loginWithX` method using Supabase OAuth with provider `"x"`
- `src/components/auth/LoginModal.tsx` — "Continue with X" button

### Settings Page
- `src/app/[locale]/settings/page.tsx` — Server component, fetches user + XAccount data
- `src/components/settings/SettingsContent.tsx` — Client component with profile, connected accounts, and admin X publishing section

### API Routes (Account Linking)
- `src/app/api/auth/x/link/route.ts` — POST, initiates PKCE flow, returns X authorization URL
- `src/app/api/auth/x/callback/route.ts` — GET, exchanges code for tokens, upserts XAccount
- `src/app/api/auth/x/unlink/route.ts` — POST, deletes linked XAccount

### Publishing Integration
- `src/lib/x-token.ts` — `getLinkedXToken()` retrieves a valid access token, auto-refreshes if expired
- `src/lib/twitter.ts` — `postTweet()` accepts optional `bearerToken` param for OAuth 2.0 Bearer auth, falls back to app-level OAuth 1.0a

## Configuration

### Supabase Dashboard
- Enable "X / Twitter (OAuth 2.0)" provider with Client ID and Client Secret
- Note: Supabase uses `"x"` as the provider name (not `"twitter"`)

### Environment Variables
```
X_OAUTH_CLIENT_ID=       # X Developer Portal OAuth 2.0 Client ID
X_OAUTH_CLIENT_SECRET=   # X Developer Portal OAuth 2.0 Client Secret
```

### X Developer Portal
- App type: Web App (Confidential client)
- Callback URLs:
  - `https://<supabase-project>.supabase.co/auth/v1/callback` (for login)
  - `https://<your-domain>/api/auth/x/callback` (for account linking)

## Translations
- Login button: `Header.continueWithX`
- Settings page: `Settings.*` namespace (en + zh)
