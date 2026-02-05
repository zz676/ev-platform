# LLM-Powered X Posts from EV Industry Data

## Overview
Generate engaging X (Twitter) posts from comprehensive EV industry data using LLM. Posts include **auto-generated chart images** for visual impact. Features both pre-defined metric posts and a flexible Data Explorer for custom queries.

---

## Available Data Sources

The platform aggregates data from multiple authoritative sources covering all aspects of China's EV industry:

### 1. Brand-Level Delivery/Sales Data

| Table | Description | Key Fields | Use Cases |
|-------|-------------|------------|-----------|
| **EVMetric** | Core delivery/sales metrics by brand | `brand`, `metric`, `periodType`, `year`, `period`, `value`, `yoyChange`, `momChange`, `marketShare`, `ranking` | Brand comparisons, monthly trends, YoY analysis |
| **AutomakerRankings** | Monthly automaker sales rankings | `automaker`, `ranking`, `value`, `marketShare`, `yoyChange` | Leaderboards, competitive analysis |

**Brands tracked:** BYD, NIO, XPeng, Li Auto, Zeekr, Xiaomi, Tesla China, Leapmotor, Geely, Other

### 2. Industry-Level Market Data

| Table | Description | Key Fields | Use Cases |
|-------|-------------|------------|-----------|
| **CaamNevSales** | CAAM official NEV sales (includes exports) | `year`, `month`, `value`, `yoyChange`, `momChange` | Total market size, official statistics |
| **CpcaNevRetail** | CPCA NEV retail sales (consumer registrations) | `year`, `month`, `value`, `yoyChange`, `momChange` | Consumer demand, retail trends |
| **CpcaNevProduction** | CPCA NEV production volume | `year`, `month`, `value`, `yoyChange`, `momChange` | Manufacturing output, supply analysis |
| **NevSalesSummary** | Weekly/bi-weekly sales flash reports | `startDate`, `endDate`, `retailSales`, `wholesaleSales`, `retailYoy` | Early month tracking, weekly trends |

### 3. Market Health Indicators

| Table | Description | Key Fields | Interpretation |
|-------|-------------|------------|----------------|
| **ChinaPassengerInventory** | Dealer + factory inventory levels | `year`, `month`, `value` (million units) | High = oversupply, Low = strong demand |
| **ChinaDealerInventoryFactor** | Dealer inventory coefficient (库存系数) | `year`, `month`, `value` (ratio) | >1.5 = oversupply pressure, <0.8 = shortage |
| **ChinaViaIndex** | Vehicle Inventory Alert Index | `year`, `month`, `value` (%) | >50% = contraction/stress, <50% = healthy (inverse PMI) |

### 4. Battery Industry Data

| Table | Description | Key Fields | Use Cases |
|-------|-------------|------------|-----------|
| **ChinaBatteryInstallation** | Total battery installation & production | `year`, `month`, `installation`, `production` (GWh) | EV adoption proxy, supply chain health |
| **BatteryMakerMonthly** | Battery maker performance | `maker`, `year`, `month`, `installation`, `yoyChange` | CATL vs BYD, competitive analysis |
| **BatteryMakerRankings** | Battery maker market share rankings | `maker`, `ranking`, `value`, `marketShare`, `scope` (CHINA/GLOBAL) | Market dominance, global competition |

**Battery makers tracked:** CATL, BYD, CALB, Gotion, EVE, Sunwoda, LG, SK, Panasonic, Samsung SDI

### 5. Export & Production Data

| Table | Description | Key Fields | Use Cases |
|-------|-------------|------------|-----------|
| **PlantExports** | Exports by manufacturing plant | `plant`, `brand`, `year`, `month`, `value`, `yoyChange` | Tesla Shanghai exports, regional analysis |

### 6. Vehicle Specifications

| Table | Description | Key Fields | Use Cases |
|-------|-------------|------------|-----------|
| **VehicleSpec** | Vehicle specs (price, range, performance) | `brand`, `model`, `variant`, `startingPrice`, `rangeCltc`, `acceleration`, `batteryCapacity` | Spec comparisons, price analysis |

---

## Post Types

### 1. Brand Monthly Trend Post (per brand)
Shows 12-month delivery trend for a single brand with month-by-month YoY comparison.

**Example:**
```
🔋 BYD 2025 Monthly Deliveries

Jan: 210K (vs 145K in '24, +45%)
Feb: 185K (vs 160K in '24, +16%)
Mar: 220K (vs 180K in '24, +22%)
...
Dec: 250K (vs 200K in '24, +25%)

📈 Total 2025: 2.5M (+28% YoY)
```

**Data shown:**
- Each month's delivery count
- Same month previous year for comparison
- YoY % change per month
- Running total or year total

### 2. All Brands Comparison Post (monthly leaderboard)
Shows all brands ranked by deliveries for a single month.

**Example:**
```
🏆 Jan 2025 China EV Deliveries

1️⃣ BYD: 210K (+45% YoY)
2️⃣ Tesla China: 85K (+12%)
3️⃣ Li Auto: 52K (+38%)
4️⃣ NIO: 21K (-5%)
5️⃣ XPeng: 18K (+22%)
6️⃣ Zeekr: 15K (+85%)
7️⃣ Xiaomi: 12K (NEW)

Total NEV: 620K units
```

**Data shown:**
- All brands ranked by delivery volume
- Delivery count per brand
- YoY % change per brand
- Industry total

---

## Chart Image Generation (Self-Hosted)

Each X post will include an auto-generated chart image for visual impact.

### Technology Stack
- **chart.js** - Charting library
- **chartjs-node-canvas** - Server-side rendering to PNG
- **@napi-rs/canvas** - Fast native canvas implementation for Node.js

### Chart Types by Post

#### Brand Monthly Trend Chart
Grouped bar chart comparing current year vs previous year:

```
┌────────────────────────────────────────────────────┐
│  NIO Monthly Deliveries: 2024 vs 2025              │
│                                                    │
│  50K ┤                                    ████     │
│      │                              ░░░░  ████     │
│  40K ┤                        ░░░░  ████  ████     │
│      │                  ░░░░  ████  ████  ████     │
│  30K ┤            ████  ████  ████  ████  ████     │
│      │      ░░░░  ████  ████  ████  ████  ████     │
│  20K ┤░░░░  ████  ████  ████  ████  ████  ████     │
│      │████  ████  ████  ████  ████  ████  ████     │
│  10K ┤████  ████  ████  ████  ████  ████  ████     │
│      │████  ████  ████  ████  ████  ████  ████     │
│   0  └─────────────────────────────────────────    │
│       Jan  Feb  Mar  Apr  May  Jun  Jul  ...       │
│                                                    │
│       ░░░░ 2024    ████ 2025                       │
└────────────────────────────────────────────────────┘
```

