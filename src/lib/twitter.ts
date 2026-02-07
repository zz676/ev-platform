import crypto from "crypto";

// X API endpoints
// Media upload uses v1.1 (v2 requires binary format, v1.1 supports base64)
const MEDIA_UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";
// Tweets use v2 API
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

// v1.1 media upload response format
export interface MediaUploadResponse {
  media_id: number;
  media_id_string: string;
  size?: number;
  expires_after_secs?: number;
  image?: {
    image_type: string;
    w: number;
    h: number;
  };
}

// Validate that an image URL is accessible and returns actual image data
export async function isImageUrlAccessible(imageUrl: string): Promise<boolean> {
  try {
    console.log(`[Twitter] Validating image URL accessibility: ${imageUrl}`);
    
    const response = await fetch(imageUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!response.ok) {
      console.log(`[Twitter] Image URL not accessible: HTTP ${response.status}`);
      return false;
    }
    
    const contentType = response.headers.get("content-type");
    
    // Check if content-type indicates an image
    if (!contentType || !contentType.startsWith("image/")) {
      console.log(`[Twitter] Image URL returned non-image content-type: ${contentType}`);
      return false;
    }
    
    console.log(`[Twitter] Image URL is accessible: content-type=${contentType}`);
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`[Twitter] Image URL validation failed: ${errorMsg}`);
    return false;
  }
}

// Download image from URL and return as base64
export async function downloadImageAsBase64(imageUrl: string): Promise<string> {
  console.log(`[Twitter] Downloading image from: ${imageUrl}`);

  const response = await fetch(imageUrl);
  if (!response.ok) {
    const errorMsg = `Failed to download image: HTTP ${response.status} ${response.statusText}`;
    console.error(`[Twitter] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const contentType = response.headers.get("content-type");
  const contentLength = response.headers.get("content-length");
  console.log(`[Twitter] Image response: content-type=${contentType}, content-length=${contentLength}`);

  // Verify content-type is actually an image
  if (!contentType || !contentType.startsWith("image/")) {
    const errorMsg = `URL did not return an image. Content-Type: ${contentType}`;
    console.error(`[Twitter] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const arrayBuffer = await response.arrayBuffer();
  
  // Additional check: verify the response is large enough to be a real image
  if (arrayBuffer.byteLength < 1000) {
    const errorMsg = `Downloaded content too small to be a valid image (${arrayBuffer.byteLength} bytes)`;
    console.error(`[Twitter] ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  console.log(`[Twitter] Image downloaded: ${arrayBuffer.byteLength} bytes, base64 length: ${base64.length}`);

  return base64;
}

// Upload media to X (v1.1 API - supports base64 via form-urlencoded)
export async function uploadMedia(imageUrl: string): Promise<string> {
  console.log(`[Twitter] uploadMedia called with URL: ${imageUrl}`);

  const creds = getCredentials();
  if (!creds.apiKey || !creds.apiSecret || !creds.accessToken || !creds.accessTokenSecret) {
    const errorMsg = "X API credentials not configured";
    console.error(`[Twitter] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Step 1: Download image
  console.log("[Twitter] Step 1: Downloading image...");
  let base64Data: string;
  try {
    base64Data = await downloadImageAsBase64(imageUrl);
  } catch (downloadError) {
    const errorMsg = downloadError instanceof Error ? downloadError.message : String(downloadError);
    console.error(`[Twitter] Image download failed: ${errorMsg}`);
    throw new Error(`Image download failed: ${errorMsg}`);
  }

  // Step 2: Upload to X API
  console.log("[Twitter] Step 2: Uploading to X API...");
  const formBody = new URLSearchParams();
  formBody.append("media_data", base64Data);

  let response: Response;
  try {
    response = await fetch(MEDIA_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: generateOAuthHeader("POST", MEDIA_UPLOAD_URL),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
    });
  } catch (fetchError) {
    const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
    console.error(`[Twitter] X API fetch failed: ${errorMsg}`);
    throw new Error(`X API fetch failed: ${errorMsg}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    const errorMsg = `X Media Upload error: HTTP ${response.status} - ${errorText}`;
    console.error(`[Twitter] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const result: MediaUploadResponse = await response.json();
  console.log("[Twitter] Media upload response:", JSON.stringify(result));

  // v1.1 returns media_id_string (use string version for v2 tweets API)
  const mediaId = result.media_id_string;
  if (!mediaId) {
    const errorMsg = `X Media Upload failed: No media_id_string in response. Got: ${JSON.stringify(result)}`;
    console.error(`[Twitter] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  console.log(`[Twitter] Media upload successful, media_id: ${mediaId}`);
  return mediaId;
}

// Post a tweet (v2 API)
// If bearerToken is provided (from linked user account), uses OAuth 2.0 Bearer.
// Otherwise falls back to app-level OAuth 1.0a.
export async function postTweet(
  text: string,
  mediaIds?: string[],
  bearerToken?: string
): Promise<TweetResponse> {
  let authHeader: string;

  if (bearerToken) {
    authHeader = `Bearer ${bearerToken}`;
  } else {
    const creds = getCredentials();
    if (!creds.apiKey || !creds.apiSecret || !creds.accessToken || !creds.accessTokenSecret) {
      throw new Error("X API credentials not configured");
    }
    authHeader = generateOAuthHeader("POST", TWEETS_URL);
  }

  const payload: { text: string; media?: { media_ids: string[] } } = { text };

  if (mediaIds && mediaIds.length > 0) {
    payload.media = { media_ids: mediaIds };
  }

  const response = await fetch(TWEETS_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader,
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
