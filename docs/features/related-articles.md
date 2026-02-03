# Related Articles Sidebar

This document describes the design and implementation of the "Related Articles" sidebar shown on article detail pages.

## Overview

The related articles sidebar displays up to 5 articles that are related to the current article, helping users discover relevant content.

**Location:** Article detail page (`/[locale]/post/[id]`)
**File:** `src/app/[locale]/post/[id]/page.tsx`

## Selection Logic

### Query Criteria

Related articles must match:
1. **Not the current article** - Excludes the article being viewed
2. **Approved/Published status** - Only shows publicly visible articles
3. **Category overlap** - Must share at least one category with the current article

### Sorting

Articles are sorted by:
1. **Relevance score** (descending) - Most relevant first
2. **Source date** (descending) - Most recent as tiebreaker

```
┌─────────────────────────────────────┐
│  Query: Same category, not current  │
│  Status: APPROVED or PUBLISHED      │
└──────────────────┬──────────────────┘
                   │
         ┌─────────▼─────────┐
         │  Sort by:          │
         │  1. relevanceScore │
         │  2. sourceDate     │
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │  Take 10 candidates│
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │  Deduplicate by    │
         │  title             │
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │  Return top 5      │
         └────────────────────┘
```

## Deduplication

The same article may exist multiple times in the database (scraped from different sources or at different times). To avoid showing duplicates:

1. Fetch 10 candidate articles (extra buffer for filtering)
2. Track seen titles in a Set (case-insensitive, trimmed)
3. Filter out articles with already-seen titles
4. Return first 5 unique articles

```typescript
const seenTitles = new Set<string>();
relatedPosts = relatedPosts.filter((rp) => {
  const title = (rp.translatedTitle || rp.originalTitle || "").toLowerCase().trim();
  if (seenTitles.has(title)) return false;
  seenTitles.add(title);
  return true;
}).slice(0, 5);
```

## Data Fields

| Field | Purpose |
|-------|---------|
| id | Navigation link |
| originalTitle | Display (Chinese locale) |
| translatedTitle | Display (English locale) |
| categories | Category badge |
| sourceDate | Timestamp display |
| sourceUrl | Available for deduplication |

## Design Decisions

### Why category-only matching (not source)?

**Previous implementation:** Used `OR` clause matching category OR source
**Problem:** Same article from same source could appear multiple times due to scraping inconsistencies

**Current implementation:** Category-only matching
**Benefits:**
- Eliminates most duplicate scenarios
- More semantically meaningful (related by topic, not just origin)
- Simpler query with better performance

### Why fetch 10, return 5?

Fetching more candidates than needed provides buffer for deduplication. If 3 of the top 10 are duplicates, we still have 7 unique articles to choose from and can return 5.

### Why relevance score over date?

- Users want the most relevant content, not just the newest
- Relevance score (0-100) considers topic importance and quality
- Source date is secondary for freshness tiebreaking

## Error Handling

If the related articles query fails:
- Log error to console
- Continue with empty related articles array
- Article page still renders without sidebar

This ensures the main article content is always accessible even if the sidebar feature fails.

## TODOs / Future Improvements

### Algorithm Improvements

- [ ] **Title similarity matching** - Use fuzzy matching (Levenshtein distance) to catch near-duplicate titles with minor variations (e.g., "Tesla Q4 Results" vs "Tesla Q4 Earnings Results")
- [ ] **Semantic similarity** - Use embeddings to find articles with similar content, not just category overlap
- [ ] **Multi-category weighting** - Score higher when multiple categories match, not just one
- [ ] **Recency decay** - Combine relevance score with time-based decay to balance relevance and freshness
- [ ] **User engagement signals** - Factor in click-through rates and read time to surface popular related content
- [ ] **Exclude same-day duplicates** - Skip articles from same source published within 24 hours (likely duplicate scrapes)

### UI Improvements

- [ ] **Thumbnail images** - Show article thumbnails in the sidebar for visual appeal
- [ ] **Category badges** - Display category chips to show why articles are related
- [ ] **"More like this"** - Add expandable section or link to search filtered by current article's categories
- [ ] **Lazy loading** - Load related articles after main content for faster initial page load
- [ ] **Skeleton loading** - Show placeholder UI while related articles are being fetched
- [ ] **Empty state** - Better messaging when no related articles are found

### Performance Improvements

- [ ] **Caching** - Cache related articles for popular posts (Redis or in-memory)
- [ ] **Pre-computation** - Compute and store related article IDs during article ingestion
- [ ] **Database index** - Ensure composite index on (status, categories, relevanceScore, sourceDate)
