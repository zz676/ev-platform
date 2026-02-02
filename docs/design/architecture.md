# EV Platform Architecture Design

> **Last Updated**: February 2025
> **Status**: In Development

## Project Overview

A fully automated platform that aggregates Chinese EV industry content from official company websites and social media, translates to English, and publishes to X (Twitter) while maintaining a bilingual news website.

### Core Requirements

| Requirement | Details |
|------------|---------|
| **Content Sources** | Official websites (primary); Weibo/social media (differentiation) |
| **Target Users** | Overseas Chinese, Investors, EV Industry Professionals, EV Enthusiasts |
| **Automation Level** | Fully Automated |
| **Languages** | English for X; Chinese + English for Website |

### Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Next.js Website | ✅ Done | Next.js 15 + TypeScript + Tailwind |
| i18n (EN/ZH) | ✅ Done | next-intl configured |
| Home Page UI | ✅ Done | Hero, news grid, subscription CTA |
| Prisma Schema | ✅ Done | Post, Subscriber models |
| AI Service | ✅ Done | DeepSeek + OpenAI fallback |
| Supabase Client | ✅ Done | Client + server initialization |
| API Routes | 🔄 In Progress | posts, subscribe, webhook, cron |
| Python Scraper | 🔄 In Progress | Framework being built |
| X Auto-publish | ✅ Done | Cron endpoint with image support |
| X Image Support | ✅ Done | Scraped images + AI fallback (DALL-E 3) |
| Deployment | ⏳ Pending | Vercel + Railway |

---

## Competitive Analysis

### Main Competitor: CnEVPost.com

| Aspect | CnEVPost | Our Platform |
|--------|----------|--------------|
| **Location** | Shanghai-based | Global |
| **Content Style** | Professional news/data | Social media + official news |
| **Perspective** | Investor-focused | Consumer + enthusiast focused |
| **Distribution** | Website-first | X/Twitter-native |
| **Production** | Human editors | AI-automated |
| **Monetization** | Ads (AdThrive) | TBD |

### Our Differentiation

| CnEVPost | Our Platform |
|----------|--------------|
| 📰 Official news/earnings | 🔥 Weibo/Douyin viral content |
| 📊 Monthly sales data | 🎬 Real owner experiences |
| 🏢 Company announcements | 💬 Industry gossip/debates |
| 📈 Investor perspective | 👀 Consumer perspective |
| 🌐 Website-centric | 🐦 X/Twitter-native |
| ✍️ Human editors | 🤖 AI automation |

**Core Advantage**: Social media content + X-native distribution + AI automation

---

## Data Source Strategy (Tiered Architecture)

### Tier 1: Official Websites (Priority - Most Stable)

**New Forces (Startups)**:
| Brand | IR/News Page | Monthly Delivery | English |
|-------|-------------|------------------|---------|
| NIO 蔚来 | https://ir.nio.com/news-events/press-releases | ✅ | ✅ |
| Onvo 乐道 | https://www.onvo.com/ (NIO sub-brand) | ✅ | Partial |
| Firefly 萤火虫 | NIO sub-brand, no independent site yet | - | - |
| XPeng 小鹏 | https://ir.xiaopeng.com/news-releases | ✅ | ✅ |
| Li Auto 理想 | https://ir.lixiang.com/news-releases | ✅ | ✅ |
| Zeekr 极氪 | https://ir.zeekr.com/news-releases | ✅ | ✅ |
| Leapmotor 零跑 | https://ir.leapmotor.com/ | ✅ | ✅ |

**Traditional OEMs (Electrification)**:
| Brand | News Page | English |
|-------|-----------|---------|
| BYD 比亚迪 | https://www.byd.com/en/news | ✅ |
| Geely 吉利 | https://global.geely.com/news | ✅ |
| GWM 长城 | https://www.gwm-global.com/news | ✅ |
| GAC Aion 广汽埃安 | https://www.gac-aion.com/news | Partial |

**Industry Data**:
- CPCA 乘联会: http://www.cpcaauto.com/
- CAAM 中汽协: http://www.caam.org.cn/

### Tier 2: News Media

