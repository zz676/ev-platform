# TODO: Improve Search with PostgreSQL Full-Text Search

## Current Implementation

The admin search currently uses Prisma's `contains` with `mode: "insensitive"`:
- Simple substring matching
- Supports quoted exact phrases: `"NIO Delivery"`
- Supports multi-word AND search: `NIO Delivery` (both words must appear)

**Location:** `src/app/api/admin/posts/route.ts`

## Limitations

1. No relevance ranking (results not sorted by match quality)
2. No typo tolerance
3. No word stemming ("deliver" won't match "delivery")
4. No stop word handling
5. Performance may degrade with large datasets

## Recommended Upgrade: PostgreSQL Full-Text Search

PostgreSQL (used by Supabase) has built-in full-text search that's much more powerful.

### Step 1: Add search vector column

```sql
-- Add tsvector column for fast searching
ALTER TABLE "Post" ADD COLUMN search_vector tsvector;

-- Populate it (combine title fields)
UPDATE "Post" SET search_vector =
  to_tsvector('english', COALESCE("translatedTitle", '') || ' ' || COALESCE("originalTitle", ''));

-- Create index for fast searches
CREATE INDEX idx_post_search ON "Post" USING GIN(search_vector);

-- Create trigger to auto-update on insert/update
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

### Step 2: Update Prisma schema

```prisma
model Post {
  // ... existing fields
  searchVector Unsupported("tsvector")?

  @@index([searchVector], type: Gin)
}
```

### Step 3: Update search query

```typescript
// Use raw query for full-text search
const posts = await prisma.$queryRaw`
  SELECT * FROM "Post"
  WHERE search_vector @@ plainto_tsquery('english', ${search})
  ORDER BY ts_rank(search_vector, plainto_tsquery('english', ${search})) DESC
  LIMIT ${limit} OFFSET ${skip}
`;
```

### Benefits

| Feature | Current | With FTS |
|---------|---------|----------|
| Relevance ranking | ❌ | ✅ |
| Word stemming | ❌ | ✅ |
| Stop words | ❌ | ✅ |
| Performance at scale | ⚠️ | ✅ |
| Phrase search | ✅ | ✅ |
| Multi-word AND | ✅ | ✅ |

## Alternative: External Search Service

For even more advanced features (typo tolerance, faceted search, analytics):

- **Algolia** - Hosted, easy setup, ~$1/1000 searches
- **MeiliSearch** - Self-hosted or cloud, open source
- **Elasticsearch** - Powerful but complex setup

## Priority

Medium - Current implementation works for admin use. Consider upgrading when:
- Post count exceeds 10,000
- Users complain about search quality
- Need public-facing search with ranking
