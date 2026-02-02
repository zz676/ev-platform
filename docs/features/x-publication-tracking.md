# X Publication Tracking & Attempt Limits

## Overview

This feature tracks X (Twitter) API publishing attempts, enforces retry limits, and provides admin visibility into failed publications. It helps conserve API quota by preventing infinite retries on failing posts.

## Problem Solved

- X API counts EVERY request (even failures) against quota
- Previously, failed posts would retry forever on each cron run
- No visibility for admins to see which posts failed to publish
- Image upload failures wasted additional API calls on retries

## Solution

1. Track publishing attempts in the `XPublication` table
2. **MAX_ATTEMPTS = 2** - Stop auto-retry after 2 failures
3. Show failed posts in admin panel for manual retry
4. Skip image upload if it already failed (saves API calls)

## Architecture

### Database Model

The `XPublication` model (already exists in schema) stores:

```prisma
model XPublication {
  id                  String         @id
  postId              String         @unique
  status              XPublishStatus @default(PENDING)
  tweetId             String?
  tweetUrl            String?
  publishedAt         DateTime?
  imageSource         ImageSource    @default(NONE)
  mediaId             String?
  attempts            Int            @default(0)
  lastError           String?
  nextRetryAt         DateTime?
  // ... engagement metrics
}

enum XPublishStatus {
  PENDING
  PUBLISHING
  PUBLISHED
  FAILED
  SKIPPED
}
```

### Core Module: `src/lib/x-publication.ts`

| Function | Purpose |
|----------|---------|
| `canAttemptPublish(postId)` | Check if cron should attempt (respects max attempts) |
| `canManualRetry(postId)` | Check if manual retry allowed (always yes unless published) |
| `startPublishingAttempt(postId)` | Record attempt start, increment counter |
| `recordPublishSuccess(postId, data)` | Record successful publish |
| `recordPublishFailure(postId, error)` | Record failure with error message |
| `hasImageFailed(postId)` | Check if image previously failed (skip re-upload) |

### Configuration

**Option 1: Environment Variable (Recommended)**

Set via environment variable in `.env.local` or Vercel dashboard:

```bash
# Max auto-publish attempts before requiring manual retry (default: 2)
X_MAX_PUBLISH_ATTEMPTS=2
```

Code reads this value (defaults to 2 if not set):

```typescript
// src/lib/x-publication.ts
export const MAX_ATTEMPTS = parseInt(process.env.X_MAX_PUBLISH_ATTEMPTS || "2", 10);
```

**Option 2: Direct Database Edit**

For individual posts, you can reset the attempt counter directly in the database:

```sql
-- Reset attempts for a specific post to allow more retries
UPDATE "XPublication" SET attempts = 0 WHERE "postId" = 'your-post-id';

-- Or set status back to PENDING
UPDATE "XPublication" SET attempts = 0, status = 'PENDING' WHERE "postId" = 'your-post-id';
```

**Why Environment Variable is Recommended:**

| Env Var | DB Setting |
|---------|------------|
| Simple - one global value | Overkill for a global config |
| Easy to change in Vercel dashboard | Requires DB access or admin UI |
| No code changes needed | Would need settings table + API |
| Takes effect on next cron run | Same |

Use DB edits only for one-off fixes on specific posts. Use env var for changing the global limit.

## API Changes

### GET/POST `/api/cron/publish`

Response now includes:
```json
{
  "message": "Cron publish completed",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "maxAttemptsPerPost": 2,
  "results": {
    "published": 1,
    "failed": 1,
    "skipped": 2,
    "errors": ["post123: X API error: Rate limit (attempt 2/2 - max reached)"],
    "tweets": [...]
  }
}
```

### GET `/api/admin/posts`

New query parameter: `xStatus`
- `failed` - Posts with failed X publications
- `published` - Posts successfully published to X
- `not_posted` - Posts without any X publication record

Response includes:
```json
{
  "posts": [{
    "id": "...",
    "XPublication": {
      "status": "FAILED",
      "attempts": 2,
      "lastError": "X API error: Rate limit exceeded",
      "tweetId": null,
      "tweetUrl": null
    }
  }],
  "stats": {
    "total": 100,
    "pending": 20,
    "approved": 30,
    "published": 50,
    "xFailed": 5
  },
  "maxXAttempts": 2
}
```

### POST `/api/admin/posts/[id]/post-to-x`

- Manual retry always allowed (unless already published)
- Tracks attempts same as cron
- Returns attempt count on failure:

```json
{
  "error": "Failed to post to X: Rate limit exceeded",
  "attempts": 3,
  "maxAttempts": 2,
  "maxReached": true
}
```

## Admin Panel UI

### X Status Filter

Located above the posts table:
```
X Status: [All] [Published] [Failed (5)] [Not Posted]
```

- "Failed" button shows red badge with count
- Clicking filters posts by X publication status

### Posts Table

New "X Status" column showing:

| Status | Display |
|--------|---------|
| Published | Green badge with checkmark |
| Failed | Red badge showing "Failed (2/2)" with error tooltip |
| Pending/Publishing | Yellow badge with spinner |
| No record | Gray dash "-" |

### Actions

- Failed posts show orange "Retry" button instead of blue "Post to X"
- Successfully published posts show green "View" link to tweet

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Cron Job Runs                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ canAttemptPublish│
                    │    (postId)      │
                    └─────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        [allowed=true]  [already pub]  [max reached]
              │               │               │
              ▼               ▼               ▼
    startPublishingAttempt   skip          skip
              │
              ▼
        Try to publish
              │
      ┌───────┴───────┐
      ▼               ▼
   Success         Failure
      │               │
      ▼               ▼
recordPublishSuccess  recordPublishFailure
      │               │
      ▼               ▼
 status=PUBLISHED  status=FAILED
                      │
                      ▼
              ┌───────────────┐
              │ attempts >= 2? │
              └───────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
    [Yes: max reached]      [No: will retry]
          │                       │
          ▼                       ▼
    Shows in admin           Next cron run
    "Failed (2/2)"           will try again
          │
          ▼
    Admin clicks "Retry"
          │
          ▼
    Manual retry (always allowed)
```

## Files Modified

| File | Change |
|------|--------|
| `src/lib/x-publication.ts` | NEW - Core attempt tracking module |
| `src/app/api/cron/publish/route.ts` | Check attempts, track failures, skip if max |
| `src/app/api/admin/posts/[id]/post-to-x/route.ts` | Track manual retries |
| `src/app/api/admin/posts/route.ts` | Add xStatus filter, return XPublication data |
| `src/components/admin/PostsTable.tsx` | Add X Status column header |
| `src/components/admin/PostRow.tsx` | Show X status badge, retry button |
| `src/app/[locale]/admin/page.tsx` | Add X status filter UI |

## Testing

1. **Cron with failures**: Simulate API failure, verify attempts increment
2. **Max attempts**: After 2 failures, verify cron skips the post
3. **Admin visibility**: Check "Failed" filter shows only failed posts
4. **Manual retry**: Click "Retry" on failed post, verify it works
5. **Image skip**: If image failed before, verify it's not re-attempted

## Future Improvements

- Exponential backoff with `nextRetryAt` field
- Configurable MAX_ATTEMPTS per post type
- Email notification when posts fail max attempts
- Bulk retry functionality in admin
