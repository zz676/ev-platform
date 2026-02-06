# Data API SaaS - Design Document

## Overview

Transform the EV Platform's automated data pipeline and structured database into a subscription-based API service for the China EV market intelligence industry.

## Strategic Rationale

### Core Asset
The platform's competitive advantage lies in its **automated data pipeline** (scrapers + AI translation + structured storage), not in content presentation or social media reach. An API SaaS is the most direct path to monetizing this asset.

### Market Gap
- Existing China EV data services (SNE Research, CPCA reports) sell static PDF reports at high prices ($2,000+/report)
- No affordable, programmatic API access exists for China EV market data
- Competitors (ChinaEVHome, etc.) are content sites without structured data backends
- Our tech stack (Next.js + Prisma + PostgreSQL) already supports API delivery with minimal additions

### Target Customers
| Segment | Use Case | Price Sensitivity |
|---------|----------|-------------------|
| Hedge funds / Investment analysts | Track China EV trends for investment decisions | Low (highest willingness to pay) |
| Consulting firms | Source data for industry reports | Medium |
| EV industry media / bloggers | Data for content creation | High |
| Supply chain companies | Track battery & component market | Medium |
| Automaker overseas teams | Monitor competitor performance in China | Low-Medium |

---

## Data Products

### Tier 1: Brand Metrics
- Monthly deliveries, sales, wholesale, production by brand
- YoY/MoM change calculations
- Market share and ranking
- Brands: BYD, NIO, XPeng, Li Auto, Zeekr, Xiaomi, Tesla China, Leapmotor, Geely

### Tier 2: Industry Metrics (High Scarcity)
| Data | Source | Scarcity |
|------|--------|----------|
| Plant-level export volumes | China Customs / company announcements | Very High |
| Battery maker monthly installations (China + Global) | CABIA / SNE Research | High |
| Dealer inventory coefficient | CADA | High |
| Vehicle Inventory Alert Index (VIA) | CADA | High |
| NEV retail vs wholesale vs production | CPCA / CAAM | High |
| Passenger vehicle inventory levels | CPCA | High |

### Tier 3: Vehicle Specs Database
- Pricing (starting, current in RMB)
- Dimensions, performance, battery specs
- Charging capabilities
- Vehicle type (BEV, PHEV, EREV) and segment classification

### Tier 4: Chart API (Value-Add)
- Users pass data parameters, receive generated chart images
- Chart types: brand trends, leaderboards, market share, battery rankings
- Leverages existing Chart.js + canvas rendering pipeline

---

## Pricing Model

| Tier | Data Access | Rate Limit | Price |
|------|-------------|------------|-------|
| **Free** | Brand deliveries only, 30-day delay | 100 calls/day | $0 |
| **Starter** | All brand metrics, full history | 1,000 calls/day | $49-99/mo |
| **Pro** | All data + plant exports + battery data + chart API + webhooks | 10,000 calls/day | $199-499/mo |
| **Enterprise** | Full API + bulk export + custom queries + SLA | Unlimited | Custom pricing |

---

## Current State Assessment

### Schema vs. Reality Gap

The database schema is well-designed but severely under-populated:

| Component | Schema Capacity | Actual Data | Fill Rate |
|-----------|----------------|-------------|-----------|
| Brands covered | 9 brands | 4 actively scraped | 44% |
| Metric types | 8 types | Mostly DELIVERY only | ~25% |
| Industry tables | 12 specialized tables | 10 completely empty | ~5% |
| Historical depth | 10+ years supported | 2-3 months actual | ~2% |
| Vehicle specs | Full spec sheet | 30-50 models | Partial |
| Data validation | None implemented | N/A | 0% |

### Critical Gaps
1. **BYD missing** - Largest China EV brand, no scraper (Vue.js client-side rendering requires Playwright)
2. **10 empty industry tables** - CaamNevSales, CpcaNevRetail, CpcaNevProduction, ChinaBatteryInstallation, ChinaPassengerInventory, ChinaDealerInventoryFactor, ChinaViaIndex, NevSalesSummary, AutomakerRankings, BatteryMakerRankings
3. **No historical backfill** - 2-3 months is insufficient for any analytical use case; investors need 2-3 years minimum
4. **No data validation** - Data inserted directly without outlier detection, temporal consistency checks, or bounds validation
5. **Weibo date inaccuracy** - ~40% of Weibo-sourced posts may have fallback dates; `backfill_dates.py` exists but never executed
6. **Confidence scores not populated** - Nearly all records default to 1.0 regardless of extraction method

---

## Implementation Roadmap

### Phase 1: Data Foundation (Prerequisites)

**Goal**: Fill the database to a level where the API has credible, sellable data.

#### 1.1 Historical Backfill
- Run CnEVData backfill with OCR enabled (~500+ articles)
- Enable industry data classification extraction during backfill
- Estimated cost: $5-10 for OCR processing
- Target: 2-3 years of monthly data across all industry tables

#### 1.2 Fill Industry Tables
- Enable dual-write pipeline for all 12 industry tables
- Implement extraction logic for: CAAM NEV sales, CPCA retail/production, battery installations, dealer inventory, VIA index
- Validate data flows from scraper → classification → industry table insertion

#### 1.3 Add BYD Scraper
- Implement Playwright-based scraper for BYD official site (Vue.js SPA)
- Extract delivery/sales announcements
- Priority: BYD is the #1 brand; without it, the product lacks credibility

#### 1.4 Weibo Date Repair
- Execute `backfill_dates.py` across all historical Weibo posts
- Validate and flag records with suspected fallback dates
- Mark repaired records with appropriate confidence scores

