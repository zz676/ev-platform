# NIO Power Charger Map Scraper

> **Last Updated**: February 7, 2026
> **Status**: Implemented

## Overview

A standalone pipeline that scrapes NIO Power charger map statistics from their SPA page using Playwright. Captures real-time infrastructure metrics (swap stations, charging stations, cumulative usage) and stores time-series snapshots via the `NioPowerSnapshot` API endpoint.

### Key Differences from Article Scraper

| Aspect | Article Scraper (`main.py`) | NIO Power Scraper |
|--------|----------------------------|-------------------|
| **Data type** | News articles from multiple sources | Single infrastructure snapshot |
| **Technique** | HTTP requests + HTML parsing | Playwright SPA rendering |
| **AI processing** | Translation, scoring, classification | None needed |
| **Dependencies** | DeepSeek/OpenAI, webhook, X publishing | Only Playwright + API client |
| **Schedule** | Every 6 hours | Every 6 hours (independent) |
| **Failure impact** | Isolated from NIO Power | Isolated from article scraping |

---

## Architecture

### Data Source

**URL**: `https://chargermap.nio.com/pe/h5/static/chargermap#/`

This is a single-page application (SPA) that renders real-time NIO Power infrastructure metrics. The page loads data dynamically via JavaScript, requiring a headless browser.

### Page Rendering Patterns

The page uses two different rendering patterns for metrics:

| Pattern | Elements | Metrics | Example |
|---------|----------|---------|---------|
| **Static** | `<h6>label</h6> <strong class="totalNum-JpRDD">value</strong>` | Stations, piles, third-party | `<strong>3,729</strong>` |
| **Animated digit-flip** | `<h6>label</h6> <ul class="pe-biz-digit-flip"> <li>d</li>... </ul>` | Cumulative swaps/charges | Each digit in a separate `<li>` |

The charging section has two `<strong>` values under one `<h6>蔚来能源充电站`: "4,898 座 / 28,035 根" (stations / piles).

Animated counters tick from 0 to final values on page load. Digits currently animating have `class="refresh"`.

### Scraping Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    NIO POWER SCRAPER FLOW                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐     ┌──────────────┐     ┌──────────────┐  │
│  │  Playwright  │ ──▶ │ Wait for     │ ──▶ │ Wait for     │  │
│  │  Navigate    │     │ "截至" text   │     │ li.refresh=0 │  │
│  │  (domcontent │     │ (data loaded) │     │ (animations  │  │
│  │   loaded)    │     │              │     │  complete)   │  │
│  └─────────────┘     └──────────────┘     └──────┬───────┘  │
│                                                    │          │
│                                                    ▼          │
│                                           ┌──────────────┐   │
│                                           │  Structured  │   │
│                                           │  JS extract  │   │
│                                           │  per <h6>    │   │
│                                           └──────┬───────┘   │
│                                                   │           │
│                                                   ▼           │
│                                          ┌──────────────┐    │
│                                          │  Regex parse │    │
│                                          │  + sanity    │    │
│                                          │  checks      │    │
│                                          └──────┬───────┘    │
│                                                  │            │
│                                                  ▼            │
│                                         ┌───────────────┐    │
│                                         │ Submit to API │    │
│                                         │ NioPowerSnapshot│  │
│                                         └───────────────┘    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Metrics Captured

| Metric | Chinese Label | Rendering | Example |
|--------|---------------|-----------|---------|
| Total stations | 蔚来能源充换电站总数 | Static `<strong>` | 8,627 |
| Swap stations | 蔚来能源换电站 | Static `<strong>` | 3,729 |
| Highway swap stations | 其中高速公路换电站 | Static `<strong>` | 1,020 |
| Cumulative swaps | 实时累计换电次数 | Digit-flip `<li>` | 100,016,310 |
| Charging stations | 蔚来能源充电站 (slash) | Static `<strong>` | 4,898 |
| Charging piles | (same label, 2nd value) | Static `<strong>` | 28,035 |
| Cumulative charges | 实时累计充电次数 | Digit-flip `<li>` | 81,009,854 |
| Third-party piles | 接入第三方充电桩 | Static `<strong>` | 1,559,761 |
| Third-party usage % | 蔚来能源充电桩电量第三方用户占比 | Static `<strong>` | 85.85 |

---

## Extraction Strategy

### Why not plain `innerText`?

The digit-flip counters render each digit as a separate `<li>` element. `document.body.innerText` concatenates these unreliably. During animation, digits with `class="refresh"` show intermediate values.

### Structured JS Extraction

The scraper iterates every `<h6>` label on the page and extracts values from each label's **direct parent element** only:

1. **Static values**: Find all `<strong class="totalNum-*">` in the parent, join with " / " (preserves the slash format for charging stations/piles)
2. **Digit-flip values**: Find `.pe-biz-digit-flip` `<ul>` in the parent, join all `<li>` texts
3. **Fallback**: Find any `<strong>` without the totalNum class

**Critical scoping**: Using `h6.parentElement` (not `h6.closest('div')` or broader ancestor) to prevent cross-metric matches. Without this, `querySelector('.pe-biz-digit-flip')` on a broad ancestor returns the first digit-flip counter it finds, which may belong to a different metric.