**Chart config:**
- Type: Grouped bar chart
- Colors: Light blue (2024) vs Dark blue (2025)
- Data labels on top of each bar
- Legend at bottom
- Brand logo/emoji in title (optional)

#### All Brands Comparison Chart
Horizontal bar chart ranking all brands:

```
┌────────────────────────────────────────────────────┐
│  Jan 2025 China EV Deliveries                      │
│                                                    │
│  BYD          ████████████████████████████  210K   │
│  Tesla        ████████████  85K                    │
│  Li Auto      ████████  52K                        │
│  NIO          ████  21K                            │
│  XPeng        ███  18K                             │
│  Zeekr        ██  15K                              │
│  Xiaomi       ██  12K                              │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Chart config:**
- Type: Horizontal bar chart
- Single color with gradient or brand colors
- Data labels at end of each bar
- Sorted by value (descending)

### Chart Generation Function

```typescript
// src/lib/charts/metric-charts.ts

import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width: 1200,
  height: 675,  // 16:9 aspect ratio, good for X
  backgroundColour: 'white'
});

// Generate brand trend chart (grouped bar)
async function generateBrandTrendChart(data: BrandTrendData): Promise<Buffer> {
  const config = {
    type: 'bar',
    data: {
      labels: data.months.map(m => m.monthName),
      datasets: [
        {
          label: `${data.year - 1}`,
          data: data.months.map(m => m.previous?.value || 0),
          backgroundColor: 'rgba(173, 216, 230, 0.8)', // Light blue
        },
        {
          label: `${data.year}`,
          data: data.months.map(m => m.current.value),
          backgroundColor: 'rgba(30, 58, 95, 0.9)', // Dark blue
        }
      ]
    },
    options: {
      plugins: {
        title: { display: true, text: `${data.brand} Monthly Deliveries` },
        datalabels: { display: true, anchor: 'end', align: 'top' }
      },
      scales: {
        y: { beginAtZero: true, title: { text: 'Deliveries' } }
      }
    }
  };

  return chartJSNodeCanvas.renderToBuffer(config);
}

// Generate all brands comparison chart (horizontal bar)
async function generateAllBrandsChart(data: AllBrandsData): Promise<Buffer> {
  const config = {
    type: 'bar',
    data: {
      labels: data.brands.map(b => b.brand),
      datasets: [{
        data: data.brands.map(b => b.value),
        backgroundColor: 'rgba(30, 58, 95, 0.9)',
      }]
    },
    options: {
      indexAxis: 'y', // Horizontal bars
      plugins: {
        title: { display: true, text: `${data.monthName} ${data.year} China EV Deliveries` },
        legend: { display: false },
        datalabels: { display: true, anchor: 'end', align: 'right' }
      }
    }
  };

  return chartJSNodeCanvas.renderToBuffer(config);
}
```

### Integration with X Posting

```typescript
// In post-to-x route:

// 1. Generate chart image
const chartBuffer = await generateBrandTrendChart(data);

// 2. Upload to X as media
const mediaId = await uploadMediaBuffer(chartBuffer, 'image/png');

// 3. Post tweet with media
await postTweet(content, { mediaIds: [mediaId] });
```

### Chart Styling
- **Colors**: Match site theme (ev-green palette or professional blues)
- **Font**: Sans-serif, readable at small sizes
- **Size**: 1200x675px (16:9, optimal for X timeline)
- **Data labels**: Show values on bars for clarity
- **Background**: White or light gray

---

## Files to Create

### Part 1: Metric Posts
| File | Purpose |
|------|---------|
| `src/lib/metrics/delivery-data.ts` | Query & aggregate delivery data from EVMetric |
| `src/lib/charts/metric-charts.ts` | Server-side chart generation with Chart.js |
| `src/lib/llm/metric-posts.ts` | LLM content generation for each post type |
| `src/app/api/admin/metric-posts/route.ts` | List/manage metric posts |
| `src/app/api/admin/metric-posts/generate/route.ts` | Generate preview content |
| `src/app/api/admin/metric-posts/[id]/post-to-x/route.ts` | Post to X |
| `src/app/api/cron/metric-posts/route.ts` | Auto-detect new data & generate posts |
| `src/components/admin/MetricPostsSection.tsx` | Admin UI wrapper |
| `src/components/admin/MetricPostGenerator.tsx` | Generate/preview controls |
| `src/types/metric-posts.ts` | TypeScript interfaces |

### Part 2: Data Explorer
| File | Purpose |
|------|---------|
| `src/app/[locale]/admin/data-explorer/page.tsx` | Data Explorer admin page |
| `src/components/admin/DataExplorer/QueryInput.tsx` | Natural language input + suggestions |
| `src/components/admin/DataExplorer/QueryEditor.tsx` | Editable query code block |
| `src/components/admin/DataExplorer/ResultsTable.tsx` | Paginated data results table |
| `src/components/admin/DataExplorer/ChartPreview.tsx` | Chart preview with type selector |
| `src/components/admin/DataExplorer/PostComposer.tsx` | X/Discord post composition |
| `src/lib/llm/query-generator.ts` | LLM → Prisma query translation |
| `src/lib/query-executor.ts` | Safe query execution with validation |
| `src/lib/discord.ts` | Discord webhook posting |
| `src/app/api/admin/data-explorer/generate-query/route.ts` | NL → Query API |
| `src/app/api/admin/data-explorer/execute-query/route.ts` | Execute query API |
| `src/app/api/admin/data-explorer/generate-chart/route.ts` | Generate chart API |

---

## Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `MetricPost` model + enums |
| `src/lib/config/prompts.ts` | Add BRAND_TREND_PROMPT, ALL_BRANDS_PROMPT, QUERY_GENERATOR_PROMPT |
| `src/lib/config/posting.ts` | Add metric post config (optional) |
| `src/app/[locale]/admin/page.tsx` | Add MetricPostsSection component |
| `src/components/UserPanel.tsx` | Add "Data Explorer" menu item (see mockup below) |
| `vercel.json` | Add cron job schedule |

### UserPanel Menu Update

Add "Data Explorer" between "Admin Panel" and "Monitoring":

```
┌─────────────────────────────┐
│  👤 Zhisheng Zhou           │
│     ◇ Admin                 │
├─────────────────────────────┤
│  📋 My Feed              >  │
│  🔖 Saved Articles       >  │
├─────────────────────────────┤
│  ⚙️  Admin Panel          >  │
│  📊 Data Explorer        >  │  ← NEW (chart icon)
│  📈 Monitoring           >  │
├─────────────────────────────┤
│  ⚙️  Settings             >  │
│  → Log out                  │
└─────────────────────────────┘
```

**Menu item config:**
```typescript
// In UserPanel.tsx, add after Admin Panel:
{
  icon: BarChart3,  // from lucide-react
  label: t("dataExplorer"),  // "Data Explorer" / "数据探索"
  href: `/${locale}/admin/data-explorer`,
  adminOnly: true,
}
```

**i18n keys to add:**
- `UserPanel.dataExplorer`: "Data Explorer" (en) / "数据探索" (zh)

---

## Database Schema

```prisma
model MetricPost {
  id            String           @id @default(cuid())
  postType      MetricPostType   // BRAND_TREND, ALL_BRANDS_COMPARISON
  year          Int              // Target year for the post
  period        Int?             // Month 1-12 (for ALL_BRANDS_COMPARISON)
  brand         Brand?           // Only for BRAND_TREND
  content       String           // Generated tweet
  status        MetricPostStatus @default(PENDING)
  tweetId       String?
  postedAt      DateTime?
  dataSnapshot  Json?            // Raw data at generation time
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  @@unique([postType, year, period, brand])
  @@index([year, period])
}

