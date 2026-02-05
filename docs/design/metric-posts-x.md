# LLM-Powered X Posts from Monthly EV Delivery Data

## Overview
Generate engaging X (Twitter) posts from monthly delivery data stored in `EVMetric` table using LLM. Posts include **auto-generated chart images** for visual impact. Two post types with both manual (Admin UI) and automated (cron) triggers.

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
| `src/components/UserPanel.tsx` | Add "Data Explorer" menu item |
| `vercel.json` | Add cron job schedule |

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
Convert natural language questions into Prisma queries for the EVMetric table.

DATABASE SCHEMA:
- EVMetric table stores delivery/sales metrics for EV brands
- Fields:
  - brand: BYD | NIO | XPENG | LI_AUTO | ZEEKR | XIAOMI | TESLA_CHINA | OTHER_BRAND | INDUSTRY
  - metric: DELIVERY | SALES | WHOLESALE | PRODUCTION | BATTERY_INSTALL
  - periodType: MONTHLY | QUARTERLY | YEARLY
  - year: number (e.g., 2024, 2025)
  - period: number (1-12 for monthly, 1-4 for quarterly)
  - value: number (delivery count)
  - yoyChange: number | null (year-over-year % change)
  - momChange: number | null (month-over-month % change)
  - marketShare: number | null (%)
  - ranking: number | null

RULES:
1. Output valid Prisma findMany query syntax
2. Always filter by metric: "DELIVERY" unless user asks for something else
3. Always filter by periodType: "MONTHLY" unless user specifies quarterly/yearly
4. Use current year (2025) if not specified
5. Handle relative time ("last 6 months", "Q3", "past year")
6. Support comparisons ("vs", "compare", "against")
7. Support aggregations ("total", "average", "highest", "lowest")

EXAMPLES:

User: "BYD deliveries in 2024"
Query:
{
  where: {
    brand: "BYD",
    metric: "DELIVERY",
    periodType: "MONTHLY",
    year: 2024
  },
  orderBy: { period: 'asc' }
}

User: "Compare NIO and XPeng last 6 months"
Query:
{
  where: {
    brand: { in: ["NIO", "XPENG"] },
    metric: "DELIVERY",
    periodType: "MONTHLY",
    OR: [
      { year: 2024, period: { gte: 7 } },
      { year: 2025, period: { lte: 1 } }
    ]
  },
  orderBy: [{ year: 'asc' }, { period: 'asc' }]
}

User: "Top 5 brands in January 2025"
Query:
{
  where: {
    metric: "DELIVERY",
    periodType: "MONTHLY",
    year: 2025,
    period: 1,
    brand: { not: "INDUSTRY" }
  },
  orderBy: { value: 'desc' },
  take: 5
}

Output ONLY the Prisma query object, no explanation.
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

Provide preset questions for common queries:
- "BYD monthly deliveries in 2024"
- "Compare all brands for January 2025"
- "NIO vs Li Auto last 12 months"
- "Top 5 brands by YoY growth"
- "Tesla China quarterly trend"

## Query Safety & Validation

```typescript
// src/lib/query-executor.ts

// Whitelist of allowed query patterns
const ALLOWED_TABLES = ['eVMetric'];
const MAX_RESULTS = 1000;

async function executeQuery(queryConfig: PrismaQuery): Promise<QueryResult> {
  // 1. Validate query structure
  validateQueryStructure(queryConfig);

  // 2. Add safety limits
  const safeQuery = {
    ...queryConfig,
    take: Math.min(queryConfig.take || MAX_RESULTS, MAX_RESULTS)
  };

  // 3. Execute with timeout
  const result = await Promise.race([
    prisma.eVMetric.findMany(safeQuery),
    timeout(5000) // 5 second timeout
  ]);

  // 4. Return with metadata
  return {
    data: result,
    rowCount: result.length,
    executionTime: Date.now() - startTime
  };
}

function validateQueryStructure(query: unknown): void {
  // Check for dangerous operations
  // Only allow: where, orderBy, take, skip, select
  // Block: delete, update, create, raw SQL
}
```

## Chart Type Selection

Based on query results, suggest appropriate chart types:

| Data Pattern | Suggested Chart | Example Query |
|--------------|-----------------|---------------|
| Single brand over time | Line chart | "BYD monthly 2024" |
| Multiple brands over time | Grouped bar / Multi-line | "NIO vs XPeng" |
| Single point in time, multiple brands | Horizontal bar (ranked) | "All brands Jan 2025" |
| YoY comparison | Grouped bar (year pairs) | "2024 vs 2025" |

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
