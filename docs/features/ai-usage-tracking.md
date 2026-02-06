# AI Usage Tracking (Image Generation, Text Completion & OCR Cost Monitoring)

## Overview

This feature tracks all AI API calls—image generation, text completions, and OCR—with cost, success/failure status, token usage, and source attribution.

### Image Generation
Uses **Together AI (FLUX.1)** as the primary provider (96% cheaper) with **DALL-E 3** as fallback.

### Text Completions
Tracks token usage and costs for all text completion calls:
- Content processing (`processEVContent`)
- Translation (`translateContent`)
- X/Twitter summary generation (`generateXSummary`)
- Digest generation (`callDeepSeek`, `callOpenAI`)

### OCR (Vision)
Tracks **GPT-4o Vision** calls from the scraper pipeline for extracting data from table images:
- Rankings table extraction (`ocr_data_type="rankings"`)
- Trend table extraction (`ocr_data_type="trend"`)
- Vehicle specs extraction (`ocr_data_type="specs"`)

**Note**: Chart images (line/bar charts) are skipped for OCR — GPT-4o Vision is inaccurate at reading pixel-based values. Chart articles are instead stored as news posts with the image visible.

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
  id           String   @id @default(cuid())
  type         String   // "image_generation", "text_completion"
  model        String   // "FLUX.1-schnell", "dall-e-3", "deepseek-chat", "gpt-4o-mini"
  size         String?  // "1792x1024" (for images)
  cost         Float    // estimated cost in USD
  success      Boolean
  errorMsg     String?
  postId       String?  // optional link to post
  source       String   // "webhook", "admin_approve", "process_content", "translate", "x_summary", "digest_deepseek", "digest_openai"
  inputTokens  Int?     // prompt tokens (for text completions)
  outputTokens Int?     // completion tokens (for text completions)
  durationMs   Int?     // request duration in milliseconds
  createdAt    DateTime @default(now())

  Post Post? @relation(fields: [postId], references: [id])

  @@index([createdAt])
  @@index([source])
  @@index([postId])
}
```

### Cost Constants

Defined in `src/lib/ai.ts`:

```typescript
// Image generation pricing
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

// Text completion pricing (per 1M tokens)
const TEXT_COMPLETION_COST = {
  "deepseek-chat": { input: 0.14, output: 0.28 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
} as const;
```

### OCR Pricing (scraper/extractors/image_ocr.py)

```python
# GPT-4o Vision pricing (per 1M tokens)
GPT4O_PRICING = {
    "input": 2.50,   # $2.50 per 1M input tokens (includes image tokens)
    "output": 10.00,  # $10.00 per 1M output tokens
}
```

### Text Completion Cost Calculation

```typescript
function calculateTextCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = TEXT_COMPLETION_COST[model];
  if (!pricing) return 0;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}