enum MetricPostType {
  BRAND_TREND          // 12-month trend for single brand
  ALL_BRANDS_COMPARISON // All brands for single month
}

enum MetricPostStatus {
  PENDING
  POSTED
  FAILED
}
```

---

## Data Query Functions

### `src/lib/metrics/delivery-data.ts`

```typescript
// Get 12-month trend for a brand with YoY comparison
async function getBrandMonthlyTrend(
  brand: Brand,
  year: number
): Promise<BrandTrendData>

// Returns:
{
  brand: "BYD",
  year: 2025,
  months: [
    { month: 1, monthName: "Jan",
      current: { value: 210000, year: 2025 },
      previous: { value: 145000, year: 2024 },
      yoyChange: 44.8 },
    { month: 2, monthName: "Feb", ... },
    ...
  ],
  yearTotal: { current: 2500000, previous: 1950000, yoyChange: 28.2 }
}

// Get all brands for a single month
async function getAllBrandsComparison(
  year: number,
  month: number
): Promise<AllBrandsData>

// Returns:
{
  year: 2025,
  month: 1,
  monthName: "January",
  brands: [
    { brand: "BYD", value: 210000, yoyChange: 44.8, ranking: 1 },
    { brand: "TESLA_CHINA", value: 85000, yoyChange: 12.3, ranking: 2 },
    ...
  ],
  industryTotal: { value: 620000, yoyChange: 25.5 }
}

// Get latest month with data
async function getLatestCompleteMonth(): Promise<{year: number, month: number}>

// Get available brands with data
async function getBrandsWithData(year: number): Promise<Brand[]>
```

---

## LLM Prompts

All prompts will be added to the existing `/src/lib/config/prompts.ts` file to keep them centralized.

### Hashtags (from existing config)

Use existing `POSTING_CONFIG` from `/src/lib/config/posting.ts`:
- `SITE_HASHTAGS`: ["#ChinaEV", "#EVNews", "#EVJuice", "#EV", "#ElectricVehicle", "#CleanEnergy", "#AI", "#AIArt"]
- `BRAND_HASHTAGS`: { "BYD": "#BYD", "NIO": "#NIO", "XPeng": "#XPeng", ... }

### Tweet Footer Format

Follow existing `TWEET_FORMAT` pattern:
```typescript
// Footer: 🍋 evjuice.net + hashtags
const footer = `\n\n🍋 ${POSTING_CONFIG.SITE_URL}\n${hashtags.join(' ')}`;
```

### Brand Monthly Trend Prompt

```typescript
// Add to prompts.ts
export const BRAND_TREND_PROMPT = `
You are a social media editor for EV Juice (@the_ev_juice).
Create an engaging tweet showing {brand}'s monthly delivery trend for {year}.

DATA:
{trend_data}

CRITICAL RULES:
1. Start with brand emoji and name + year
2. List each month: "Mon: XXK (vs XXK in 'YY, +XX%)"
3. Use K for thousands (e.g., 210K not 210,000)
4. Show YoY comparison for each month
5. End with year total and overall YoY change
6. Highlight notable patterns (growth streak, record months, etc.)
7. Keep under 220 characters (leave room for footer/hashtags)

EXAMPLE OUTPUT:
🔋 BYD 2025 Deliveries

Jan: 210K (vs 145K '24, +45%)
Feb: 185K (vs 160K '24, +16%)
Mar: 220K (vs 180K '24, +22%)

📈 Q1 Total: 615K (+28% YoY)

Output ONLY the tweet text, no hashtags, no links.
`.trim();
```

### All Brands Comparison Prompt

```typescript
// Add to prompts.ts
export const ALL_BRANDS_PROMPT = `
You are a social media editor for EV Juice (@the_ev_juice).
Create an engaging tweet showing China EV delivery rankings for {month} {year}.

DATA:
{comparison_data}

CRITICAL RULES:
1. Start with trophy emoji and month/year headline
2. List brands ranked by deliveries with emoji numbers (1️⃣ 2️⃣ 3️⃣)
3. Format: "Rank Brand: XXK (+XX% YoY)"
4. Use K for thousands
5. Include YoY change for each brand
6. End with industry total if available
7. Highlight notable changes (new entries, big movers)
8. Keep under 220 characters (leave room for footer/hashtags)

EXAMPLE OUTPUT:
🏆 Jan 2025 China EV Deliveries

1️⃣ BYD: 210K (+45%)
2️⃣ Tesla: 85K (+12%)
3️⃣ Li Auto: 52K (+38%)
4️⃣ NIO: 21K (-5%)
5️⃣ XPeng: 18K (+22%)

Total: 620K units 📈

Output ONLY the tweet text, no hashtags, no links.
`.trim();
```

### Hashtag Selection for Metric Posts

```typescript
// In metric-posts.ts
function getMetricPostHashtags(brands: Brand[]): string[] {
  const hashtags = ['#ChinaEV', '#EVNews']; // Always include

  // Add brand-specific hashtags
  for (const brand of brands.slice(0, 3)) { // Max 3 brand hashtags
    const brandTag = POSTING_CONFIG.BRAND_HASHTAGS[brand];
    if (brandTag) hashtags.push(brandTag);
  }

  return hashtags;
}
```

### Example X Posts by Data Type

**Industry Sales:**
```
📊 China NEV Sales: Jan 2025

