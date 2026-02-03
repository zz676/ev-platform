import crypto from "crypto";

// X API v2 endpoints (official docs: https://docs.x.com)
const MEDIA_UPLOAD_URL = "https://api.x.com/2/media/upload";
const TWEETS_URL = "https://api.x.com/2/tweets";

// Credentials from environment
const getCredentials = () => ({
  apiKey: process.env.X_API_KEY!,
  apiSecret: process.env.X_API_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN!,
  accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET!,
});

// OAuth 1.0a signature generation
export function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");

  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join("&");

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  return crypto
    .createHmac("sha1", signingKey)
    .update(signatureBaseString)
    .digest("base64");
}

// Generate OAuth 1.0a Authorization header
export function generateOAuthHeader(
  method: string,
  url: string,
  credentials?: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  }
): string {
  const creds = credentials || getCredentials();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    creds.apiSecret,
    creds.accessTokenSecret
  );

  oauthParams.oauth_signature = signature;

  const headerParams = Object.keys(oauthParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(", ");

  return `OAuth ${headerParams}`;
}

// Types
export interface Tweet {
  id: string;
  text: string;
}

export interface TweetResponse {
  data: Tweet;
}

export interface MediaUploadResponse {
  data: {
    id: string;
    media_key: string;
    expires_after_secs?: number;
    size?: number;
  };
}

// Download image from URL and return as base64
export async function downloadImageAsBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
}

// Upload media to X (v2 API)
export async function uploadMedia(imageUrl: string): Promise<string> {
  const creds = getCredentials();
  if (!creds.apiKey || !creds.apiSecret || !creds.accessToken || !creds.accessTokenSecret) {
    throw new Error("X API credentials not configured");
  }

  const base64Data = await downloadImageAsBase64(imageUrl);

  const payload = {
    media: base64Data,
    media_category: "tweet_image",
  };

  const response = await fetch(MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: generateOAuthHeader("POST", MEDIA_UPLOAD_URL),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`X Media Upload error: ${response.status} - ${errorText}`);
  }

  const result: MediaUploadResponse = await response.json();
  return result.data.id;
}

// Post a tweet (v2 API)
export async function postTweet(
  text: string,
  mediaIds?: string[]
): Promise<TweetResponse> {
  const creds = getCredentials();
  if (!creds.apiKey || !creds.apiSecret || !creds.accessToken || !creds.accessTokenSecret) {
    throw new Error("X API credentials not configured");
  }

  const payload: { text: string; media?: { media_ids: string[] } } = { text };

  if (mediaIds && mediaIds.length > 0) {
    payload.media = { media_ids: mediaIds };
  }

  const response = await fetch(TWEETS_URL, {
    method: "POST",
    headers: {
      Authorization: generateOAuthHeader("POST", TWEETS_URL),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    const errorMsg = error.errors?.[0]?.message || error.detail || error.title || "Unknown error";
    throw new Error(`X API error: ${errorMsg}`);
  }

  return response.json();
}

// Format post content for X (280 char limit)
export function formatTweetContent(post: {
  translatedTitle?: string | null;
  translatedSummary: string;
  categories: string[];
  source: string;
  sourceUrl: string;
}): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://evjuice.net";

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

  const mainCategory = post.categories[0] || "EV News";
  const emoji = categoryEmojis[mainCategory] || categoryEmojis.default;

  const sourceLabel: Record<string, string> = {
    OFFICIAL: "Official",
    MEDIA: "Media",
    WEIBO: "Weibo",
    MANUAL: "Report",
  };

  const title = post.translatedTitle
    ? `${emoji} ${mainCategory} | ${post.translatedTitle}`
    : `${emoji} ${mainCategory}`;

  const hashtags = ["#ChinaEV"];
  for (const cat of post.categories.slice(0, 3)) {
    const tag = cat.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "");
    if (tag) hashtags.push(`#${tag}`);
  }

  const footer = `\n\n📊 Source: ${sourceLabel[post.source] || post.source}\n🔗 ${siteUrl}\n\n${hashtags.join(" ")}`;
  const maxSummaryLength = 280 - title.length - footer.length - 5;

  const truncatedSummary = post.translatedSummary.length > maxSummaryLength
    ? post.translatedSummary.substring(0, maxSummaryLength - 3) + "..."
    : post.translatedSummary;

  return `${title}\n\n${truncatedSummary}${footer}`;
}

// Verify credentials using bearer token
export async function verifyCredentials(): Promise<boolean> {
  try {
    const response = await fetch("https://api.x.com/2/users/me", {
      headers: {
        Authorization: `Bearer ${process.env.X_BEARER_TOKEN}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