### Wait Strategy

1. **`domcontentloaded`** — SPA has persistent WebSocket connections; `networkidle` never resolves
2. **`wait_for_function("截至")`** — Confirms data has loaded (up to 30s)
3. **Poll `li.refresh` count** — Every 2s until 0 (digit-flip animations complete, up to 30s)
4. **2s extra settle** — For trailing CSS transitions

### Sanity Checks

Before submitting, `scrape_nio_power.py` rejects data that looks like mid-animation garbage:

| Check | Threshold | Rationale |
|-------|-----------|-----------|
| `cumulativeSwaps` | > 1,000,000 | Should be ~100M+ |
| `cumulativeCharges` | > 1,000,000 | Should be ~80M+ |
| `swapStations` | > 100 | Should be ~3,000+ |

Exit code 1 on rejection, preventing bad data from reaching the database.

---

## Files

| File | Purpose |
|------|---------|
| `scraper/sources/nio_power.py` | `NioPowerScraper` class, JS extraction, and regex parsing |
| `scraper/scrape_nio_power.py` | Standalone CLI entry point with `--dry-run` and sanity checks |
| `scraper/tests/test_nio_power.py` | 23 unit tests for parsing and serialization |
| `scraper/api_client.py` | `EVPlatformAPI` with `NioPowerSnapshot` endpoint mapping |
| `src/app/api/nio-power-snapshot/route.ts` | API route for receiving snapshots |
| `.github/workflows/nio-power-scraper.yml` | GitHub Actions workflow |

### `scraper/scrape_nio_power.py`

Standalone CLI script (like `backfill_cnevdata.py`):

```bash
# Dry run — prints metrics, no API submission
python scrape_nio_power.py --dry-run

# Live — scrapes and submits to API
python scrape_nio_power.py
```

Exit code 1 on failure (scrape failure, sanity check rejection, or API submission failure).

---

## GitHub Actions Workflow

### Configuration

```yaml
name: NIO Power Charger Map Scraper
on:
  schedule:
    - cron: '0 */6 * * *'    # Every 6 hours
  workflow_dispatch:
    inputs:
      dry_run:
        type: boolean
        default: false
```

### Steps

1. Checkout code
2. Setup Python 3.11
3. Install pip dependencies
4. Install Playwright Chromium
5. Run `scrape_nio_power.py` (with `--dry-run` for manual trigger if selected)

### Environment

| Variable | Source | Purpose |
|----------|--------|---------|
| `WEBHOOK_URL` | GitHub Secrets | Used by `config.py` to derive `API_BASE_URL` |

### Failure Notifications

- Discord webhook notification
- Email notification via SMTP

### Timeout

10 minutes — page load + animation wait + API submission.

---

## Database Schema

### `NioPowerSnapshot` (Prisma)

Stores point-in-time snapshots of NIO Power infrastructure. Each scheduled or manual run creates a new row, building a time-series history.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Auto-generated CUID |
| `asOfTime` | DateTime | Timestamp from the page ("截至" time) |
| `totalStations` | Int | Total charging + swapping stations |
| `swapStations` | Int | NIO battery swap stations |
| `highwaySwapStations` | Int | Highway swap stations |
| `cumulativeSwaps` | BigInt | Total battery swaps performed |
| `chargingStations` | Int | NIO charging stations |
| `chargingPiles` | Int | NIO individual charging piles |
| `cumulativeCharges` | BigInt | Total charging sessions |
| `thirdPartyPiles` | Int | Connected third-party charging piles |
| `thirdPartyUsagePercent` | Float | Third-party user percentage |

Unique constraint on `asOfTime` — each page timestamp produces one snapshot. Multiple runs per day are fine (scheduled + manual triggers).

---

## Design Decisions

### Why a standalone pipeline?

NIO Power is fundamentally different from the article scraper:

1. **Single page, single snapshot** — no article list, no pagination, no AI processing
2. **Playwright dependency** — the article scraper uses HTTP requests; mixing Playwright adds complexity and startup time
3. **Independent scheduling** — frequency can change without affecting news scraping
4. **Independent re-runs** — `workflow_dispatch` with `--dry-run` for debugging
5. **Failure isolation** — NIO Power failure doesn't block article scraping, and vice versa

### Why structured JS extraction instead of plain `innerText`?

1. **Digit-flip counters** render each digit as a separate `<li>` — `innerText` concatenation is unreliable
2. **Slash-separated values** (charging stations / piles) need both `<strong>` elements grouped under their shared `<h6>` label
3. **Scoping** prevents cross-metric matches when a parent element contains multiple metric sections

### Why `domcontentloaded` instead of `networkidle`?

The SPA maintains persistent WebSocket/polling connections that never go idle, causing `networkidle` to always timeout at 30s. `domcontentloaded` fires quickly, and the `wait_for_function` on "截至" text is the real signal that data has rendered.

### Why poll `li.refresh` instead of fixed settle time?

The digit-flip animation duration varies. A fixed 5s settle was insufficient on GitHub Actions runners. Polling until `li.refresh` count reaches 0 directly checks animation completion rather than guessing a duration.
