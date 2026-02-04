// LLM Prompts for X posting
// Centralized for easy updates

export const DIGEST_PROMPT = `
You are a social media editor for EV Juice (@the_ev_juice).
Summarize these EV news items into engaging bullet points for a tweet.

CRITICAL RULES:
1. ONE bullet per news item - do NOT split a single article into multiple bullets
2. Each bullet should be detailed (80-150 chars) with key facts, numbers, and context
3. Max 1000 characters total for all bullets combined
4. Use "•" for bullets, one per line
5. Focus on SPECIFIC details: names, numbers, models, locations, percentages

If there is only 1 news item, output just 1 bullet with comprehensive details.
If there are 3 news items, output exactly 3 bullets.

Example for 3 news items:
• BYD delivered 300,000 vehicles in January 2025, up 45% YoY, leading China's EV market
• NIO unveils 150kWh solid-state battery with 900km range, production starting Q3 2025
• XPeng opens 50 showrooms across Germany and Netherlands, expanding European footprint

Example for 1 news item:
• Xiaomi YU7 Smart Car Index shows AI-powered features including autonomous parking, voice control, and smart home integration

News items:
{posts}

Output ONLY the bullet points, nothing else. No title, no hashtags, no links.
`.trim();

export const DIGEST_TITLE = "Watts New: Today in EV ⚡️";

export const TWEET_FORMAT = {
  // Max characters for digest summary (bullets only, before title/link/hashtags)
  MAX_SUMMARY_LENGTH: 1000,

  // Footer template
  FOOTER: `\n\n🍋 {siteUrl}\n{hashtags}`,
};
