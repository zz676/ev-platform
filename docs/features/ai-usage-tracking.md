# AI Usage Tracking (DALL-E Cost Monitoring)

## Overview

This feature tracks all DALL-E API calls with cost, success/failure status, and source attribution. It provides visibility into AI spending and helps prevent runaway costs from migration scripts or bugs.

## Problem Solved

- **Cost visibility**: DALL-E costs ~$0.08 per image (1792x1024, standard quality) with no built-in tracking
- **Incident prevention**: A migration script ran 227 unnecessary API calls due to missing env var check
- **No audit trail**: Previously only console.log tracking existed - no persistent metrics
- **Source attribution**: Impossible to know if costs came from webhook auto-approve, admin actions, or scripts

## Solution

1. New `AIUsage` database table to persist every DALL-E API call
2. Track success/failure with error messages for debugging
3. Associate calls with source (webhook, admin_approve, migration_script)
4. Link to postId for traceability
5. Admin API endpoint for viewing usage statistics

## Architecture

### Database Model

```prisma
model AIUsage {
  id        String   @id @default(cuid())
  type      String   // "image_generation", "text_completion", etc.
  model     String   // "dall-e-3"
  size      String?  // "1792x1024"
  cost      Float    // estimated cost in USD
  success   Boolean
  errorMsg  String?
  postId    String?  // optional link to post
  source    String   // "webhook", "admin_approve", "migration_script"
  createdAt DateTime @default(now())

  Post Post? @relation(fields: [postId], references: [id])

  @@index([createdAt])
  @@index([source])
  @@index([postId])
}
```

### Cost Constants

Defined in `src/lib/ai.ts`:

```typescript
const DALLE_COST = {
  "dall-e-3": {
    "1024x1024": { standard: 0.04, hd: 0.08 },
    "1024x1792": { standard: 0.08, hd: 0.12 },
    "1792x1024": { standard: 0.08, hd: 0.12 },
  },
} as const;
```

Current configuration uses `1792x1024` + `standard` = **$0.08 per image**.

### Core Module: `src/lib/ai.ts`

| Function | Purpose |
|----------|---------|
| `trackAIUsage(params)` | Internal function to persist usage record |
| `generatePostImage(title, summary, options?)` | Generate DALL-E image with tracking |

The `generatePostImage` function now accepts an optional `options` object:

```typescript
export async function generatePostImage(
  title: string,
  summary: string,
  options?: {
    source?: string;  // "webhook", "admin_approve", "migration_script"
    postId?: string;  // Link to post for traceability
  }
): Promise<string>
```

### Tracking Behavior

| Scenario | cost | success | errorMsg |
|----------|------|---------|----------|
| Successful generation | $0.08 | true | null |
| Missing API key | $0.00 | false | "OpenAI API key required..." |
| API error (rate limit, etc.) | $0.00 | false | Error message from API |
| No data returned | $0.00 | false | "Failed to generate image: no data returned" |

**Important**: Tracking failures don't block the main operation. If database write fails, it logs to console and continues.

## API Endpoints

### GET `/api/admin/ai-usage`

Returns comprehensive usage statistics. Requires admin authentication.

**Response:**