| Media | URL | Notes |
|-------|-----|-------|
| Sina Auto 新浪汽车 | https://auto.sina.com.cn/ | Major portal |
| 36Kr Auto 36氪汽车 | https://36kr.com/automobile | Deep analysis |
| Autohome 汽车之家 | https://www.autohome.com.cn/ | Comprehensive |
| Dongchedi 懂车帝 | https://www.dongchedi.com/ | ByteDance |
| 电车通 | - | NEV vertical |

### Tier 3: Weibo Accounts (Social Content - Differentiation)

**Official Brand Accounts**:
@蔚来, @乐道汽车, @小鹏汽车, @理想汽车, @比亚迪汽车, @小米汽车, @ZEEKR极氪, @AITO汽车, @极越汽车

**Founders/Executives** (More engaging content):
@李想 (Li Auto CEO), @何小鹏 (XPeng CEO), @李斌 (NIO CEO), @雷军 (Xiaomi), @余承东 (Huawei)

**KOL/Media**:
@电动车公社, @42号车库, @车fans创始人-孙少军, @电车通, @新出行, @懂车帝, @新车部落

**Hashtags to Monitor**:
#比亚迪# #蔚来# #小鹏# #理想# #小米汽车# #极氪# #问界# #电动车# #新能源车#

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EV PLATFORM ARCHITECTURE v2                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         SOURCE ADAPTER LAYER                                │
│              (Each source is independent, failure-isolated)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │  Official   │ │   News      │ │   Weibo     │ │   Manual    │          │
│  │  Websites   │ │   Media     │ │  (Optional) │ │   Import    │          │
│  │  Adapter    │ │  Adapter    │ │  Adapter    │ │  Adapter    │          │
│  │  (Stable)   │ │  (Medium)   │ │ (Unstable)  │ │  (Backup)   │          │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘          │
│         └───────────────┴───────────────┴───────────────┘                  │
│                                  │                                          │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AI PROCESSING LAYER                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Primary: DeepSeek V3  │  Fallback: GPT-4o-mini                     │   │
│  │  ($0.27/$1.1 per M)    │  ($0.15/$0.6 per M)                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                        │
│  │   Filter    │  │  Translate  │  │  Summarize  │                        │
│  │  (Score)    │  │  (CN → EN)  │  │ (X Post)    │                        │
│  └─────────────┘  └─────────────┘  └─────────────┘                        │
│                                                                             │
│  Using Function Calling for structured output                               │
│                                                                             │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATA STORAGE LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌───────────────────────────┐                            │
│                    │   Supabase (PostgreSQL)   │                            │
│                    │                           │                            │
│                    │  • Posts (CN + EN)        │                            │
│                    │  • Subscribers            │                            │
│                    │  • Analytics              │                            │
│                    │                           │                            │
│                    │  Free tier: 500MB DB      │                            │
│                    └───────────────────────────┘                            │
│                                                                             │
└──────────────┬──────────────────────────────────────────┬───────────────────┘
               │                                          │
               ▼                                          ▼
┌──────────────────────────────────┐    ┌──────────────────────────────────────┐
│     NEXT.JS WEBSITE (Vercel)     │    │      X AUTO-PUBLISHER                │
├──────────────────────────────────┤    ├──────────────────────────────────────┤
│                                  │    │                                      │
│  • News feed (infinite scroll)   │    │  • 3-5 posts per day                 │
│  • Bilingual (EN/CN toggle)      │    │  • Vercel Cron scheduling            │
│  • Category filters              │    │  • Rate limiting                     │
│  • Email subscription            │    │  • Auto hashtags                     │
│  • SEO optimized                 │    │  • Link to website                   │
│                                  │    │                                      │
└──────────────────────────────────┘    └──────────────────────────────────────┘
```

---

## Technology Stack

### Frontend & Backend (Unified)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Framework** | Next.js 15 | Server-side rendering, API routes, great DX |
| **Language** | TypeScript 5.5 | Type safety, better maintainability |
| **Styling** | Tailwind CSS 3.4 | Rapid UI development |
| **UI Components** | shadcn/ui + Lucide React | High-quality, customizable components |
| **i18n** | next-intl 3.17 | Bilingual support (EN/ZH) |
| **Validation** | Zod 3.23 | Runtime type validation |

### Database

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Database** | Supabase (PostgreSQL) | Free tier generous, real-time features |
| **ORM** | Prisma | Type-safe queries, easy migrations |

### Scraper Service

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Language** | Python 3.11+ | Rich ecosystem for scraping |
| **HTTP Client** | requests/httpx | Simple for static sites |
| **Browser Automation** | Playwright | For dynamic pages (Weibo) |

### AI Processing

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Primary LLM** | DeepSeek V3 | Best Chinese support, lowest cost |
| **Fallback LLM** | GPT-4o-mini | Stable, reliable backup |
| **API Format** | OpenAI-compatible | Easy provider switching |

### Deployment

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Website** | Vercel | Optimized for Next.js, free tier |
| **Scraper** | Railway | Easy Python deployment, $5/mo |
| **Cron Jobs** | Vercel Cron | Free, simple configuration |

---

## AI Service Design

### Provider Abstraction with Automatic Fallback

```typescript
class AIService {
  private providers = [
    { name: 'deepseek', baseUrl: 'https://api.deepseek.com', timeout: 5000 },
    { name: 'openai', baseUrl: 'https://api.openai.com/v1', timeout: 10000 },
  ];

