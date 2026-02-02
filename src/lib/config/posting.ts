// X Posting Configuration
// Environment variables can override defaults

export const POSTING_CONFIG = {
  // Thresholds (env var overrides)
  VIP_THRESHOLD: parseInt(process.env.X_VIP_THRESHOLD || "85"),
  MIN_RELEVANCE_SCORE: parseInt(process.env.X_MIN_RELEVANCE_SCORE || "50"),

  // Rate limits
  MAX_POSTS_PER_DAY: parseInt(process.env.X_MAX_POSTS_PER_DAY || "15"),
  MAX_VIP_PER_RUN: parseInt(process.env.X_MAX_VIP_PER_RUN || "2"),

  // Digest settings
  DIGEST_POSTS_PER_TWEET: 4,
  DIGEST_INCLUDE_IMAGE: true, // Include top post's image

  // Schedule (UTC hours) - optimized for US & EU
  VIP_CHECK_HOURS: [6, 12, 15, 18, 22], // 5x daily
  DIGEST_HOURS: [13, 22], // 2x daily (8AM EST, 5PM EST)

  // Admin emails for alerts
  ADMIN_EMAILS: [
    "admin@evjuice.com",
    "zhishengzhou1984@gmail.com",
    "ev.juice.info@gmail.com",
  ],

  // Site configuration
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://chinaevnews.com",
  SITE_HASHTAGS: ["#ChinaEV", "#EVNews"],
};