```json
{
  "summary": {
    "totalCost": 18.16,
    "totalCalls": 245,
    "successfulCalls": 227,
    "failedCalls": 18
  },
  "bySource": [
    { "source": "webhook", "cost": 12.00, "count": 150 },
    { "source": "admin_approve", "cost": 4.00, "count": 50 },
    { "source": "migration_script", "cost": 2.16, "count": 27 }
  ],
  "dailyUsage": [
    { "date": "2024-01-15", "count": 12, "cost": 0.96 },
    { "date": "2024-01-14", "count": 8, "cost": 0.64 }
  ],
  "recentUsage": [
    {
      "id": "clx123...",
      "type": "image_generation",
      "model": "dall-e-3",
      "size": "1792x1024",
      "cost": 0.08,
      "success": true,
      "errorMsg": null,
      "postId": "abc123",
      "source": "webhook",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

## Call Sites

### 1. Webhook Auto-Approve (`src/app/api/webhook/route.ts`)

When a post has high relevance score and needs an AI image:

```typescript
const imageUrl = await generatePostImage(title, summary, {
  source: "webhook",
  postId,
});
```

### 2. Admin Manual Approve (`src/app/api/admin/posts/[id]/route.ts`)

When admin approves a post that needs an image:

```typescript
const imageUrl = await generatePostImage(title, summary, {
  source: "admin_approve",
  postId: id,
});
```

### 3. Migration Script (`scripts/fix-image-ratios.ts`)

When batch-fixing posts with bad aspect ratios:

```typescript
const newImageUrl = await generateImage(title, summary, post.id);
// Internally tracks with source: "migration_script"
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Image Generation Request                  │
│         (webhook / admin_approve / migration_script)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Check API Key   │
                    └─────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
        [Key exists]                    [No key]
              │                               │
              ▼                               ▼
      Call DALL-E API              Track failure (cost: $0)
              │                               │
              ▼                               ▼
      ┌───────────────┐                   Throw error
      │ API Response  │
      └───────────────┘
              │
      ┌───────┴───────┐
      ▼               ▼
   Success         Failure
      │               │
      ▼               ▼
Track success     Track failure
(cost: $0.08)     (cost: $0)
      │               │
      ▼               ▼
Return image URL  Throw error
```

## Files Modified

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `AIUsage` model, added relation to `Post` |
| `src/lib/ai.ts` | Added `trackAIUsage()`, updated `generatePostImage()` signature |
| `src/app/api/webhook/route.ts` | Pass `source: "webhook"` and `postId` |
| `src/app/api/admin/posts/[id]/route.ts` | Pass `source: "admin_approve"` and `postId` |
| `scripts/fix-image-ratios.ts` | Added tracking with `source: "migration_script"` |
| `src/app/api/admin/ai-usage/route.ts` | NEW - Admin endpoint for usage stats |

## Database Queries

### Check total spending

```sql
SELECT SUM(cost) as total_cost, COUNT(*) as total_calls
FROM "AIUsage"
WHERE success = true;
```

### Spending by source

```sql
SELECT source, SUM(cost) as cost, COUNT(*) as calls
FROM "AIUsage"
WHERE success = true
GROUP BY source
ORDER BY cost DESC;
```

### Failed calls with errors

```sql
SELECT "postId", source, "errorMsg", "createdAt"
FROM "AIUsage"
WHERE success = false
ORDER BY "createdAt" DESC
LIMIT 20;
```

### Daily cost for last week

```sql
SELECT DATE("createdAt") as date, SUM(cost) as cost, COUNT(*) as calls
FROM "AIUsage"
WHERE "createdAt" >= NOW() - INTERVAL '7 days'
  AND success = true
GROUP BY DATE("createdAt")
ORDER BY date DESC;
```

## Testing

1. **Webhook tracking**: Submit a high-relevance post via webhook, verify AIUsage record created
2. **Admin tracking**: Approve a post without image in admin, verify AIUsage record with source="admin_approve"
3. **Failure tracking**: Remove OPENAI_API_KEY, try to generate, verify failure record created
4. **API endpoint**: Call `/api/admin/ai-usage`, verify summary and breakdown data
5. **Migration script**: Run with --dry-run first, then live, verify records created

## Cost Alerts (Future)

Potential improvements:
- Slack/email alert when daily spend exceeds threshold
- Auto-pause image generation if monthly budget exceeded
- Dashboard widget showing real-time spending
- Cost comparison: AI-generated vs scraped image ratio

## Pricing Reference

As of 2024, DALL-E 3 pricing:

| Size | Standard | HD |
|------|----------|-----|
| 1024x1024 | $0.040 | $0.080 |
| 1024x1792 | $0.080 | $0.120 |
| 1792x1024 | $0.080 | $0.120 |

Current config uses **1792x1024 standard = $0.08/image**.

For 100 posts/day with 50% needing AI images: ~$4/day = ~$120/month.
