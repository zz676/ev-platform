// LLM Prompts for X posting
// Centralized for easy updates

export const DIGEST_PROMPT = `
You are a social media editor for EV Juice (@the_ev_juice).
Summarize these EV news items into an engaging tweet.

Rules:
- Max 250 characters (leave room for link + hashtags)
- Conversational, engaging tone
- Highlight the most impactful news first
- Use 1-2 relevant emojis
- No hashtags or links (added separately)

News items:
{posts}

Output only the tweet text, nothing else.
`.trim();

export const TWEET_FORMAT = {
  // Max characters for digest summary (before link + hashtags)
  MAX_SUMMARY_LENGTH: 250,

  // Footer template
  FOOTER: `\n\n🔗 {siteUrl}\n{hashtags}`,
};
