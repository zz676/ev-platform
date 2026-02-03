# Enhanced X Posting System

> **Last Updated**: February 2025
> **Status**: Implemented

## Overview

The Enhanced X Posting System improves the X (Twitter) publishing pipeline with a tiered posting strategy, daily digests, configurable thresholds, and admin alerts.

### Key Features

| Feature | Description |
|---------|-------------|
| **VIP/Headlines Tier** | High-relevance posts (score ≥ 85) get individual tweets |
| **Daily Digests** | LLM-aggregated summaries of medium-relevance posts |
| **Auto-Approval** | Posts with score ≥ 50 are automatically approved |
| **Rate Limiting** | Configurable daily limits to prevent over-posting |
| **Admin Alerts** | Email notifications for failures and edge cases |

---

## RelevanceScore Algorithm (0-100)

The scraper assigns a relevance score based on four criteria:

| Criteria | Points | Description |
|----------|--------|-------------|
| **News Value** | 30 | Major announcements, sales data, significant events |
| **Uniqueness** | 25 | Content unique to China, not covered elsewhere |
| **Timeliness** | 25 | Current news, breaking stories |
| **Credibility** | 20 | Reliable sources (official > media > social) |

Located in `/scraper/processors/ai_service.py`

---

## Posting Tiers

### Tier 1: VIP Posts (Score ≥ 85)

Individual tweets for high-impact news:
- Published immediately when discovered
- Each post gets its own tweet with image
- Checked 5x daily at: 06:00, 12:00, 15:00, 18:00, 22:00 UTC

### Tier 2: Digest Posts (Score 50-84)

Aggregated into daily digest tweets:
- LLM generates engaging summary of multiple posts
- Includes image from top-relevance post
- Published 2x daily at: 13:00, 22:00 UTC (8AM EST, 5PM EST)

### Tier 3: Pending Review (Score < 50)

Posts below threshold require manual approval:
- Available in admin panel for review
- Can be manually approved and will enter digest pool

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ENHANCED X POSTING FLOW                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐                                                   │
│  │   Webhook    │  New post from scraper                            │
│  │   /api/      │────────────────────────────────────┐              │
│  │   webhook    │                                    │              │
│  └──────────────┘                                    ▼              │
│                                          ┌────────────────────┐     │
│                                          │  Score >= 50?      │     │
│                                          └─────────┬──────────┘     │
│                                    Yes             │           No   │
│                           ┌────────────────────────┴────────────┐   │
│                           ▼                                     ▼   │
│                  ┌─────────────────┐                 ┌──────────────┐
│                  │ Auto-APPROVED   │                 │ PENDING      │
│                  │ + approvedAt    │                 │ Manual review│
│                  └────────┬────────┘                 └──────────────┘
│                           │                                          │
│         ┌─────────────────┴─────────────────┐                       │
│         ▼                                   ▼                       │
│  ┌─────────────────┐              ┌─────────────────┐               │
│  │ Score >= 85     │              │ Score 50-84     │               │
│  │ (VIP)           │              │ (Digest)        │               │
│  └────────┬────────┘              └────────┬────────┘               │
│           │                                │                         │
│           ▼                                ▼                         │
│  ┌─────────────────┐              ┌─────────────────┐               │
│  │ /api/cron/      │              │ /api/cron/      │               │
│  │ publish         │              │ digest-aggregate│               │
│  │ (5x daily)      │              │ (30 min before) │               │
│  └────────┬────────┘              └────────┬────────┘               │
│           │                                │                         │
│           │                                ▼                         │
│           │                       ┌─────────────────┐               │
│           │                       │ LLM generates   │               │
│           │                       │ digest summary  │               │
│           │                       │ (DeepSeek/GPT)  │               │
│           │                       └────────┬────────┘               │
│           │                                │                         │
│           │                                ▼                         │
│           │                       ┌─────────────────┐               │
│           │                       │ /api/cron/      │               │
│           │                       │ digest          │               │
│           │                       │ (2x daily)      │               │
│           │                       └────────┬────────┘               │
│           │                                │                         │
│           └────────────────┬───────────────┘                        │
│                            ▼                                         │
│                   ┌─────────────────┐                                │
│                   │  Post to X      │                                │
│                   │  + Log to DB    │                                │
│                   └─────────────────┘                                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Schedule (UTC)

| Time (UTC) | Time (EST) | Time (CET) | Action |
|------------|------------|------------|--------|
| 06:00 | 1AM | 7AM | VIP check (EU morning) |
| 12:00 | 7AM | 1PM | VIP check (US morning) |
| 12:30 | 7:30AM | 1:30PM | Digest aggregation |
| **13:00** | **8AM** | **2PM** | **Daily Digest #1** |
| 15:00 | 10AM | 4PM | VIP check (US midday) |
| 18:00 | 1PM | 7PM | VIP check (US afternoon) |
| 21:30 | 4:30PM | 10:30PM | Digest aggregation |
| **22:00** | **5PM** | **11PM** | **Daily Digest #2** + VIP check |

---

## Configuration

### Environment Variables

```bash
# Thresholds
X_VIP_THRESHOLD=85              # Score for individual VIP tweets
X_MIN_RELEVANCE_SCORE=50        # Minimum for auto-approval

# Rate Limits
X_MAX_POSTS_PER_DAY=15          # Maximum total posts per day
X_MAX_VIP_PER_RUN=2             # Maximum VIP posts per cron run

# Toggle
SKIP_X_PUBLISH=true             # Disable posting (for testing)
```

