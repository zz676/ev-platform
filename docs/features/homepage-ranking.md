# Homepage Ranking System

This document describes how posts are ranked and displayed on the homepage.

## Layout Structure

The homepage uses a 3-column layout with the following sections:

| Section | Position | Items | Source |
|---------|----------|-------|--------|
| Featured | Center (hero) | 1 | Smart selection |
| Left Column | Left side | 2 | Pool posts 1-2 |
| Top Headlines | Right side | 8 | Pool posts 3-10 |
| More News | Below fold | 10+ | Pool posts 11+ |

## Featured Post Selection Logic

The featured post uses a smart selection algorithm that prioritizes fresh, high-quality content:

### Priority 1: Fresh High-Quality News
- Posts from the **last 48 hours** with **relevance score >= 90**
- If multiple posts qualify, the highest scored is selected

### Priority 2: Fallback Comparison
If no fresh high-quality posts exist, the system compares:
- **Best from last 48 hours** (any score)
- **Best from last 7 days** (any score)

The post with the higher relevance score is selected.

```
┌─────────────────────────────────────────────┐
│  Check: Posts from last 48h with score ≥90  │
└──────────────────┬──────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │   Found posts?    │
         └────┬─────────┬────┘
              │         │
           Yes│         │No
              │         │
    ┌─────────▼───┐  ┌──▼──────────────────────┐
    │ Use highest │  │ Compare 48h best vs     │
    │ scored post │  │ 7d best, pick higher    │
    └─────────────┘  └─────────────────────────┘
```

## Pool Posts (Other Sections)

Posts for the left column, top headlines, and more news sections are fetched from a pool:

### Primary Pool: 7-Day Window
- All non-rejected posts from the last 7 days
- Sorted by **relevance score** (descending)
- Excludes the featured post
- Takes up to 20 posts

### Fallback Pool: 1-Month Window
If the 7-day pool has fewer than 10 posts:
- Expands to posts from the last 30 days
- Same sorting and exclusion rules

## Sorting Strategy

| Section | Sort Order |
|---------|------------|
| Featured | Smart selection (see above) |
| Left Column | By relevance score (desc) |
| Top Headlines | By relevance score (desc) |
| More News | By relevance score (desc) |

## Time Windows Summary

| Window | Duration | Purpose |
|--------|----------|---------|
| 48 hours | 2 days | Fresh content for featured |
| 7 days | 1 week | Primary pool for all sections |
| 30 days | 1 month | Fallback if insufficient posts |

## Relevance Score

The relevance score (0-100) is assigned during content ingestion based on:
- Topic relevance to EV industry
- Source credibility
- Content quality signals

A score of **90+** is considered high-quality content worthy of featured placement.