  async complete(prompt: string): Promise<string> {
    for (const provider of this.providers) {
      try {
        const start = Date.now();
        const result = await this.callProvider(provider, prompt);
        console.log(`${provider.name}: ${Date.now() - start}ms`);
        return result;
      } catch (error) {
        console.warn(`${provider.name} failed, trying next...`);
        continue;
      }
    }
    throw new Error('All AI providers failed');
  }
}
```

### Function Calling for Structured Output

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "process_ev_content",
            "description": "Process EV content and generate structured output",
            "parameters": {
                "type": "object",
                "properties": {
                    "relevance_score": {
                        "type": "integer",
                        "description": "Content value score 0-100"
                    },
                    "categories": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Category tags"
                    },
                    "translated_title": {
                        "type": "string",
                        "description": "English title"
                    },
                    "translated_content": {
                        "type": "string",
                        "description": "Full English content"
                    },
                    "x_summary": {
                        "type": "string",
                        "description": "X post summary (max 250 chars)"
                    },
                    "hashtags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Recommended hashtags"
                    }
                },
                "required": ["relevance_score", "categories", "translated_title", "x_summary"]
            }
        }
    }
]
```

---

## Data Models

### Post Schema (Prisma)

```prisma
model Post {
  id                String   @id @default(cuid())

  // Source Information
  sourceId          String   @unique
  source            Source   // OFFICIAL, MEDIA, WEIBO
  sourceUrl         String
  sourceAuthor      String
  sourceDate        DateTime

  // Original Content (Chinese)
  originalTitle     String?
  originalContent   String   @db.Text
  originalMediaUrls String[]

  // Translated Content (English)
  translatedTitle   String?
  translatedContent String   @db.Text
  translatedSummary String   // For X posts (short)

  // Metadata
  categories        String[]
  relevanceScore    Int      // 0-100

  // Publishing Status
  status            PostStatus @default(PENDING)
  publishedToX      Boolean    @default(false)
  xPostId           String?
  xPublishedAt      DateTime?

  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

enum Source {
  OFFICIAL  // Company IR pages
  MEDIA     // News sites
  WEIBO     // Social media
  MANUAL    // Manual import
}

enum PostStatus {
  PENDING
  APPROVED
  PUBLISHED
  REJECTED
}
```

### Subscriber Schema

```prisma
model Subscriber {
  id          String    @id @default(cuid())
  email       String    @unique
  language    Language  @default(EN)
  categories  String[]
  frequency   Frequency @default(DAILY)
  verified    Boolean   @default(false)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

enum Language {
  EN
  ZH
}

enum Frequency {
  DAILY
  WEEKLY
}
```

---

## X Post Image Support

### Hybrid Image Strategy

X posts with images get significantly higher engagement. We use a hybrid approach:

| Priority | Source | Cost | Quality |
|----------|--------|------|---------|
| 1 | Scraped from original article | Free | Original/authentic |
| 2 | AI-generated (DALL-E 3) | ~$0.04/image | Professional, EV-themed |
| 3 | Text-only (fallback) | Free | Lower engagement |