### Config File

Located at `/src/lib/config/posting.ts`:

```typescript
export const POSTING_CONFIG = {
  VIP_THRESHOLD: 85,
  MIN_RELEVANCE_SCORE: 50,
  MAX_POSTS_PER_DAY: 15,
  MAX_VIP_PER_RUN: 2,
  DIGEST_POSTS_PER_TWEET: 4,
  DIGEST_INCLUDE_IMAGE: true,
  VIP_CHECK_HOURS: [6, 12, 15, 18, 22],
  DIGEST_HOURS: [13, 22],
  ADMIN_EMAILS: ["admin@evjuice.com", ...],
  SITE_URL: "https://chinaevnews.com",
  SITE_HASHTAGS: ["#ChinaEV", "#EVNews"],
};
```

---

## Database Schema

### New Fields on Post Model

```prisma
model Post {
  // ... existing fields ...

  // Digest tracking
  includedInDigest  Boolean   @default(false)
  digestTweetId     String?
  approvedAt        DateTime?  // When auto/manually approved

  @@index([status, includedInDigest, approvedAt])
}
```

### New Models

```prisma
model PostingLog {
  id        String   @id @default(cuid())
  postType  String   // "VIP" | "DIGEST" | "MANUAL"
  tweetId   String
  postIds   String[]
  createdAt DateTime @default(now())

  @@index([createdAt])
}

model DigestContent {
  id           String   @id @default(cuid())
  scheduledFor DateTime // 13:00 or 22:00 UTC
  content      String   // LLM-generated tweet text
  postIds      String[]
  topPostId    String   // For image selection
  status       String   @default("PENDING")
  postedAt     DateTime?
  tweetId      String?
  createdAt    DateTime @default(now())

  @@index([scheduledFor])
  @@index([status])
}
```

---

## LLM Digest Generation

### Provider Strategy

1. **Primary**: DeepSeek (cheapest, good Chinese support)
2. **Fallback**: GPT-4o-mini (reliable backup)

### Prompt Template

Located at `/src/lib/config/prompts.ts`:

```
You are a social media editor for China EV News (@chinaevnews).
Summarize these EV news items into an engaging tweet.

Rules:
- Max 250 characters (leave room for link + hashtags)
- Conversational, engaging tone
- Highlight the most impactful news first
- Use 1-2 relevant emojis
- No hashtags or links (added separately)
```

### Example Output

```
🚗 Big day for Chinese EVs! NIO expanded its swap network
while XPeng celebrated a 15% delivery boost. Li Auto eyes
Europe and BYD commits $2B to new production.

🔗 chinaevnews.com
#ChinaEV #EVNews
```

---

## Admin Alerts

Email alerts are sent to configured admins for:

| Alert | Trigger |
|-------|---------|
| **No Digest Content** | No eligible posts for scheduled digest |
| **Digest Failed** | X API error during digest posting |
| **Daily Limit Reached** | MAX_POSTS_PER_DAY exceeded |

Uses Resend email service (existing setup).

---

## API Endpoints

### VIP Publishing

**Endpoint**: `GET /api/cron/publish`

**Schedule**: `0 12 * * *` (daily at 12:00 UTC)

**Logic**:
1. Check daily rate limit
2. Query approved posts with score ≥ 85
3. Post individually with image
4. Log to PostingLog

### Digest Aggregation

**Endpoint**: `GET /api/cron/digest-aggregate`

**Schedule**: `30 12 * * *` (daily at 12:30 UTC)

**Logic**:
1. Query posts with score 50-84 since last digest
2. Generate LLM summary
3. Save to DigestContent table

### Digest Posting

**Endpoint**: `GET /api/cron/digest`

**Schedule**: `0 13 * * *` (daily at 13:00 UTC)

**Logic**:
1. Fetch pre-generated DigestContent
2. Add hashtags and link
3. Get image from top post
4. Post to X
5. Mark posts as includedInDigest

---

## Files

### Created

| File | Purpose |
|------|---------|
| `/src/lib/config/posting.ts` | Configuration constants |
| `/src/lib/config/prompts.ts` | LLM prompts |
| `/src/lib/email/admin-alerts.ts` | Admin email functions |
| `/src/lib/llm/digest.ts` | LLM digest generation |
| `/src/app/api/cron/digest-aggregate/route.ts` | Pre-generate digest content |
| `/src/app/api/cron/digest/route.ts` | Post daily digests |

### Modified

| File | Changes |
|------|---------|
| `/prisma/schema.prisma` | Added digest fields and new models |
| `/src/app/api/webhook/route.ts` | Auto-approval logic |
| `/src/app/api/cron/publish/route.ts` | VIP threshold, rate limiting |
| `/vercel.json` | Cron schedules |
| `/.env.example` | New environment variables |

---

## Verification Checklist

- [ ] Run `npx prisma migrate dev --name add_digest_tables`
- [ ] Verify env vars load with defaults
- [ ] Test VIP posting with score=85 post
- [ ] Test digest with score=60-75 posts
- [ ] Verify admin alert when no digest content
- [ ] Confirm rate limiting works

---

## Cost Impact

| Item | Change |
|------|--------|
| LLM calls | +2 digest generations/day (~$0.01) |
| X API | Same (within free tier) |
| Email | +alerts as needed (minimal) |

**Estimated additional cost**: < $1/month