#### 1.5 Expand Brand Coverage
- Add scrapers for: Zeekr, Leapmotor, Geely (if official sources available)
- Evaluate additional sources: GAC Aion, Changan, SAIC

### Phase 2: Data Quality

**Goal**: Ensure data reliability meets SaaS customer expectations.

#### 2.1 Pre-Insert Validation Layer
- Production >= sales check (per brand, per month)
- Outlier detection (values > 3x standard deviation from trailing average)
- Temporal continuity (no impossible month-to-month jumps)
- Required field validation (no null values in critical columns)

#### 2.2 Confidence Score Implementation
- OCR-extracted data: confidence = 0.8-0.9
- Title/summary parsed: confidence = 1.0
- Weibo-sourced with date repair: confidence = 0.7-0.8
- Expose confidence scores in API responses

#### 2.3 Anomaly Detection
- Automated alerts when new data deviates significantly from historical patterns
- Manual review queue for flagged anomalies before API exposure
- Rate-of-change monitoring across all time series

#### 2.4 Data Completeness Dashboard
- Internal dashboard showing % fill rate per table, per month
- Track data freshness (time since last update per table)
- Alert when expected monthly data is missing (e.g., no CPCA data by 15th of month)

### Phase 3: API Productization

**Goal**: Build the API product layer on top of validated data.

#### 3.1 Authentication & API Key Management
- User registration with email verification
- API key generation (one key per tier)
- Key rotation support
- Dashboard for users to view their keys and usage

#### 3.2 Rate Limiting
- Per-tier rate limits enforced at API gateway level
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Graceful 429 responses with retry-after

#### 3.3 API Endpoints Design
```
GET /api/v1/brands                     # List all brands
GET /api/v1/brands/:brand/metrics      # Brand metrics (delivery, sales, etc.)
GET /api/v1/industry/nev-sales         # CAAM NEV sales
GET /api/v1/industry/retail            # CPCA retail data
GET /api/v1/industry/production        # CPCA production data
GET /api/v1/industry/battery           # Battery installation data
GET /api/v1/industry/inventory         # Dealer inventory & VIA index
GET /api/v1/industry/exports           # Plant-level exports
GET /api/v1/battery-makers             # Battery maker rankings & monthly data
GET /api/v1/vehicles                   # Vehicle specs database
GET /api/v1/charts/:type               # Chart image generation
GET /api/v1/rankings/:period           # Automaker/battery rankings
```

Query parameters: `year`, `month`, `from`, `to`, `brand`, `format` (json/csv)

#### 3.4 Payment Integration (Stripe)
- Subscription management (monthly billing)
- Tier upgrade/downgrade
- Usage-based overage billing (optional for Enterprise)
- Free tier with no credit card required

#### 3.5 API Documentation
- Auto-generated OpenAPI/Swagger spec
- Interactive documentation page (Swagger UI or Redoc)
- Code examples in Python, JavaScript, cURL
- Changelog for API versions

#### 3.6 Data Freshness Controls
- Free tier: 30-day data delay enforced at query layer
- Paid tiers: Real-time access
- `data_as_of` timestamp in every API response
- Webhook notifications when new monthly data is available (Pro+)

---

## Technical Architecture

```
Current Stack (no changes needed):
├── Next.js 15 (API routes)
├── Prisma ORM (PostgreSQL)
├── Vercel (hosting)
└── Chart.js + Canvas (chart generation)

New Components:
├── API Key middleware (Next.js middleware)
├── Rate limiter (upstash/ratelimit or custom Redis)
├── Usage tracker (PostgreSQL table)
├── Stripe integration (stripe-node)
├── OpenAPI spec generator (next-swagger-doc or manual)
└── Webhook dispatcher (for Pro tier notifications)
```

### Database Additions
```
ApiKey
├── id, userId, key (hashed), tier, isActive
├── createdAt, lastUsedAt, expiresAt
└── rateLimitOverride (optional)

ApiUsage
├── id, apiKeyId, endpoint, timestamp
├── responseTime, statusCode
└── Indexed by (apiKeyId, timestamp) for billing queries

Subscription
├── id, userId, stripeCustomerId, stripeSubscriptionId
├── tier, status, currentPeriodStart, currentPeriodEnd
└── cancelAtPeriodEnd
```

---

## Success Metrics

| Metric | Phase 1 Target | Phase 3 Target |
|--------|---------------|----------------|
| Industry tables filled | 12/12 | 12/12 |
| Historical data depth | 2+ years | 3+ years |
| Data validation coverage | Core checks | Full suite |
| API uptime | N/A | 99.5% |
| Free tier users | N/A | 50+ |
| Paid subscribers | N/A | 5-10 |
| Monthly recurring revenue | $0 | $500-2,000 |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Source websites block scrapers | Data stops flowing | Multiple sources per data point; manual fallback |
| Data quality issues erode trust | Customer churn | Validation layer + confidence scores + anomaly alerts |
| Low demand / no paying customers | No revenue | Free tier validates demand before building paid features |
| Competitor launches similar API | Market share loss | Speed to market + data depth advantage |
| CnEVData paywall tightens | Historical backfill blocked | Prioritize backfill early; diversify sources |

---

## Open Questions

1. Should the free tier require registration, or allow anonymous access with IP-based rate limiting?
2. What is the minimum viable historical depth before launching (1 year? 2 years?)
3. Should chart API be a separate product or bundled with data tiers?
4. Enterprise tier: self-serve or sales-assisted?
