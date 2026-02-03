# AI Usage Tracking (Image Generation Cost Monitoring)

## Overview

This feature tracks all AI image generation API calls with cost, success/failure status, and source attribution. It uses **Together AI (FLUX.1)** as the primary provider (96% cheaper) with **DALL-E 3** as fallback.

## Problem Solved

- **Cost visibility**: No built-in tracking for AI image generation costs
- **Cost reduction**: DALL-E 3 costs $0.08/image vs FLUX.1 at $0.003/image (96% savings)
- **Incident prevention**: A migration script ran 227 unnecessary API calls due to missing env var check
- **No audit trail**: Previously only console.log tracking existed - no persistent metrics
- **Source attribution**: Impossible to know if costs came from webhook auto-approve, admin actions, or scripts

## Solution

1. **Primary**: Together AI (FLUX.1-schnell) - $0.003/image
2. **Fallback**: DALL-E 3 - $0.08/image (if Together AI fails or not configured)
3. `AIUsage` database table to persist every API call
4. Track success/failure with error messages for debugging
5. Admin API endpoint for viewing usage statistics

## Cost Comparison

| Provider | Model | Cost/Image | Monthly (50 images/day) |
|----------|-------|------------|-------------------------|
| Together AI | FLUX.1-schnell | $0.003 | **$4.50** |
| OpenAI | DALL-E 3 | $0.080 | $120.00 |

**Savings: 96% ($115.50/month)**

## Environment Variables

```bash
# Primary (recommended) - Together AI
TOGETHER_API_KEY=your_together_api_key

# Fallback - OpenAI DALL-E 3
OPENAI_API_KEY=your_openai_api_key
```

If only `OPENAI_API_KEY` is set, DALL-E 3 will be used. If both are set, Together AI is tried first.

## Architecture

### Database Model

```prisma
model AIUsage {
  id        String   @id @default(cuid())
  type      String   // "image_generation", "text_completion", etc.
  model     String   // "FLUX.1-schnell", "dall-e-3"
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
const IMAGE_GEN_COST = {
  // Together AI - FLUX.1 models
  "FLUX.1-schnell": 0.003,
  "FLUX.1-dev": 0.01,
  "FLUX.1-pro": 0.025,
  // DALL-E 3
  "dall-e-3-1792x1024-standard": 0.08,
  "dall-e-3-1792x1024-hd": 0.12,
  "dall-e-3-1024x1024-standard": 0.04,
} as const;
```

### Core Module: `src/lib/ai.ts`

| Function | Purpose |
|----------|---------|
| `trackAIUsage(params)` | Internal function to persist usage record |
| `generateWithTogetherAI(prompt, options)` | Generate with FLUX.1 |
| `generateWithDALLE(prompt, options)` | Generate with DALL-E 3 |
| `generatePostImage(title, summary, options?)` | Main function - tries Together AI first, falls back to DALL-E |

### Tracking Behavior

| Scenario | Model | cost | success |
|----------|-------|------|---------|
| Together AI success | FLUX.1-schnell | $0.003 | true |
| Together AI fails, DALL-E success | dall-e-3 | $0.08 | true |
| Together AI fails (tracked) | FLUX.1-schnell | $0.00 | false |
| DALL-E fails | dall-e-3 | $0.00 | false |
| No API keys | none | $0.00 | false |

## API Endpoints

### GET `/api/admin/ai-usage`

Returns comprehensive usage statistics. Requires admin authentication.

**Response:**

```json
{
  "summary": {
    "totalCost": 1.50,
    "totalCalls": 245,
    "successfulCalls": 227,
    "failedCalls": 18
  },
  "bySource": [
    { "source": "webhook", "cost": 0.90, "count": 150 },
    { "source": "admin_approve", "cost": 0.30, "count": 50 },
    { "source": "migration_script", "cost": 0.30, "count": 27 }
  ],
  "dailyUsage": [
    { "date": "2024-01-15", "count": 12, "cost": 0.036 },
    { "date": "2024-01-14", "count": 8, "cost": 0.024 }
  ],
  "recentUsage": [
    {
      "id": "clx123...",
      "type": "image_generation",
      "model": "FLUX.1-schnell",
      "size": "1792x1024",
      "cost": 0.003,
      "success": true,
      "errorMsg": null,
      "postId": "abc123",
      "source": "webhook",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
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
                    │ TOGETHER_API_KEY │
                    │    exists?       │
                    └─────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
           [Yes]                            [No]
              │                               │
              ▼                               │
    ┌─────────────────┐                       │
    │ Try Together AI │                       │
    │  (FLUX.1)       │                       │
    └─────────────────┘                       │
              │                               │
      ┌───────┴───────┐                       │
      ▼               ▼                       │
   Success         Failure                    │
      │               │                       │
      ▼               ▼                       ▼
Track success     Track failure ──────► Try DALL-E 3
(cost: $0.003)    (cost: $0)                  │
      │                               ┌───────┴───────┐
      ▼                               ▼               ▼
Return image URL                   Success         Failure
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
| `src/lib/ai.ts` | Added Together AI support, DALL-E fallback, tracking |
| `src/app/api/webhook/route.ts` | Pass `source: "webhook"` and `postId` |
| `src/app/api/admin/posts/[id]/route.ts` | Pass `source: "admin_approve"` and `postId` |
| `scripts/fix-image-ratios.ts` | Added Together AI with DALL-E fallback |
| `src/app/api/admin/ai-usage/route.ts` | Admin endpoint for usage stats |

## Database Queries

### Check total spending

```sql
SELECT SUM(cost) as total_cost, COUNT(*) as total_calls
FROM "AIUsage"
WHERE success = true;
```

### Spending by model

```sql
SELECT model, SUM(cost) as cost, COUNT(*) as calls
FROM "AIUsage"
WHERE success = true
GROUP BY model
ORDER BY cost DESC;
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
SELECT "postId", model, source, "errorMsg", "createdAt"
FROM "AIUsage"
WHERE success = false
ORDER BY "createdAt" DESC
LIMIT 20;
```

## Testing

1. **Together AI**: Set `TOGETHER_API_KEY`, verify FLUX.1 is used (check logs for "FLUX.1")
2. **Fallback**: Remove `TOGETHER_API_KEY`, verify DALL-E is used
3. **Tracking**: Check `/api/admin/ai-usage` for records with correct model and cost
4. **Migration script**: Run `npx tsx scripts/fix-image-ratios.ts --dry-run`

## Pricing Reference

### Together AI (FLUX.1)

| Model | Cost/Image |
|-------|------------|
| FLUX.1-schnell | $0.003 |
| FLUX.1-dev | $0.010 |
| FLUX.1-pro | $0.025 |

### OpenAI (DALL-E 3)

| Size | Standard | HD |
|------|----------|-----|
| 1024x1024 | $0.040 | $0.080 |
| 1024x1792 | $0.080 | $0.120 |
| 1792x1024 | $0.080 | $0.120 |

## Getting Together AI API Key

1. Go to https://api.together.xyz
2. Sign up / Log in
3. Navigate to API Keys section
4. Create a new API key
5. Add to `.env.local`: `TOGETHER_API_KEY=your_key_here`

Together AI offers $25 free credits for new accounts.