```

### Core Module: `src/lib/ai.ts`

| Function | Purpose | Source Value |
|----------|---------|--------------|
| `trackAIUsage(params)` | Internal function to persist usage record | — |
| `generateWithTogetherAI(prompt, options)` | Generate with FLUX.1 | varies |
| `generateWithDALLE(prompt, options)` | Generate with DALL-E 3 | varies |
| `generatePostImage(title, summary, options?)` | Main image function - tries Together AI first, falls back to DALL-E | varies |
| `processEVContent(content, source, postId?)` | Process and translate EV news content | `"process_content"` |
| `translateContent(content, postId?)` | Translate Chinese to English | `"translate"` |
| `generateXSummary(content, postId?)` | Generate X/Twitter summary | `"x_summary"` |

### Digest Module: `src/lib/llm/digest.ts`

| Function | Purpose | Source Value |
|----------|---------|--------------|
| `callDeepSeek(prompt)` | Call DeepSeek for digest generation | `"digest_deepseek"` |
| `callOpenAI(prompt, model)` | Call OpenAI (fallback) for digest | `"digest_openai"` |

### Scraper Module: `scraper/extractors/image_ocr.py`

| Function | Purpose | Source Value |
|----------|---------|--------------|
| `ImageOCR.extract_from_url()` | Async OCR extraction | `"ocr_backfill"` |
| `ImageOCR.extract_from_url_sync()` | Sync OCR extraction | `"ocr_backfill"` |

OCR usage is tracked via `EVPlatformAPI.track_ocr_usage()` in `scraper/api_client.py`, which POSTs to `/api/admin/ai-usage`. Each OCR request tracks duration (milliseconds) in addition to tokens and cost.

### Tracking Behavior

#### Image Generation

| Scenario | Model | cost | success |
|----------|-------|------|---------|
| Together AI success | FLUX.1-schnell | $0.003 | true |
| Together AI fails, DALL-E success | dall-e-3 | $0.08 | true |
| Together AI fails (tracked) | FLUX.1-schnell | $0.00 | false |
| DALL-E fails | dall-e-3 | $0.00 | false |
| No API keys | none | $0.00 | false |

#### Text Completions

| Scenario | Model | Typical Tokens | Typical Cost |
|----------|-------|----------------|--------------|
| Process content | deepseek-chat | ~2000 | ~$0.0004 |
| Translation | deepseek-chat | ~1000 | ~$0.0002 |
| X summary | deepseek-chat | ~500 | ~$0.0001 |
| Digest (DeepSeek) | deepseek-chat | ~1500 | ~$0.0003 |
| Digest (OpenAI fallback) | gpt-4o-mini | ~1500 | ~$0.0005 |

#### OCR (Vision)

Only table-type images are processed with OCR. Chart images (`ocr_data_type="chart"`) are skipped.

| Scenario | Model | OCR Type | Typical Tokens | Typical Cost | Typical Duration |
|----------|-------|----------|----------------|--------------|-----------------|
| Rankings table OCR | gpt-4o | rankings | ~5000 input, ~500 output | ~$0.017 | ~5-15s |
| Trend table OCR | gpt-4o | trend | ~5000 input, ~300 output | ~$0.016 | ~5-12s |
| Vehicle specs OCR | gpt-4o | specs | ~4000 input, ~200 output | ~$0.012 | ~4-10s |
| Chart images | — | chart | **Skipped** | $0.00 | — |

Note: Input tokens for OCR include image tokens which vary based on image size and detail level. Chart OCR was removed because GPT-4o Vision approximates pixel positions inaccurately for line/bar charts. Duration is tracked per-request and displayed on the admin monitoring page.

## API Endpoints

### POST `/api/admin/ai-usage`

Track AI usage from external services (e.g., scraper OCR). No authentication required.

**Request Body:**

```json
{
  "type": "ocr",
  "model": "gpt-4o",
  "cost": 0.017,
  "success": true,
  "source": "ocr_backfill",
  "inputTokens": 5000,
  "outputTokens": 500,
  "errorMsg": null
}
```

**Required fields:** `type`, `model`, `cost`, `success`, `source`

**Optional fields:** `size`, `errorMsg`, `postId`, `inputTokens`, `outputTokens`, `durationMs`

**Response:**

```json
{
  "success": true,
  "id": "clx456...",
  "message": "AI usage tracked successfully"
}
```

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
| `prisma/schema.prisma` | Added `AIUsage` model with `inputTokens`/`outputTokens` fields |
| `src/lib/ai.ts` | Added text completion cost tracking, token tracking for `processEVContent`, `translateContent`, `generateXSummary` |
| `src/lib/llm/digest.ts` | Added token tracking to `callDeepSeek` and `callOpenAI` |
| `src/app/api/webhook/route.ts` | Pass `source: "webhook"` and `postId` |
| `src/app/api/admin/posts/[id]/route.ts` | Pass `source: "admin_approve"` and `postId` |
| `scripts/fix-image-ratios.ts` | Added Together AI with DALL-E fallback |
| `src/app/api/admin/ai-usage/route.ts` | Admin endpoint for usage stats + POST handler for external tracking |
| `src/app/[locale]/admin/monitoring/page.tsx` | Display token counts in Recent Activity table |
| `scraper/extractors/image_ocr.py` | Added token/cost/duration tracking to OCRResult, GPT-4o pricing constants |
| `scraper/api_client.py` | Added `track_ocr_usage()` method with `duration_ms` parameter |
| `scraper/backfill_cnevdata.py` | Integrated OCR usage tracking with duration in `process_ocr_batch()` |

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

### OpenAI (GPT-4o Vision - OCR)

| Token Type | Cost per 1M |
|------------|-------------|
| Input (text + image) | $2.50 |
| Output | $10.00 |

Note: Image tokens depend on resolution and detail level. A typical high-detail image uses ~5,000-10,000 input tokens.

## Getting Together AI API Key

1. Go to https://api.together.xyz
2. Sign up / Log in
3. Navigate to API Keys section
4. Create a new API key
5. Add to `.env.local`: `TOGETHER_API_KEY=your_key_here`

Together AI offers $25 free credits for new accounts.
