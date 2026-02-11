# Data API (SaaS) - API Keys, Rate Limits, and v1 Endpoints

## Overview
The EV Platform exposes a versioned Data API under `/api/v1/*` for programmatic access to structured EV metrics.

This API is authenticated via **API keys** and includes **per-tier daily rate limits**.

## Authentication
Send your API key on every request:

- `Authorization: Bearer <api_key>` (recommended)
- `x-api-key: <api_key>` (supported)

Example:

```bash
curl -s \
  -H "Authorization: Bearer evk_your_key_here" \
  "http://localhost:3000/api/v1/brands"
```

## API Key Management (User Dashboard)
API keys can be created and revoked from:
- `/{locale}/settings` (Data API section)

Internally, this uses:
- `GET /api/api-keys` (list keys)
- `POST /api/api-keys` (create key)
- `DELETE /api/api-keys/:id` (revoke key)

**Important:** The plaintext key is only shown once at creation time. It is never stored in the database.

## Rate Limiting
Per-tier daily limits (UTC day buckets):

| Tier | Limit |
|------|-------|
| FREE | 100/day |
| STARTER | 1,000/day |
| PRO | 10,000/day |
| ENTERPRISE | Unlimited |

Rate limit headers:
- `X-Api-Tier`
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset` (epoch seconds)
- `Retry-After` (only on `429`)

## FREE Tier Restrictions
FREE tier is intentionally limited:
- Brand metrics only
- `metric=DELIVERY`
- `periodType=MONTHLY`
- Enforced ~30-day delay for monthly buckets (latest month available is `(now - 30 days)` in UTC)

Requests outside the FREE entitlement return `403`.

## Implemented v1 Endpoints

### `GET /api/v1/brands`
Returns the available brand codes.

```bash
curl -s \
  -H "Authorization: Bearer evk_your_key_here" \
  "http://localhost:3000/api/v1/brands"
```

### `GET /api/v1/brands/{brand}/metrics`
Returns time-series metrics for a brand (powered by `EVMetric`).

Query params:
- `metric` (default: `DELIVERY`)
- `periodType` (default: `MONTHLY`)
- `from` / `to` (only for `periodType=MONTHLY`, format: `YYYY-MM`)
- `limit` (default: `200`, max: `500`)
- `page` (default: `1`)
- `format` (`json` (default) or `csv`)
- Optional filters: `vehicleModel`, `region`, `category`, `dataSource`, `year`, `period`

Example (JSON):
```bash
curl -s \
  -H "Authorization: Bearer evk_your_key_here" \
  "http://localhost:3000/api/v1/brands/NIO/metrics?metric=DELIVERY&periodType=MONTHLY&from=2024-01&to=2024-12"
```

Example (CSV):
```bash
curl -s \
  -H "Authorization: Bearer evk_your_key_here" \
  "http://localhost:3000/api/v1/brands/NIO/metrics?metric=DELIVERY&periodType=MONTHLY&from=2024-01&to=2024-12&format=csv"
```

## Database Schema
New tables added for the SaaS API layer:
- `ApiKey` (hashed key + tier + status)
- `ApiUsageDaily` (per-key daily counters used for rate limiting)
- `ApiUsage` (request logs for auditing/billing)

To apply these to your database, run:
- `npm run db:push`

