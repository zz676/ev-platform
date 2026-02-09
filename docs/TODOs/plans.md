# Plans (Aggregated)

## Performance Improvement Plan (TTFB‑first)

### Summary
Reduce initial server latency by avoiding unnecessary Supabase calls and heavy counts, then trim client JS by converting non‑interactive cards to server components and lazy‑loading rarely used UI (login modal, user panel, back‑to‑top). Add caching headers for hot API routes to improve repeat visits.

### Implemented Changes
- Middleware skips Supabase session refresh unless auth cookies exist or route is protected.
- Home page uses a single 30‑day query and derives featured + sections in memory.
- `/api/posts?compact=1` skips `count()` by default and uses `hasMore = posts.length === limit`.
- Added cache headers to `/api/posts` and `/api/stocks`.
- Converted `HeroCard` and `SideNewsCard` to server components.
- Lazy‑load `LoginModal`, `UserPanel`, and `BackToTop` on the client.

### API Change
`GET /api/posts?compact=1`
- New optional query param: `includeTotal=1`
- Default: no `count()`; `pagination.total` and `pagination.totalPages` are `null`
- `pagination.hasMore` computed from page size

### Validation Checklist
- `npm run build` (requires Next.js SWC package to be reachable)
- `curl -w "%{time_starttransfer}\n" -o /dev/null -s http://localhost:3000/en`
- `GET /api/posts?compact=1&skip=0&limit=6` returns `total: null`

### Notes / Follow‑ups
- If SWC download fails, ensure registry/network access for Next.js build.
- Consider adding optional aggregation endpoints if needed (pending clarification).

---

## TODO: Improve Search with PostgreSQL Full-Text Search

### Current Implementation
Admin search uses Prisma `contains` with `mode: "insensitive"`:
- Simple substring matching
- Supports quoted exact phrases: `"NIO Delivery"`
- Supports multi-word AND search: `NIO Delivery` (both words must appear)

**Location:** `src/app/api/admin/posts/route.ts`

### Limitations
1. No relevance ranking (results not sorted by match quality)
2. No typo tolerance
3. No word stemming ("deliver" won't match "delivery")
4. No stop word handling
5. Performance may degrade with large datasets

### Recommended Upgrade: PostgreSQL Full‑Text Search

#### Step 1: Add search vector column
```sql
ALTER TABLE "Post" ADD COLUMN search_vector tsvector;

UPDATE "Post" SET search_vector =
  to_tsvector('english', COALESCE("translatedTitle", '') || ' ' || COALESCE("originalTitle", ''));

CREATE INDEX idx_post_search ON "Post" USING GIN(search_vector);

CREATE OR REPLACE FUNCTION update_post_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW."translatedTitle", '') || ' ' || COALESCE(NEW."originalTitle", ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_search_vector_trigger
BEFORE INSERT OR UPDATE ON "Post"
FOR EACH ROW EXECUTE FUNCTION update_post_search_vector();
```

#### Step 2: Update Prisma schema
```prisma
model Post {
  // ... existing fields
  searchVector Unsupported("tsvector")?

  @@index([searchVector], type: Gin)
}
```

#### Step 3: Update search query
```typescript
const posts = await prisma.$queryRaw`
  SELECT * FROM "Post"
  WHERE search_vector @@ plainto_tsquery('english', ${search})
  ORDER BY ts_rank(search_vector, plainto_tsquery('english', ${search})) DESC
  LIMIT ${limit} OFFSET ${skip}
`;
```

### Benefits
| Feature | Current | With FTS |
|---|---|---|
| Relevance ranking | ❌ | ✅ |
| Word stemming | ❌ | ✅ |
| Stop words | ❌ | ✅ |
| Performance at scale | ⚠️ | ✅ |
| Phrase search | ✅ | ✅ |
| Multi-word AND | ✅ | ✅ |

### Alternative: External Search Service
- Algolia
- MeiliSearch
- Elasticsearch

### Priority
Medium. Consider when post count exceeds 10,000 or search quality becomes a user issue.
