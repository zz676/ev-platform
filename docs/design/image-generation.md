# Image Generation System Design

This document describes the AI-powered image generation system used in the EV Platform for creating hero images for news articles.

## Overview

The platform automatically generates high-quality images for EV news articles using a two-tier AI provider system with cost optimization and comprehensive usage tracking.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Image Generation Pipeline                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Triggers                    Generation                  Storage    │
│  ┌──────────┐               ┌───────────┐              ┌─────────┐  │
│  │ Webhook  │──┐            │           │              │ Vercel  │  │
│  │ (scraper)│  │            │ Together  │──success────▶│  Blob   │  │
│  └──────────┘  │            │  (FLUX.1) │              │ Storage │  │
│                │            │           │              └─────────┘  │
│  ┌──────────┐  │  ┌──────┐  └─────┬─────┘                    │      │
│  │  Admin   │──┼─▶│Decide│        │                          │      │
│  │ Approval │  │  │      │        │fail                      ▼      │
│  └──────────┘  │  └──────┘        ▼                    ┌─────────┐  │
│                │            ┌───────────┐              │  Post   │  │
│  ┌──────────┐  │            │  DALL-E   │──success────▶│ Record  │  │
│  │   Cron   │──┘            │ (fallback)│              └─────────┘  │
│  │ Publish  │               └───────────┘                    │      │
│  └──────────┘                     │                          │      │
│                                   │                          ▼      │
│                                   │                    ┌─────────┐  │
│                                   └────────────────────│AIUsage  │  │
│                                      (track all)       │ Table   │  │
│                                                        └─────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Architecture

### Two-Tier Provider System

The system uses Together AI as the primary provider with DALL-E as a fallback:

| Provider | Model | Size | Cost per Image | Priority |
|----------|-------|------|----------------|----------|
| Together AI | FLUX.1-schnell | 1792x1024 | $0.003 | Primary |
| OpenAI | DALL-E 3 | 1792x1024 | $0.080 | Fallback |

**Cost Savings**: FLUX.1 is ~96% cheaper than DALL-E 3.

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/ai.ts` | Core image generation logic |
| `src/lib/image-utils.ts` | Image validation and aspect ratio checking |
| `src/app/api/webhook/route.ts` | Scraper webhook handler |
| `src/app/api/admin/posts/[id]/route.ts` | Admin approval handler |
| `src/app/api/cron/publish/route.ts` | Scheduled publishing |
| `src/app/api/admin/ai-usage/route.ts` | Usage metrics API |

## Image Generation Flow

### 1. Webhook Trigger (Automated)

When the scraper sends a new article via webhook:

```
POST /api/webhook
  │
  ▼
┌─────────────────────────────────┐
│ Validate webhook secret         │
└─────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────┐
│ Check existing images           │
│ - No images? → needs generation │
│ - Has images? → check quality   │
└─────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────┐
│ Validate aspect ratio           │
│ (minimum 1.3:1, max 4:1)        │
│ - Bad ratio? → needs generation │
│ - Good ratio? → keep original   │
└─────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────┐
│ Calculate relevance score       │
│ (0-100 based on EV keywords)    │
└─────────────────────────────────┘
  │
  ├── score >= 50 ──▶ AUTO-APPROVE + Generate Image
  │
  └── score < 50 ───▶ PENDING (manual review)
```

**Rationale**: Only auto-generate images for high-confidence posts to minimize costs.

### 2. Admin Approval Trigger

When an admin approves a pending post:

```typescript
// PATCH /api/admin/posts/[id]
// Body: { status: "APPROVED" }

if (needsImageGeneration(post)) {
  const imageUrl = await generatePostImage(title, summary, postId, "admin_approve");
  if (imageUrl) {
    // Download and persist to Vercel Blob
    await uploadToBlob(imageUrl, `posts/${postId}.png`);
  }
}
```

### 3. Publishing Trigger

VIP posts (relevance >= 85) automatically publish to X/Twitter with images:

```
Cron: /api/cron/publish (every 15 minutes)
  │
  ▼
┌─────────────────────────────────┐
│ Find approved posts ready       │
│ to publish (not yet on X)       │
└─────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────┐
│ Image source priority:          │
│ 1. Use scraped image (if valid) │
│ 2. Generate AI image            │
│ 3. Post without image (fallback)│
└─────────────────────────────────┘
```

## Image Quality Validation

### Aspect Ratio Check

The system validates images before using them:

```typescript
// src/lib/image-utils.ts

const MIN_ASPECT_RATIO = 1.3;  // width/height minimum
const MAX_ASPECT_RATIO = 4.0;  // width/height maximum

async function checkImageAspectRatio(url: string): Promise<boolean | null> {
  // Download only image header (up to 64KB)
  // Parse dimensions from JPEG/PNG/GIF/WebP
  // Return true if ratio is acceptable
}
```

**Supported Formats**: JPEG, PNG, GIF, WebP

**Why Aspect Ratio Matters**: Social media platforms crop images. Images that are too tall or too wide display poorly in feeds.

## Prompt Engineering

The image generation prompt is tailored for EV news content:

```typescript
// src/lib/ai.ts