### Implementation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    X Post Publishing Flow                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌─────────────────┐     ┌──────────────┐ │
│  │ Post Ready  │ ──▶ │ Check for       │ ──▶ │ Has scraped  │ │
│  │ to Publish  │     │ originalMediaUrls│     │ image?       │ │
│  └─────────────┘     └─────────────────┘     └──────┬───────┘ │
│                                                      │         │
│                             ┌────────────────────────┴────┐    │
│                             │ Yes                    No   │    │
│                             ▼                        ▼    │    │
│                  ┌──────────────────┐   ┌────────────────────┐ │
│                  │ Use scraped URL  │   │ Generate AI image  │ │
│                  │ (free)           │   │ (DALL-E 3, $0.04)  │ │
│                  └────────┬─────────┘   └──────────┬─────────┘ │
│                           │                        │           │
│                           └───────────┬────────────┘           │
│                                       ▼                        │
│                          ┌────────────────────────┐            │
│                          │ Upload to X Media API  │            │
│                          │ (v2 media/upload)      │            │
│                          └───────────┬────────────┘            │
│                                      │                         │
│                                      ▼                         │
│                          ┌────────────────────────┐            │
│                          │ Post tweet with        │            │
│                          │ media_ids (v2 API)     │            │
│                          └────────────────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### X API Endpoints

| Endpoint | Version | Purpose |
|----------|---------|---------|
| `https://api.x.com/2/media/upload` | v2 | Media upload (images) |
| `https://api.x.com/2/tweets` | v2 | Tweet posting |

**Note**: X has fully migrated to `api.x.com` domain (as of 2025). The old `twitter.com` endpoints are deprecated.

### AI Image Generation (DALL-E 3)

When no scraped image is available, we generate a professional EV-themed image:

```typescript
// Prompt template for DALL-E 3
const imagePrompt = `A professional, modern photograph style image for an electric vehicle news article.
Topic: ${title}
Context: ${summary.slice(0, 200)}

Style requirements:
- Clean, professional news/tech media aesthetic
- Feature electric vehicles, charging infrastructure, or EV technology
- Modern urban or tech environment
- Vibrant but realistic colors
- No text or logos in the image
- High quality, suitable for social media`;
```

**Cost breakdown**:
- DALL-E 3 (1024x1024, standard): ~$0.04 per image
- At 3-5 posts/day with 50% AI generation: ~$2-3/month

### Files Involved

| File | Function |
|------|----------|
| `src/lib/twitter.ts` | `uploadMedia()` - Upload images to X |
| `src/lib/ai.ts` | `generatePostImage()` - DALL-E 3 generation |
| `src/app/api/cron/publish/route.ts` | Orchestrates image selection and posting |

---

## X Post Format

### Template

```
🚗 {category} | {title}

{summary}

📊 Source: {source}
🔗 {website_url}

{hashtags}
```

### Example - CnEVPost Style vs Our Style

**CnEVPost Style** (dry, factual):
```
NIO delivers 20,544 vehicles in January 2025
```

**Our Style** (engaging, social):
```
🚗 Sales | NIO January Deliveries: 20K+

But here's what Weibo owners are actually saying:
2-hour waits at battery swap stations during holidays!
NIO's growth vs infrastructure challenge continues... 🧵

📊 Source: NIO Official + Weibo
🔗 evnews.com/p/abc123

#ChinaEV #NIO #BatterySwap #EVInfrastructure
```

---

## Cost Estimation (Monthly)

| Service | Tier | Estimated Cost |
|---------|------|----------------|
| Vercel | Free/Pro | $0-20 |
| Supabase | Free | $0 |
| Railway (Scraper) | Starter | $5 |
| DeepSeek API | Usage | $5-15 |
| OpenAI (DALL-E 3) | Usage | $2-5 |
| X API | Basic | $100 |
| **Total** | | **$112-145/mo** |

**Note**: DALL-E 3 costs ~$0.04/image for AI-generated post images when no scraped image is available.

---

## Implementation Phases

### Phase 1: Foundation
1. Initialize Next.js project with TypeScript, Tailwind, shadcn/ui
2. Set up Supabase database with Prisma schema
3. Configure DeepSeek/OpenAI API
4. Build basic UI components

