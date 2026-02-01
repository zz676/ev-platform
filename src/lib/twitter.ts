import crypto from "crypto";

// X API v2 credentials
const API_KEY = process.env.X_API_KEY!;
const API_SECRET = process.env.X_API_SECRET!;
const ACCESS_TOKEN = process.env.X_ACCESS_TOKEN!;
const ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET!;

// OAuth 1.0a signature generation
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  // Sort parameters alphabetically
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");

  // Create signature base string
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join("&");

  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  // Generate HMAC-SHA1 signature
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(signatureBaseString)
    .digest("base64");

  return signature;
}

// Generate OAuth 1.0a header
function generateOAuthHeader(method: string, url: string): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN,
    oauth_version: "1.0",
  };

  // Generate signature
  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    API_SECRET,
    ACCESS_TOKEN_SECRET
  );

  oauthParams.oauth_signature = signature;

  // Build Authorization header
  const headerParams = Object.keys(oauthParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(", ");

  return `OAuth ${headerParams}`;
}

export interface Tweet {
  id: string;
  text: string;
}

export interface TweetResponse {
  data: Tweet;
}

export interface TwitterError {
  title: string;
  detail: string;
  type: string;
}

// Post a tweet
export async function postTweet(text: string): Promise<TweetResponse> {
  const url = "https://api.twitter.com/2/tweets";

  if (!API_KEY || !API_SECRET || !ACCESS_TOKEN || !ACCESS_TOKEN_SECRET) {
    throw new Error("X API credentials not configured");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: generateOAuthHeader("POST", url),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("X API error:", error);
    throw new Error(`X API error: ${error.detail || error.title || "Unknown error"}`);
  }

  return response.json();
}

// Format post for X
export function formatTweetContent(post: {
  translatedTitle?: string | null;
  translatedSummary: string;
  categories: string[];
  source: string;
  sourceUrl: string;
}): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinaevnews.com";

  // Category emoji mapping
  const categoryEmojis: Record<string, string> = {
    BYD: "🔋",
    NIO: "🔵",
    XPeng: "🟢",
    "Li Auto": "💜",
    Xiaomi: "🟠",
    Zeekr: "⚡",
    Sales: "📊",
    Technology: "🔧",
    Policy: "📋",
    Charging: "🔌",
    default: "🚗",
  };

  // Get category for display
  const mainCategory = post.categories[0] || "EV News";
  const emoji = categoryEmojis[mainCategory] || categoryEmojis.default;

  // Format source
  const sourceLabel = {
    OFFICIAL: "Official",
    MEDIA: "Media",
    WEIBO: "Weibo",
    MANUAL: "Report",
  }[post.source] || post.source;

  // Build tweet parts
  const title = post.translatedTitle
    ? `${emoji} ${mainCategory} | ${post.translatedTitle}`
    : `${emoji} ${mainCategory}`;

  const summary = post.translatedSummary;

  // Generate hashtags from categories
  const hashtags = ["#ChinaEV"];
  for (const cat of post.categories.slice(0, 3)) {
    const tag = cat.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "");
    if (tag) hashtags.push(`#${tag}`);
  }

  // Assemble tweet with character limit
  const footer = `\n\n📊 Source: ${sourceLabel}\n🔗 ${siteUrl}\n\n${hashtags.join(" ")}`;
  const maxSummaryLength = 280 - title.length - footer.length - 5; // 5 for newlines

  const truncatedSummary = summary.length > maxSummaryLength
    ? summary.substring(0, maxSummaryLength - 3) + "..."
    : summary;

  return `${title}\n\n${truncatedSummary}${footer}`;
}

// Verify credentials
export async function verifyCredentials(): Promise<boolean> {
  try {
    const url = "https://api.twitter.com/2/users/me";
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.X_BEARER_TOKEN}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