const prompt = `
A professional, modern photograph style image for an electric vehicle news article.
Topic: ${title}
Context: ${summary.substring(0, 200)}

Style requirements:
- Clean, professional news/tech media aesthetic
- Feature electric vehicles, charging infrastructure, or EV technology
- Modern urban or tech environment
- Vibrant but realistic colors
- No text or logos in the image
- High quality, suitable for social media
`;
```

## Storage

Generated images are persisted to Vercel Blob storage:

```typescript
// Upload flow
const response = await fetch(generatedImageUrl);
const blob = await response.blob();
const { url } = await put(`posts/${postId}.png`, blob, {
  access: 'public',
  contentType: 'image/png',
});
```

**Storage Path**: `posts/{postId}.png`

**Benefits**:
- Permanent URLs (AI provider URLs may expire)
- CDN-backed delivery
- No external dependencies after upload

## Usage Tracking

### Database Schema

```prisma
model AIUsage {
  id        String   @id @default(cuid())
  type      String   // "image_generation"
  model     String   // "FLUX.1-schnell", "dall-e-3"
  size      String?  // "1792x1024"
  cost      Float    // USD
  success   Boolean
  errorMsg  String?  // Error details if failed
  postId    String?  // Associated post
  source    String   // "webhook", "admin_approve", "cron_publish"
  createdAt DateTime @default(now())

  @@index([createdAt])
  @@index([source])
  @@index([postId])
}
```

### Tracking Implementation

Every generation attempt is logged:

```typescript
// src/lib/ai.ts

async function trackAIUsage(params: {
  type: string;
  model: string;
  size?: string;
  cost: number;
  success: boolean;
  errorMsg?: string;
  postId?: string;
  source: string;
}) {
  await prisma.aIUsage.create({ data: params });
}
```

### Cost Calculation

| Model | Size | Quality | Cost |
|-------|------|---------|------|
| FLUX.1-schnell | 1792x1024 | - | $0.003 |
| dall-e-3 | 1792x1024 | standard | $0.080 |
| dall-e-3 | 1792x1024 | hd | $0.120 |
| dall-e-3 | 1024x1024 | standard | $0.040 |

## Monitoring Dashboard

### Admin UI

Location: `/admin/monitoring`

**Summary Cards**:
- Total Cost (all-time spend)
- Total Calls (generation attempts)
- Success Rate (percentage)

**Daily Cost Chart**:
- Bar chart showing cost per day (last 30 days)
- Powered by Recharts library

**Breakdown Views**:
- Cost by source (webhook, admin, cron)
- Success vs. failure counts

**Recent Activity Table**:
| Column | Description |
|--------|-------------|
| Time | Generation timestamp |
| Model | FLUX.1-schnell or dall-e-3 |
| Source | Trigger source |
| Cost | USD amount |
| Status | Success/Failed with error tooltip |

### API Endpoint

```
GET /api/admin/ai-usage

Response:
{
  "summary": {
    "totalCost": 45.67,
    "totalCalls": 1250,
    "successfulCalls": 1200,
    "failedCalls": 50
  },
  "bySource": [
    { "source": "webhook", "cost": 28.50, "count": 950 },
    { "source": "admin_approve", "cost": 12.30, "count": 200 }
  ],
  "dailyUsage": [
    { "date": "2024-01-15", "count": 45, "cost": 0.135 }
  ],
  "recentUsage": [
    {
      "id": "...",
      "model": "FLUX.1-schnell",
      "source": "webhook",
      "cost": 0.003,
      "success": true,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Error Handling

### Fallback Chain

```
Together AI (FLUX.1)
  │
  ├── success ──▶ Return image URL
  │
  └── failure ──▶ DALL-E 3
                    │
                    ├── success ──▶ Return image URL
                    │
                    └── failure ──▶ Return null (proceed without image)
```

### Error Scenarios

| Scenario | Handling |
|----------|----------|
| Together AI unavailable | Fall back to DALL-E |
| Both providers fail | Post created without image |
| Image download fails | Log error, continue with text |
| Aspect ratio invalid | Treat as needing regeneration |
| Blob upload fails | Use temporary AI URL |

All failures are logged to `AIUsage` table with error messages for debugging.

## Configuration

### Environment Variables

```bash
# Required for image generation
TOGETHER_API_KEY=...         # Together AI API key (primary)
OPENAI_API_KEY=...           # OpenAI API key (fallback)

# Required for storage
BLOB_READ_WRITE_TOKEN=...    # Vercel Blob token

# Thresholds
X_MIN_RELEVANCE_SCORE=50     # Auto-approve threshold
X_VIP_THRESHOLD=85           # VIP post threshold
```

### Disabling Image Generation

To disable AI image generation:
1. Remove `TOGETHER_API_KEY` and `OPENAI_API_KEY` from environment
2. System will use scraped images only or post without images

## Cost Optimization Strategies

1. **Primary/Fallback Model**: Use cheap FLUX.1 first, expensive DALL-E only as backup
2. **Relevance Gating**: Only auto-generate for high-relevance posts (score >= 50)
3. **Aspect Ratio Reuse**: Keep valid scraped images instead of regenerating
4. **Batch Processing**: Cron jobs process in batches to avoid rate limits
5. **Usage Monitoring**: Dashboard enables cost tracking and anomaly detection

## Future Improvements

- [ ] Add model selection in admin UI (FLUX.1 vs DALL-E)
- [ ] Implement image regeneration button for individual posts
- [ ] Add cost alerts/budgets with notifications
- [ ] Support additional image sizes for different platforms
- [ ] Cache failed URLs to avoid repeated generation attempts