Total: 1.02M vehicles (+32% YoY)
- Retail: 980K (+28%)
- Wholesale: 1.05M (+35%)

Strong start to Year of the Snake! 🐍

🍋 evjuice.net
#ChinaEV #EVNews
```

**Market Health (Inventory):**
```
📉 China Dealer Inventory: Jan 2025

Coefficient: 1.45 (vs 1.62 Dec)
Improving but still elevated

Healthy range: 0.8-1.2
Current status: ⚠️ Oversupply pressure

🍋 evjuice.net
#ChinaEV #EVNews
```

**Battery Industry:**
```
🔋 China Battery Installation: Jan 2025

Total: 52.3 GWh (+41% YoY)

Top 3 makers:
1️⃣ CATL: 26.8 GWh (51.2%)
2️⃣ BYD: 14.2 GWh (27.2%)
3️⃣ CALB: 3.1 GWh (5.9%)

🍋 evjuice.net
#ChinaEV #EVBattery
```

**Exports:**
```
🚢 Tesla Shanghai Exports: Jan 2025

Exported: 42,500 vehicles (+18% YoY)
Domestic: 38,200 vehicles

Shanghai Gigafactory = Tesla's global export hub 🌏

🍋 evjuice.net
#Tesla #ChinaEV
```

**Vehicle Specs Comparison:**
```
⚡ EV Range Kings (CLTC):

1. NIO ET7: 1,000km
2. Zeekr 001: 1,032km
3. XPeng G9: 702km
4. Li Auto MEGA: 710km

All with 100kWh+ batteries 🔋