### Phase 2: Website MVP
5. Implement news feed (static/mock data first)
6. Build article detail page
7. Add language toggle (next-intl)
8. Implement subscription form

### Phase 3: Scraper System
9. Build Python scraper framework
10. **Priority: Official website scrapers** (NIO, XPeng, Li Auto, BYD)
11. Implement AI processing pipeline (Function Calling)
12. Connect scraper to Supabase
13. **Optional: Weibo public data scraper**

---

## Scraper Date Extraction

### Problem

Web scrapers often fail to extract publication dates correctly because:
1. CSS selectors don't match actual HTML structure
2. Date elements may be on detail pages, not listing pages
3. Empty strings passed to date parser cause silent fallbacks to `datetime.now()`

### Solution: Multi-Layer Date Extraction

The scraper uses a fallback chain to maximize date extraction accuracy:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Date Extraction Fallback Chain               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │ 1. Listing Page │ ──▶ │ Date found?     │                   │
│  │    Selectors    │     │                 │                   │
│  └─────────────────┘     └────────┬────────┘                   │
│                                   │                             │
│                    ┌──────────────┴──────────────┐              │
│                    │ Yes                    No   │              │
│                    ▼                        ▼    │              │
│           ┌──────────────┐     ┌─────────────────┐             │
│           │ Use listing  │     │ 2. Detail Page  │             │
│           │ page date    │     │    Meta Tags    │             │
│           └──────────────┘     └────────┬────────┘             │
│                                         │                       │
│                          ┌──────────────┴──────────────┐        │
│                          │ Yes                    No   │        │
│                          ▼                        ▼    │        │
│                 ┌──────────────┐     ┌─────────────────┐       │
│                 │ Use meta     │     │ 3. Detail Page  │       │
│                 │ tag date     │     │    Selectors    │       │
│                 └──────────────┘     └────────┬────────┘       │
│                                               │                 │
│                                ┌──────────────┴──────────────┐  │
│                                │ Yes                    No   │  │
│                                ▼                        ▼    │  │
│                       ┌──────────────┐     ┌─────────────────┐ │
│                       │ Use detail   │     │ 4. Fallback to  │ │
│                       │ selector date│     │    datetime.now │ │
│                       └──────────────┘     │    + WARNING    │ │
│                                            └─────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Base Class Methods (`sources/base.py`)

| Method | Purpose |
|--------|---------|
| `_extract_date_from_meta(soup)` | Extract from `<meta>` tags like `article:published_time` |
| `_extract_date_from_selectors(soup, selectors)` | Try multiple CSS selectors |
| `_extract_date_from_url(url)` | Extract date embedded in URL patterns (e.g., `/news/20250920001`) |
| `_parse_date_robust(date_str)` | Parse date, return `None` on failure (not `datetime.now()`) |
| `_parse_date_with_fallback(date_str, url)` | Final fallback with warning log |

### Meta Tags Checked

```html
<meta property="article:published_time" content="...">
<meta name="datePublished" content="...">
<meta name="pubdate" content="...">
<meta name="publish_date" content="...">
<meta itemprop="datePublished" content="...">
<meta property="og:article:published_time" content="...">
<time datetime="...">
<time pubdate datetime="...">
```

### URL Pattern Extraction

For sites with React/Vue rendering where HTML extraction fails, dates can be extracted from URL patterns:

| Pattern | Example | Extracted |
|---------|---------|-----------|
| `/news/YYYYMMDD###` | `/news/20250920001` | 2025-09-20 |
| `/YYYY/MM/DD/` | `/2025/09/20/article` | 2025-09-20 |
| `YYYY-MM-DD` | `/article-2025-09-20` | 2025-09-20 |

This is particularly useful for **NIO** which uses React client-side rendering but embeds dates in URLs.

### Source-Specific Selectors

| Source | Detail Page Selectors |
|--------|----------------------|
| **NIO** | URL pattern (`/news/YYYYMMDD###`), fallback to CSS selectors |
| **BYD** | `.article-date`, `.news-date`, `[class*='article'] .date` |
| **XPeng/Li Auto** | `.nir-widget--news-date`, `.nir-widget--field-date`, `[class*='nir'] time` |

### Weibo Date Parsing

Weibo uses relative date formats that require special handling:

| Format | Example | Meaning |
|--------|---------|---------|
| 刚刚 | - | Just now |
| X分钟前 | 5分钟前 | 5 minutes ago |
| X小时前 | 2小时前 | 2 hours ago |
| 昨天 HH:MM | 昨天 14:30 | Yesterday at 14:30 |
| MM-DD | 01-20 | Month-day (current year) |
| YYYY-MM-DD | 2025-01-15 | Full date |

### Warning Logs

When date extraction fails completely, a warning is logged:

```
WARNING: Could not extract date for https://example.com/article, using current time
```

This helps identify sources that need selector updates without breaking the scraper.

### Files Involved

| File | Responsibility |
|------|----------------|
| `scraper/sources/base.py` | Base class with shared date extraction methods |
| `scraper/sources/nio.py` | NIO-specific selectors, returns 3-tuple from `_fetch_full_article` |
| `scraper/sources/byd.py` | BYD-specific selectors |
| `scraper/sources/xpeng.py` | XPeng IR (nir-widget) selectors |
| `scraper/sources/li_auto.py` | Li Auto IR (nir-widget) selectors |
| `scraper/sources/weibo.py` | Weibo relative date parsing |

### Phase 4: X Publishing
14. Configure X API developer account
15. Implement auto-publishing logic
16. Set up Vercel Cron jobs

### Phase 5: Deploy & Launch
17. Deploy Next.js to Vercel
18. Deploy scraper to Railway
19. Configure domain and SSL
20. Set up monitoring (Vercel Analytics)

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data Source Priority | Official websites > Media > Weibo | Stability, legality |
| Primary AI | DeepSeek V3 | Best Chinese, lowest cost |
| Fallback AI | GPT-4o-mini | Stable, reliable |
| Database | Supabase | Generous free tier |
| Deployment | Vercel + Railway | Easy, low cost |
| Differentiation | Social content + X-native | Compete vs CnEVPost |

---

## API Keys Configuration Status

| Key | Status | Purpose |
|-----|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Configured | Supabase API endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Configured | Supabase client auth |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Configured | Supabase server admin |
| `DATABASE_URL` | ⚠️ Needs password | Prisma PostgreSQL connection |
| `OPENAI_API_KEY` | ✅ Configured | AI fallback (GPT-4o-mini) + DALL-E 3 images |
| `DEEPSEEK_API_KEY` | ⏳ Pending | AI primary (DeepSeek V3) |
| `X_API_KEY` | ✅ Configured | X/Twitter API |
| `X_API_SECRET` | ✅ Configured | X/Twitter API |
| `X_ACCESS_TOKEN` | ✅ Configured | X/Twitter API |
| `X_ACCESS_TOKEN_SECRET` | ✅ Configured | X/Twitter API |
| `X_BEARER_TOKEN` | ✅ Configured | X/Twitter API |
| `RESEND_API_KEY` | ✅ Configured | Email service |

---

## Directory Structure

```
/ev-platform
├── /src
│   ├── /app
│   │   ├── /[locale]           # i18n routes (en, zh)
│   │   │   ├── layout.tsx      # Root layout with i18n
│   │   │   └── page.tsx        # Home page
│   │   ├── /api                # API routes (to be added)
│   │   └── globals.css         # Tailwind styles
│   ├── /components
│   │   └── /ui                 # shadcn/ui components
│   ├── /i18n
│   │   ├── routing.ts          # Locale config
│   │   └── request.ts          # Server-side i18n
│   ├── /lib
│   │   ├── ai.ts               # AI service (DeepSeek + OpenAI)
│   │   ├── supabase.ts         # Supabase client
│   │   └── utils.ts            # Utility functions
│   ├── /messages
│   │   ├── en.json             # English translations
│   │   └── zh.json             # Chinese translations
│   └── middleware.ts           # i18n middleware
├── /prisma
│   └── schema.prisma           # Database schema
├── /scraper                    # Python scraper (separate)
│   ├── /sources                # Source adapters
│   ├── /processors             # AI processing
│   └── main.py                 # Entry point
├── /docs
│   └── /design                 # Design documentation
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
└── .env.example
```