🍋 evjuice.net
#ChinaEV #EVRange
```

---

## Admin UI Flow

```
┌─────────────────────────────────────────────────────────┐
│ EV Metrics Posts                                        │
├─────────────────────────────────────────────────────────┤
│ Generate New Post                                       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Post Type:                                          │ │
│ │ ○ Brand Monthly Trend (12-month for one brand)     │ │
│ │ ○ All Brands Comparison (one month, all brands)    │ │
│ │                                                     │ │
│ │ Year: [2025 ▼]                                     │ │
│ │ Month: [January ▼]  (for All Brands only)          │ │
│ │ Brand: [BYD ▼]      (for Brand Trend only)         │ │
│ │                                                     │ │
│ │ [Generate Preview]                                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Preview:                                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Tweet Text:                                         │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ 🔋 BYD 2025 Deliveries                          │ │ │
│ │ │                                                 │ │ │
│ │ │ Jan: 210K (vs 145K '24, +45%)                  │ │ │
│ │ │ Feb: 185K (vs 160K '24, +16%)                  │ │ │
│ │ │ ...                                            │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │ 245/280 chars    [Edit Text]                        │ │
│ │                                                     │ │
│ │ Chart Preview:                                      │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │  ████  ████  ████  ████  ████  ████             │ │ │
│ │ │  ░░░░  ░░░░  ████  ████  ████  ████             │ │ │
│ │ │  Jan   Feb   Mar   Apr   May   Jun              │ │ │
│ │ │       ░░░░ 2024    ████ 2025                    │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │ [Regenerate Chart]                                  │ │
│ │                                                     │ │
│ │ [Post to X]                                         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Recent Posts:                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Type        │ Period     │ Status  │ Actions        │ │
│ │ BYD Trend   │ 2025       │ Posted  │ View           │ │
│ │ All Brands  │ Jan '25    │ Pending │ Edit / Post    │ │
│ │ NIO Trend   │ 2025       │ Posted  │ View           │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## API Routes

### GET `/api/admin/metric-posts`
List metric posts with filters.

Query params: `status`, `postType`, `year`, `brand`, `page`, `limit`

### POST `/api/admin/metric-posts/generate`
Generate preview content.

Request:
```json
{
  "postType": "BRAND_TREND",
  "year": 2025,
  "brand": "BYD"
}
// OR
{
  "postType": "ALL_BRANDS_COMPARISON",
  "year": 2025,
  "month": 1
}
```

Response:
```json
{
  "content": "Generated tweet content...",
  "data": { /* raw data used */ },
  "characterCount": 245,
  "chartImageBase64": "data:image/png;base64,...",
  "warnings": ["Missing data for Feb, Mar"]
}
```

### POST `/api/admin/metric-posts`
Save a metric post.

### POST `/api/admin/metric-posts/[id]/post-to-x`
Post to X.

---

## Type Definitions

```typescript
// src/types/metric-posts.ts

interface MonthData {
  month: number;
  monthName: string;
  current: { value: number; year: number };
  previous: { value: number; year: number } | null;
  yoyChange: number | null;
}

interface BrandTrendData {
  brand: Brand;
  year: number;
  months: MonthData[];
  yearTotal: {
    current: number;
    previous: number | null;
    yoyChange: number | null;
  };
}

interface BrandComparisonEntry {
  brand: Brand;
  value: number;
  yoyChange: number | null;
  ranking: number;
}

interface AllBrandsData {
  year: number;
  month: number;
  monthName: string;
  brands: BrandComparisonEntry[];
  industryTotal: {
    value: number;
    yoyChange: number | null;
  } | null;
}

type MetricPostType = 'BRAND_TREND' | 'ALL_BRANDS_COMPARISON';

interface MetricPostGenerateRequest {
  postType: MetricPostType;
  year: number;
  month?: number;  // Required for ALL_BRANDS_COMPARISON
  brand?: Brand;   // Required for BRAND_TREND
}
```

---

## Cron Logic

```
Daily at 10:00 UTC:
1. Get latest month with complete data
2. Check if ALL_BRANDS_COMPARISON exists for that month
   - If not, generate and save as PENDING
3. For each brand with data:
   - Check if BRAND_TREND exists for current year
   - If new month data added, regenerate BRAND_TREND
4. Notify admin of pending posts
```

---

## Implementation Steps

### Phase 1: Core Infrastructure
1. Add `MetricPost` model to Prisma schema, run migration
2. Install chart dependencies: `npm install chart.js chartjs-node-canvas chartjs-plugin-datalabels`
3. Create `src/lib/metrics/delivery-data.ts`:
   - `getBrandMonthlyTrend(brand, year)` - 12-month with YoY
   - `getAllBrandsComparison(year, month)` - All brands ranked
   - `getLatestCompleteMonth()` - Find newest month
   - `getBrandsWithData(year)` - Available brands
4. Create `src/lib/charts/metric-charts.ts`:
   - `generateBrandTrendChart(data)` - Grouped bar chart PNG
   - `generateAllBrandsChart(data)` - Horizontal bar chart PNG
5. Create `src/lib/config/metric-prompts.ts` - LLM prompts
6. Create `src/lib/llm/metric-posts.ts` - Generation functions

### Phase 2: API Routes
7. Create `/api/admin/metric-posts/route.ts` - List + Save
8. Create `/api/admin/metric-posts/generate/route.ts` - Preview (returns text + chart preview)
9. Create `/api/admin/metric-posts/[id]/post-to-x/route.ts` - Post to X with chart image

### Phase 3: Admin UI
10. Create `MetricPostGenerator.tsx` - Type/year/month/brand selection + chart preview
11. Create `MetricPostsSection.tsx` - Wrapper with posts table
12. Add to admin page

### Phase 4: Automation
13. Create `/api/cron/metric-posts/route.ts` - Daily detection
14. Add cron to `vercel.json`

---

## Dependencies to Install

```bash
npm install chart.js chartjs-node-canvas chartjs-plugin-datalabels
```

- `chart.js` - Core charting library
- `chartjs-node-canvas` - Server-side rendering to PNG buffer
- `chartjs-plugin-datalabels` - Display values on bars

---

## Environment Variables

```
AUTO_POST_METRIC_TWEETS=false  # true = auto-post, false = save as pending
```

---

---

# Part 2: Data Explorer (Natural Language to Charts)

## Overview
A new admin page where users can ask questions in natural language, have LLM generate database queries, review/edit queries, generate charts, and post to X/Discord.

## User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Data Explorer                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Ask a Question                                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ "Show me NIO vs XPeng deliveries for the past 6 months"     ││
│  │                                              [Generate] 🔄  ││
│  └─────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│  Step 2: Review/Edit Query                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ // Generated Prisma Query                                   ││
│  │ prisma.eVMetric.findMany({                                  ││
│  │   where: {                                                  ││
│  │     brand: { in: ["NIO", "XPENG"] },                        ││
│  │     metric: "DELIVERY",                                     ││
│  │     periodType: "MONTHLY",                                  ││
│  │     year: 2025,                                             ││
│  │     period: { gte: 7 }  // Last 6 months                    ││
│  │   },                                                        ││
│  │   orderBy: [{ period: 'asc' }]                              ││
│  │ })                                                          ││
│  └─────────────────────────────────────────────────────────────┘│
│  [Edit Query]  [Run Query] ▶️                                   │
│                              ↓                                   │
│  Step 3: View Results & Chart                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Raw Data (12 rows)                      [Show/Hide]        ││
│  │  ┌─────────────────────────────────────────────────────┐    ││
│  │  │ brand │ period │ value  │ yoyChange │              │    ││
│  │  │ NIO   │ 7      │ 20,498 │ +15%      │              │    ││
│  │  │ XPENG │ 7      │ 18,200 │ +22%      │              │    ││
│  │  │ ...   │        │        │           │              │    ││
│  │  └─────────────────────────────────────────────────────┘    ││
│  │                                                             ││
│  │  Chart Preview:                                             ││
│  │  ┌─────────────────────────────────────────────────────┐    ││
│  │  │     NIO vs XPeng Monthly Deliveries                 │    ││
│  │  │  25K ┤    ████                                      │    ││
│  │  │     │    ████  ░░░░  ████                          │    ││
│  │  │  20K ┤░░░░████  ████  ████  ░░░░  ████             │    ││
│  │  │     │████████  ████  ████  ████  ████  ░░░░        │    ││
│  │  │  15K ┤████████  ████  ████  ████  ████  ████       │    ││
│  │  │     └───────────────────────────────────────       │    ││
│  │  │       Jul   Aug   Sep   Oct   Nov   Dec            │    ││
│  │  │            ░░░░ NIO    ████ XPeng                  │    ││
│  │  └─────────────────────────────────────────────────────┘    ││
│  │                                                             ││
│  │  Chart Type: [Bar ▼] [Line] [Horizontal Bar]                ││
│  │  [Regenerate Chart] 🔄                                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ❌ Not what you expected?                                      │
│  [Start Over] [Modify Question] [Edit Query Directly]           │
│                              ↓                                   │
│  Step 4: Compose Post (when satisfied)                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Post Content:                                               ││
│  │ ┌─────────────────────────────────────────────────────────┐ ││
│  │ │ 📊 NIO vs XPeng: H2 2024 Delivery Battle               │ ││
│  │ │                                                         │ ││
│  │ │ XPeng edges ahead in Oct-Dec while NIO maintains       │ ││
│  │ │ steady growth. Both brands showing strong momentum!    │ ││
│  │ │                                                         │ ││
│  │ └─────────────────────────────────────────────────────────┘ ││
│  │ 156/280 chars   [Generate with AI ✨]                       ││
│  │                                                             ││
│  │ ☑️ Attach chart image                                       ││
│  │ ☑️ Add hashtags (from POSTING_CONFIG.SITE_HASHTAGS)         ││
│  │ ☑️ Add footer (🍋 evjuice.net)                              ││
│  │                                                             ││
│  │ [Post to X 🐦]  [Post to Discord 💬]  [Save Draft 💾]       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User       │     │   LLM        │     │  Database    │
│   Question   │────▶│  Translate   │────▶│  Query       │
└──────────────┘     └──────────────┘     └──────────────┘
                            │                    │
                            ▼                    ▼
                     ┌──────────────┐     ┌──────────────┐
                     │   Query      │     │   Raw        │
                     │   Editor     │◀────│   Results    │
                     └──────────────┘     └──────────────┘
                            │                    │
                            ▼                    ▼
                     ┌──────────────┐     ┌──────────────┐
                     │   User       │     │   Chart      │
                     │   Edits      │────▶│   Generator  │
                     └──────────────┘     └──────────────┘
                                                │
                                                ▼
                                         ┌──────────────┐
                                         │   Post       │
                                         │   Composer   │
                                         └──────────────┘
                                                │
                                    ┌───────────┴───────────┐
                                    ▼                       ▼
                             ┌──────────────┐       ┌──────────────┐
                             │   X Post     │       │   Discord    │
                             └──────────────┘       └──────────────┘
```

## New Files to Create

| File | Purpose |
|------|---------|
| `src/app/[locale]/admin/data-explorer/page.tsx` | Data Explorer admin page |
| `src/components/admin/DataExplorer/QueryInput.tsx` | Natural language input |
| `src/components/admin/DataExplorer/QueryEditor.tsx` | Editable query display |
| `src/components/admin/DataExplorer/ResultsTable.tsx` | Data results table |
| `src/components/admin/DataExplorer/ChartPreview.tsx` | Chart preview with type selector |
| `src/components/admin/DataExplorer/PostComposer.tsx` | X/Discord post composition |
| `src/lib/llm/query-generator.ts` | LLM → Prisma query translation |
| `src/lib/query-executor.ts` | Safe query execution with validation |
| `src/app/api/admin/data-explorer/generate-query/route.ts` | Generate query from NL |
| `src/app/api/admin/data-explorer/execute-query/route.ts` | Execute query safely |
| `src/app/api/admin/data-explorer/generate-chart/route.ts` | Generate chart from results |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/UserPanel.tsx` | Add "Data Explorer" menu item |
| `src/lib/discord.ts` | Add/update Discord posting function |

## LLM Query Generation

### System Prompt for Query Generation (add to prompts.ts)

```typescript
// Add to prompts.ts
export const QUERY_GENERATOR_PROMPT = `
You are a database query assistant for an EV news platform.
Convert natural language questions into Prisma queries.

AVAILABLE TABLES:

1. EVMetric - Brand delivery/sales data
   Fields: brand (BYD|NIO|XPENG|LI_AUTO|ZEEKR|XIAOMI|TESLA_CHINA|LEAPMOTOR|GEELY|OTHER_BRAND|INDUSTRY),
           metric (DELIVERY|SALES|WHOLESALE|PRODUCTION|BATTERY_INSTALL|MARKET_SHARE|RANKING),
           periodType (MONTHLY|QUARTERLY|YEARLY), year, period, value, yoyChange, momChange, marketShare, ranking

2. AutomakerRankings - Monthly automaker sales rankings
   Fields: dataSource, year, month, ranking, automaker, value, yoyChange, momChange, marketShare

3. CaamNevSales - CAAM official NEV sales (includes exports)
   Fields: year, month, value, yoyChange, momChange, unit (vehicles)

4. CpcaNevRetail - CPCA NEV retail sales (consumer registrations)
   Fields: year, month, value, yoyChange, momChange, unit (vehicles)

5. CpcaNevProduction - CPCA NEV production volume
   Fields: year, month, value, yoyChange, momChange, unit (vehicles)

6. ChinaPassengerInventory - Dealer + factory inventory levels
   Fields: year, month, value, unit (million_units)

7. ChinaDealerInventoryFactor - Dealer inventory coefficient (库存系数)
   Fields: year, month, value (ratio: >1.5=oversupply, <0.8=shortage)

8. ChinaViaIndex - Vehicle Inventory Alert Index
   Fields: year, month, value (percent: >50%=contraction, <50%=healthy)

9. ChinaBatteryInstallation - Total battery installation & production
   Fields: year, month, installation, production, unit (GWh)

10. BatteryMakerMonthly - Battery maker performance by company
    Fields: maker (CATL|BYD|CALB|Gotion|EVE|Sunwoda|LG|SK|Panasonic), year, month, installation, production, yoyChange

11. BatteryMakerRankings - Battery maker market share rankings
    Fields: dataSource, scope (CHINA|GLOBAL), periodType, year, month, ranking, maker, value, marketShare

12. PlantExports - Exports by manufacturing plant
    Fields: plant (TESLA_SHANGHAI|BYD_SHENZHEN|etc), brand, year, month, value, yoyChange

13. NevSalesSummary - Weekly/bi-weekly sales flash reports
    Fields: dataSource, year, startDate, endDate, retailSales, retailYoy, wholesaleSales, wholesaleYoy

14. VehicleSpec - Vehicle specifications
    Fields: brand, model, variant, startingPrice, currentPrice, rangeCltc, acceleration, batteryCapacity, vehicleType (BEV|EREV|PHEV)

QUERY ROUTING:
- Brand deliveries/sales → EVMetric or AutomakerRankings
- Industry total sales → CaamNevSales or CpcaNevRetail
- Production data → CpcaNevProduction
- Inventory/market health → ChinaPassengerInventory, ChinaDealerInventoryFactor, ChinaViaIndex
- Battery data → ChinaBatteryInstallation or BatteryMakerMonthly or BatteryMakerRankings
- Export data → PlantExports
- Vehicle specs/prices → VehicleSpec
- Weekly updates → NevSalesSummary

RULES:
1. Output valid Prisma findMany query with table name
2. Use current year (2025) if not specified
3. Handle relative time ("last 6 months", "Q3", "past year")
4. Support comparisons ("vs", "compare")
5. Support aggregations ("total", "highest", "top N")

EXAMPLES:

User: "BYD deliveries in 2024"
Table: EVMetric
Query: { where: { brand: "BYD", metric: "DELIVERY", periodType: "MONTHLY", year: 2024 }, orderBy: { period: 'asc' } }

User: "Total NEV sales last 12 months"
Table: CaamNevSales
Query: { where: { OR: [{ year: 2024 }, { year: 2025, month: { lte: 1 } }] }, orderBy: [{ year: 'asc' }, { month: 'asc' }] }

User: "CATL vs BYD battery installation 2024"
Table: BatteryMakerMonthly
Query: { where: { maker: { in: ["CATL", "BYD"] }, year: 2024 }, orderBy: [{ month: 'asc' }] }

User: "Top 10 battery makers global market share"
Table: BatteryMakerRankings
Query: { where: { scope: "GLOBAL", periodType: "MONTHLY" }, orderBy: { ranking: 'asc' }, take: 10 }

User: "Tesla Shanghai exports 2024"
Table: PlantExports
Query: { where: { plant: "TESLA_SHANGHAI", year: 2024 }, orderBy: { month: 'asc' } }

User: "Dealer inventory coefficient trend"
Table: ChinaDealerInventoryFactor
Query: { where: { year: { gte: 2024 } }, orderBy: [{ year: 'asc' }, { month: 'asc' }] }

User: "Compare NIO and XPeng vehicle specs"
Table: VehicleSpec
Query: { where: { brand: { in: ["NIO", "XPENG"] } }, orderBy: { startingPrice: 'asc' } }

Output format: { table: "TableName", query: { ... } }
\`
```

### Data Explorer Post Generation Prompt (add to prompts.ts)

```typescript
// Add to prompts.ts
export const DATA_EXPLORER_POST_PROMPT = `
You are a social media editor for EV Juice (@the_ev_juice).
Create an engaging tweet based on the data analysis results provided.

DATA ANALYSIS:
{data_summary}

CHART DESCRIPTION:
{chart_description}

CRITICAL RULES:
1. Summarize the key insight from the data
2. Use specific numbers and percentages
3. Add brief commentary or analysis
4. Professional but engaging tone
5. Keep under 220 characters (leave room for footer/hashtags)

Output ONLY the tweet text, no hashtags, no links.
`.trim();
```

### Suggested Questions (Quick Actions)

Provide preset questions for common queries, organized by data category:

**Brand Deliveries:**
- "BYD monthly deliveries in 2024"
- "Compare NIO, XPeng, Li Auto last 12 months"
- "Top 5 brands by deliveries January 2025"
- "Tesla China vs BYD quarterly trend"
- "Xiaomi monthly deliveries since launch"

**Industry Sales:**
- "Total NEV sales trend 2024"
- "NEV retail vs wholesale gap last 6 months"
- "CAAM vs CPCA sales comparison 2024"
- "NEV production vs sales 2024"

**Market Health Indicators:**
- "Dealer inventory coefficient trend 2024"
- "VIA Index last 12 months"
- "Passenger car inventory levels trend"

**Battery Industry:**
- "CATL vs BYD battery installations 2024"
- "Top 10 battery makers global market share"
- "China battery installation monthly trend"
- "Battery production vs installation gap"

**Exports:**
- "Tesla Shanghai exports 2024"
- "Top exporting plants by volume"
- "BYD export trend by plant"

**Vehicle Specs:**
- "Compare NIO and Li Auto SUV specs"
- "Cheapest EVs with 500km+ range"
- "Fastest accelerating Chinese EVs"
- "BEV vs EREV price comparison"

## Query Safety & Validation

```typescript
// src/lib/query-executor.ts

// Whitelist of allowed tables (read-only access)
const ALLOWED_TABLES = [
  // Brand-level data
  'eVMetric',
  'automakerRankings',

  // Industry-level data
  'caamNevSales',
  'cpcaNevRetail',
  'cpcaNevProduction',
  'nevSalesSummary',

  // Market health indicators
  'chinaPassengerInventory',
  'chinaDealerInventoryFactor',
  'chinaViaIndex',

  // Battery industry
  'chinaBatteryInstallation',
  'batteryMakerMonthly',
  'batteryMakerRankings',

  // Exports
  'plantExports',

  // Vehicle specs
  'vehicleSpec',
] as const;

const MAX_RESULTS = 1000;

type AllowedTable = typeof ALLOWED_TABLES[number];

interface QueryRequest {
  table: AllowedTable;
  query: PrismaQueryConfig;
}

async function executeQuery(request: QueryRequest): Promise<QueryResult> {
  const { table, query } = request;

  // 1. Validate table is allowed
  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error(`Table "${table}" is not allowed`);
  }

  // 2. Validate query structure
  validateQueryStructure(query);

  // 3. Add safety limits
  const safeQuery = {
    ...query,
    take: Math.min(query.take || MAX_RESULTS, MAX_RESULTS)
  };

  // 4. Execute with timeout (table-specific)
  const prismaTable = (prisma as any)[table];
  const result = await Promise.race([
    prismaTable.findMany(safeQuery),
    timeout(5000) // 5 second timeout
  ]);

  // 5. Return with metadata
  return {
    table,
    data: result,
    rowCount: result.length,
    executionTime: Date.now() - startTime
  };
}

function validateQueryStructure(query: unknown): void {
  // Check for dangerous operations
  // Only allow: where, orderBy, take, skip, select, include (limited)
  // Block: delete, update, create, raw SQL, $queryRaw
  const allowedKeys = ['where', 'orderBy', 'take', 'skip', 'select'];
  // ... validation logic
}
```

## Chart Type Selection

Based on query results, suggest appropriate chart types:

### Brand/Company Performance
| Data Pattern | Suggested Chart | Example Query |
|--------------|-----------------|---------------|
| Single brand over time | Line chart | "BYD monthly deliveries 2024" |
| Multiple brands over time | Grouped bar / Multi-line | "NIO vs XPeng deliveries" |
| Single month, multiple brands | Horizontal bar (ranked) | "All brands Jan 2025" |
| YoY comparison | Grouped bar (year pairs) | "2024 vs 2025 by brand" |

### Industry Totals
| Data Pattern | Suggested Chart | Example Query |
|--------------|-----------------|---------------|
| Monthly trend | Area chart | "NEV sales trend 2024" |
| Production vs Sales | Dual-axis line | "Production vs retail 2024" |
| Retail vs Wholesale | Stacked bar | "Retail vs wholesale gap" |

### Market Health Indicators
| Data Pattern | Suggested Chart | Example Query |
|--------------|-----------------|---------------|
| Inventory coefficient | Line with threshold | "Dealer inventory trend" (show 1.0 baseline) |
| VIA Index | Line with 50% marker | "VIA Index trend" (show 50% threshold) |
| Inventory levels | Area chart | "Passenger inventory trend" |

### Battery Industry
| Data Pattern | Suggested Chart | Example Query |
|--------------|-----------------|---------------|
| Maker comparison | Horizontal bar (ranked) | "Top 10 battery makers" |
| Market share | Pie/donut chart | "Battery market share" |
| Installation vs Production | Grouped bar | "Battery install vs production" |
| Maker trend | Multi-line | "CATL vs BYD monthly" |

### Exports
| Data Pattern | Suggested Chart | Example Query |
|--------------|-----------------|---------------|
| Plant exports over time | Stacked area | "Tesla Shanghai exports" |
| Multiple plants comparison | Grouped bar | "Exports by plant" |

### Vehicle Specs
| Data Pattern | Suggested Chart | Example Query |
|--------------|-----------------|---------------|
| Price comparison | Horizontal bar | "EV prices by brand" |
| Range vs Price | Scatter plot | "Range vs price tradeoff" |
| Spec comparison table | Data table (not chart) | "Compare NIO ES8 vs Li L9" |

## Discord Integration

```typescript
// src/lib/discord.ts

interface DiscordPostOptions {
  content: string;
  imageBuffer?: Buffer;
  channelId?: string; // default to configured channel
}

async function postToDiscord(options: DiscordPostOptions): Promise<DiscordMessage> {
  const webhook = process.env.DISCORD_WEBHOOK_URL;

  const formData = new FormData();
  formData.append('content', options.content);

  if (options.imageBuffer) {
    formData.append('file', new Blob([options.imageBuffer]), 'chart.png');
  }

  const response = await fetch(webhook, {
    method: 'POST',
    body: formData
  });

  return response.json();
}
```

## State Management

The Data Explorer page maintains state for the iterative workflow:

```typescript
interface DataExplorerState {
  // Step 1: Question
  question: string;

  // Step 2: Query
  generatedQuery: string;
  editedQuery: string;
  queryError: string | null;

  // Step 3: Results
  queryResults: EVMetric[] | null;
  chartType: 'bar' | 'line' | 'horizontalBar';
  chartImageBase64: string | null;

  // Step 4: Post
  postContent: string;
  attachChart: boolean;
  addHashtags: boolean;

  // UI State
  currentStep: 1 | 2 | 3 | 4;
  isLoading: boolean;
}
```

## API Routes

### POST `/api/admin/data-explorer/generate-query`
Convert natural language to Prisma query.

Request:
```json
{
  "question": "Compare NIO and XPeng last 6 months"
}
```

Response:
```json
{
  "query": "{ where: { brand: { in: ['NIO', 'XPENG'] }, ... } }",
  "explanation": "Fetching NIO and XPeng delivery data for Jul-Dec 2024",
  "suggestedChartType": "bar"
}
```

### POST `/api/admin/data-explorer/execute-query`
Execute a Prisma query safely.

Request:
```json
{
  "query": "{ where: { ... } }"
}
```

Response:
```json
{
  "data": [...],
  "rowCount": 12,
  "executionTimeMs": 45
}
```

### POST `/api/admin/data-explorer/generate-chart`
Generate chart from query results.

Request:
```json
{
  "data": [...],
  "chartType": "bar",
  "title": "NIO vs XPeng Deliveries"
}
```

Response:
```json
{
  "chartImageBase64": "data:image/png;base64,..."
}
```

## Environment Variables

```
# Discord (new)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
DISCORD_CHANNEL_ID=...  # Optional, for specific channel
```

## Implementation Steps (Additional)

### Phase 5: Data Explorer
15. Create `/admin/data-explorer/page.tsx` - Main page
16. Create `QueryInput.tsx` - Natural language input with suggestions
17. Create `QueryEditor.tsx` - Editable code block for query
18. Create `ResultsTable.tsx` - Paginated data table
19. Create `ChartPreview.tsx` - Chart with type selector
20. Create `PostComposer.tsx` - X/Discord post composition
21. Create `/api/admin/data-explorer/generate-query/route.ts`
22. Create `/api/admin/data-explorer/execute-query/route.ts`
23. Create `src/lib/llm/query-generator.ts` - LLM query translation
24. Create `src/lib/query-executor.ts` - Safe query execution
25. Add Discord webhook integration
26. Add "Data Explorer" to UserPanel menu

---

## Verification

### Part 1: Metric Posts
1. `npx prisma migrate dev` - Verify schema migration
2. `npm run build` - Verify no type errors
3. Seed test data: Add EVMetric records for multiple months
4. Test chart generation:
   - Call `generateBrandTrendChart()` → verify PNG output
   - Call `generateAllBrandsChart()` → verify PNG output
   - Check chart renders correctly (data labels, colors, layout)
5. Test Admin UI:
   - Generate brand trend → verify 12-month data + chart preview
   - Generate all brands → verify ranking + chart preview
   - Post to X → verify tweet appears with chart image attached
6. Test cron: Call `/api/cron/metric-posts` → verify detection
7. Test duplicate prevention: Re-run → verify unique constraint

### Part 2: Data Explorer
8. Navigate to `/admin/data-explorer` → verify page loads
9. Test query generation:
   - Enter "BYD deliveries 2024" → verify valid Prisma query generated
   - Enter "Compare NIO and XPeng" → verify multi-brand query
   - Enter gibberish → verify graceful error handling
10. Test query editing:
    - Modify generated query → verify changes persist
    - Enter invalid query → verify validation error
11. Test query execution:
    - Run valid query → verify results table displays
    - Verify execution timeout works (slow queries)
12. Test chart generation:
    - Select bar chart → verify chart renders
    - Switch to line chart → verify chart updates
    - Verify data labels appear correctly
13. Test iterative workflow:
    - Generate → Edit → Re-run → verify cycle works
    - "Start Over" button → verify state resets
14. Test posting:
    - Compose post content → verify character count
    - "Generate with AI" → verify LLM generates text
    - Post to X → verify tweet with chart image
    - Post to Discord → verify webhook message with image
15. Test suggested questions:
    - Click preset question → verify populates input
    - Run → verify expected results

---

## Implementation Status

**Status: Design Complete - Implementation On Hold**

The design document has been updated with comprehensive data source coverage. Implementation is paused pending completion of the database schema migration (Copy2/ev-platform).

### Completed:
- [x] Design document created
- [x] Available data sources documented (14 tables)
- [x] LLM prompts designed for all data types
- [x] Chart type recommendations for each data category
- [x] Query safety/validation approach defined
- [x] Example X posts for all data types

### Next Steps (after schema migration):
1. Copy new schema to main ev-platform
2. Run Prisma migration
3. Implement Phase 1: Core data query functions
4. Implement Phase 2: Chart generation
5. Implement Phase 3: Admin UI
6. Implement Phase 4: Data Explorer
7. Implement Phase 5: Cron automation

### Schema Changes Required:
- Add `MetricPost` model for storing generated posts
- All 14 data tables already defined in new schema
