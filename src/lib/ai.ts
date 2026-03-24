import OpenAI from "openai";
import crypto from "crypto";
import path from "path";
import { put } from "@vercel/blob";
import prisma from "@/lib/prisma";

// Image generation pricing (as of 2025)
const IMAGE_GEN_COST = {
  // GPT Image 1 Mini
  "gpt-image-1-mini-1536x1024-low": 0.006,
} as const;

// Text completion pricing (per 1M tokens, as of 2024)
const TEXT_COMPLETION_COST = {
  "deepseek-chat": { input: 0.14, output: 0.28 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
} as const;

// Calculate cost for text completion based on token usage
function calculateTextCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = TEXT_COMPLETION_COST[model as keyof typeof TEXT_COMPLETION_COST];
  if (!pricing) {
    console.warn(`Unknown model for pricing: ${model}`);
    return 0;
  }
  // Cost = (input_tokens * input_price + output_tokens * output_price) / 1M
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

// Track AI usage in database
async function trackAIUsage(params: {
  type: string;
  model: string;
  size?: string;
  cost: number;
  success: boolean;
  errorMsg?: string;
  postId?: string;
  source: string;
  inputTokens?: number;
  outputTokens?: number;
}): Promise<void> {
  // Tests should not attempt to connect to a real database.
  if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID) {
    return;
  }

  try {
    await prisma.aIUsage.create({ data: params });
  } catch (error) {
    // Don't fail the main operation if tracking fails
    console.error("Failed to track AI usage:", error);
  }
}

export async function applyBrandingOverlay(imageUrl: string): Promise<string> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  let imageBuffer: Buffer;
  if (imageUrl.startsWith("data:")) {
    // Base64 data URL — decode directly without a network fetch
    const match = imageUrl.match(/^data:[^;]+;base64,(.+)$/);
    if (!match) {
      throw new Error("Invalid data URL format for branding overlay");
    }
    imageBuffer = Buffer.from(match[1], "base64");
  } else {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image for branding: HTTP ${response.status}`);
    }
    imageBuffer = Buffer.from(await response.arrayBuffer());
  }

  const { createCanvas, loadImage } = await import("canvas");
  const baseImage = await loadImage(imageBuffer);
  const width = baseImage.width;
  const height = baseImage.height;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(baseImage, 0, 0, width, height);

  // Logo size: ~14% of image height, positioned bottom-right with padding
  const padding = Math.round(width * 0.025);
  const logoSize = Math.round(height * 0.14);

  const logoPath = path.join(process.cwd(), "public", "juiceindex-logo.png");
  try {
    const logoImage = await loadImage(logoPath);
    const logoX = width - padding - logoSize;
    const logoY = height - padding - logoSize;
    // Subtle drop shadow for legibility on any background
    ctx.shadowColor = "rgba(0, 0, 0, 0.30)";
    ctx.shadowBlur = Math.round(logoSize * 0.08);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.round(logoSize * 0.04);
    ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
    ctx.shadowColor = "transparent";
  } catch {
    console.warn("[AI] Could not load juiceindex-logo.png, skipping branding overlay");
  }

  const outputBuffer = canvas.toBuffer("image/png");
  if (!blobToken) {
    console.warn("[AI] BLOB_READ_WRITE_TOKEN missing; returning data URL overlay");
    return `data:image/png;base64,${outputBuffer.toString("base64")}`;
  }

  try {
    const fileName = `generated/brand-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.png`;
    const blob = await put(fileName, outputBuffer, {
      access: "public",
      contentType: "image/png",
      token: blobToken,
    });

    return blob.url;
  } catch (error) {
    console.warn("[AI] Failed to upload branded overlay, returning data URL:", error);
    return `data:image/png;base64,${outputBuffer.toString("base64")}`;
  }
}

// AI Provider configuration
const providers = [
  {
    name: "deepseek",
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: "deepseek-chat",
  },
  {
    name: "openai",
    baseURL: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o-mini",
  },
];

// Get configured AI client (with fallback)
export async function getAIClient(): Promise<{ client: OpenAI; model: string }> {
  for (const provider of providers) {
    if (provider.apiKey) {
      const client = new OpenAI({
        apiKey: provider.apiKey,
        baseURL: provider.baseURL,
      });
      return { client, model: provider.model };
    }
  }
  throw new Error("No AI provider configured");
}

// Process EV content with AI
export async function processEVContent(content: string, source: string, postId?: string) {
  const { client, model } = await getAIClient();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are a professional EV industry analyst and translator. Process the following Chinese EV news content.

Return a JSON object with:
- relevance_score (0-100): News value + uniqueness + timeliness + credibility
- categories (array): Tags like "BYD", "NIO", "Sales", "Technology", "Policy"
- translated_title (string): English title
- translated_content (string): Full English translation
- x_summary (string): Twitter-friendly summary (max 250 chars)
- hashtags (array): Relevant hashtags like "#ChinaEV", "#BYD"

Scoring criteria:
- News Value (30): Important news, data, or announcements
- Uniqueness (25): China-specific perspective
- Timeliness (25): Current/breaking news
- Credibility (20): Source reliability

Translation requirements:
- Use correct terminology: NEV, BEV, PHEV
- Keep brand names: BYD, NIO, XPeng, Li Auto
- Natural English for international readers`,
      },
      {
        role: "user",
        content: `Source: ${source}\n\nContent:\n${content}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  // Track token usage
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const cost = calculateTextCost(model, inputTokens, outputTokens);

  await trackAIUsage({
    type: "text_completion",
    model,
    cost,
    success: true,
    postId,
    source: "process_content",
    inputTokens,
    outputTokens,
  });

  const result = response.choices[0].message.content;
  return result ? JSON.parse(result) : null;
}

// Translate content only
export async function translateContent(content: string, postId?: string) {
  const { client, model } = await getAIClient();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are a professional translator specializing in the EV industry. Translate the following Chinese content to English.

Requirements:
- Use correct industry terminology (NEV, BEV, PHEV)
- Keep Chinese brand names (BYD, NIO, XPeng, Li Auto)
- Preserve numbers and statistics accurately
- Make it natural for English readers`,
      },
      {
        role: "user",
        content,
      },
    ],
  });

  // Track token usage
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const cost = calculateTextCost(model, inputTokens, outputTokens);

  await trackAIUsage({
    type: "text_completion",
    model,
    cost,
    success: true,
    postId,
    source: "translate",
    inputTokens,
    outputTokens,
  });

  return response.choices[0].message.content;
}

// Generate X post summary
export async function generateXSummary(content: string, postId?: string) {
  const { client, model } = await getAIClient();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `Create a concise, engaging summary for X (Twitter).

Requirements:
- Maximum 250 characters (leave room for hashtags)
- Lead with the most important fact
- Include key numbers if applicable
- Make it engaging but factual`,
      },
      {
        role: "user",
        content,
      },
    ],
  });

  // Track token usage
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const cost = calculateTextCost(model, inputTokens, outputTokens);

  await trackAIUsage({
    type: "text_completion",
    model,
    cost,
    success: true,
    postId,
    source: "x_summary",
    inputTokens,
    outputTokens,
  });

  return response.choices[0].message.content;
}

// Generate image using GPT Image 1.5
export async function generatePostImage(
  title: string,
  summary: string,
  options?: {
    source?: string;
    postId?: string;
  }
): Promise<string> {
  const source = options?.source || "unknown";
  const postId = options?.postId;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    const error = "No image generation API configured (need OPENAI_API_KEY)";
    await trackAIUsage({
      type: "image_generation",
      model: "gpt-image-1.5",
      cost: 0,
      success: false,
      errorMsg: error,
      postId,
      source,
    });
    throw new Error(error);
  }

  const model = "gpt-image-1-mini";
  const size = "1536x1024" as const;
  const quality = "low" as const;
  const cost = IMAGE_GEN_COST["gpt-image-1-mini-1536x1024-low"];

  // Helper to pick a random element from an array
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // Variation pools for each style to ensure visual diversity
  const formulaCarVariations = {
    angles: [
      "ultra-low road-level shot, nose filling the bottom-center of the frame",
      "dramatic high 3/4 aerial shot looking down on the car mid-corner",
      "tight side-profile tracking shot with extreme motion blur on the background",
      "rear 3/4 chase camera angle showing the diffuser and rear wing in detail",
      "wide establishing shot from above the grandstands showing the full circuit bend",
    ],
    settings: [
      "a twisting Monaco-style street circuit with safety barriers and a tunnel entrance glowing orange",
      "a sweeping high-speed banked curve at a futuristic night circuit with LED strip lighting embedded in the walls",
      "a rain-drenched city circuit with reflective puddles and spray roosting from the tires",
      "a sun-baked desert straight with heat shimmer and sand dunes in the background",
      "a dawn start grid with fog rolling across the track and pit buildings silhouetted behind",
    ],
    colors: [
      "neon yellow and electric blue livery",
      "matte black with vivid red racing stripes",
      "pearl white with holographic teal accents",
      "deep metallic purple with gold pinstripes",
      "fluorescent orange and carbon-fiber black",
    ],
    details: [
      "Sparks fly from the underside as it scrapes the road. Motion blur streaks the barriers.",
      "Tire smoke billows behind in a thick white cloud. The brake discs glow cherry-red.",
      "Rain spray creates a fan of mist behind the car. Headlights cut through the murk.",
      "The DRS flap is wide open and heat haze distorts the air above the engine cover.",
      "Confetti from a recent podium celebration drifts across the frame in a colorful haze.",
    ],
  };

  const muscleCarVariations = {
    angles: [
      "dramatic 3/4 front angle, the car facing slightly toward the camera",
      "dead-center head-on shot with the hood stretching toward the lens",
      "low-angle rear 3/4 showing the wide haunches and twin exhaust tips",
      "side profile with the car in motion, dust trailing from the rear wheels",
      "elevated front-down shot emphasizing the massive hood and chrome grille",
    ],
    settings: [
      "a cracked desert salt flat at sunset with distant purple mesas",
      "a straight empty two-lane highway cutting through golden wheat fields at dusk",
      "a moody industrial waterfront at blue hour with old brick warehouses and steel bridges",
      "a dusty Route 66 gas station at twilight with a single flickering neon sign",
      "a wide red-rock canyon road with towering sandstone walls glowing amber in late sun",
    ],
    colors: [
      "deep candy-apple red with metallic flake",
      "midnight blue with dual white racing stripes",
      "matte olive green with chrome bumper accents",
      "burnt orange with a black vinyl roof and chrome trim",
      "jet black with subtle gold pinstriping along the body lines",
    ],
    details: [
      "Heat shimmer ripples off the hood. Chrome catches the orange glow.",
      "The driver's-side window is down and a leather-gloved hand rests on the door.",
      "Exhaust fumes curl upward in the cold evening air like wisps of smoke.",
      "One headlight pops up, casting a warm beam across the cracked pavement.",
      "Dust motes float in a single shaft of golden light hitting the windshield.",
    ],
  };

  const hypercarVariations = {
    angles: [
      "centered head-on, filling the mid-frame with an aggressive wide-body stance",
      "low 3/4 front angle showing the massive splitter and sculpted fenders",
      "overhead bird's-eye view looking straight down on the car's flowing roofline",
      "tight close-up of the front quarter showing air intakes and headlight detail",
      "rear-facing view through the tunnel, taillights blazing red and diffuser heat shimmering",
    ],
    settings: [
      "a raw concrete tunnel with moisture streaks and bold yellow reflective markers",
      "a glass-walled underground parking structure with fluorescent ceiling lights reflected in polished floors",
      "a curved highway overpass at dusk with city lights twinkling far below",
      "the entrance to a brutalist concrete bridge with dramatic geometric shadows",
      "a dimly-lit aircraft hangar with shafts of dusty light from high windows",
    ],
    colors: [
      "deep matte carbon-black with vivid orange aerodynamic accents",
      "liquid silver with electric green highlight lines along the body creases",
      "satin battleship grey with bright red carbon-fiber mirrors and splitter",
      "pearlescent white that shifts to blue under the tunnel lights",
      "bare exposed carbon-fiber weave with subtle copper-bronze accent trim",
    ],
    details: [
      "Brake rotors glow amber-red. The tunnel exit is a tiny blinding circle of daylight.",
      "LED running lights trace a sharp line across the front. Exhaust gases shimmer behind.",
      "Active aero flaps are fully deployed. Air vents on the hood expel hot turbulence.",
      "Ground-effect skirts nearly touch the floor. Puddle reflections mirror the car perfectly.",
      "Interior ambient lighting glows ice-blue through the tinted windshield glass.",
    ],
  };

  const roadsterVariations = {
    angles: [
      "slightly elevated side-front angle with the driver's scarf trailing in the wind",
      "low rear 3/4 showing the tapered tail, round taillights, and wire spare wheel",
      "dramatic front-on view through a stone archway framing the approaching car",
      "wide landscape shot with the car small in the lower third, the scenery dominating",
      "tight cockpit-level shot from the passenger seat showing the wood-rim steering wheel and road ahead",
    ],
    settings: [
      "a winding cliffside road on the Italian Riviera at golden hour with turquoise sea below",
      "a tree-lined French country lane in autumn with golden leaves drifting across the road",
      "a misty Scottish highland pass at dawn with heather-covered hills and a stone bridge",
      "a sun-drenched Tuscan vineyard road with cypress trees and a hilltop villa",
      "a coastal California highway with crashing Pacific waves and fog-wrapped headlands",
    ],
    colors: [
      "rich British racing green",
      "elegant cream white with a tan leather interior",
      "classic Rosso Corsa Ferrari red",
      "soft powder blue with chrome wire wheels",
      "warm Burgundy wine with a cream racing stripe",
    ],
    details: [
      "Sunlight rakes across the aluminum hood in warm gold. Bougainvillea cascades over a stone wall.",
      "Fallen leaves swirl in the car's wake. Morning dew beads on the chrome mirrors.",
      "The headlights glow softly in the mist. Sheep graze in a field beside the road.",
      "A picnic basket sits on the passenger seat. Cypress tree shadows stripe the road.",
      "Sea spray catches the light in a rainbow mist. Seagulls wheel above the cliff edge.",
    ],
  };

  const rallyCarVariations = {
    angles: [
      "low and slightly ahead, looking back as the car fills the left two-thirds in a 3/4 front angle",
      "high helicopter-style shot showing the car carving an S-curve through dense forest from above",
      "rear chase angle with the car's taillights glowing through a massive cloud of dust",
      "side-on tracking shot frozen mid-jump as the car launches off a crest",
      "tight front-on shot as the car smashes through a shallow river crossing, water exploding outward",
    ],
    settings: [
      "a muddy gravel forest stage lined with pine trees splattered by mud",
      "a snow-covered mountain pass with icy hairpins and snow banks on both sides",
      "a dry African savanna track with red dust and acacia trees in the distance",
      "a narrow Welsh valley road in heavy rain with stone walls and green hills",
      "a Finnish lakeside gravel road at midnight sun with golden light filtering through birch trees",
    ],
    colors: [
      "vivid white with bold neon-green and black rally blocks",
      "electric blue with bright yellow mud flaps and roof scoop",
      "fiery red with white door numbers and a black bonnet",
      "matte military green with orange rollcage visible through the windows",
      "bright Subaru-style rally blue with gold wheels caked in mud",
    ],
    details: [
      "A massive rooster-tail of mud and gravel explodes from the rear wheels.",
      "The co-driver's hand braces against the dashboard. A pace-note book flutters in the footwell.",
      "Snow chunks fly off the wheelarches like confetti. Studded tires bite the ice.",
      "Red dust hangs in the air from the previous car. The setting sun turns it to gold.",
      "The roof-mounted LED light bar blazes white. Fallen leaves pepper the air around the car.",
    ],
  };

  const cyberpunkVariations = {
    angles: [
      "low-angle front 3/4, headlights cutting razor-sharp beams into the lens",
      "dramatic top-down shot showing the car's sculpted roof and neon reflections in surrounding puddles",
      "rear 3/4 with glowing taillights creating long red streaks in the wet road",
      "ultra-wide establishing shot of a neon-lit street with the car small but luminous at center",
      "close-up front detail shot showing the LED light bar and rain droplets on the bodywork",
    ],
    settings: [
      "a rain-soaked urban street in a neon-drenched city with skyscrapers and steam from manhole covers",
      "an elevated highway overpass with holographic billboards and a sprawling city visible below",
      "a narrow back-alley between towering buildings with fire escapes and dripping neon signs",
      "a futuristic charging plaza with glowing floor panels and a circular glass tower behind",
      "a waterfront promenade at night with the car reflected in still harbor water and city lights beyond",
    ],
    colors: [
      "deep violet shifting to electric blue in the neon reflections",
      "chrome mirror finish reflecting all the surrounding neon colors",
      "matte titanium grey with pulsing cyan underglow LED strips",
      "glossy midnight black with magenta accent lighting in every crease",
      "iridescent green-gold chameleon paint that shifts color with every angle",
    ],
    details: [
      "Neon signs in vivid pink, teal, and orange reflect in the glossy body and flooded street.",
      "Holographic advertisements flicker above, casting shifting colored light across the car's roof.",
      "A drone hovers nearby, its spotlight creating a cone of light through the rain.",
      "Pedestrians with translucent umbrellas are silhouetted against a massive glowing video wall.",
      "Electric arcs spark from the charging port. Rain droplets on the hood glow like tiny jewels.",
    ],
  };

  // Build prompts with randomized elements for each style
  const imageStyles = [
    // Style 1: Electric Formula Race Car
    `A breathtaking cinematic motorsport photograph of a bold electric Formula-style single-seater race car in action. Camera: ${pick(formulaCarVariations.angles)}. Setting: ${pick(formulaCarVariations.settings)}. The car's livery is ${pick(formulaCarVariations.colors)}. ${pick(formulaCarVariations.details)} The aerodynamic body is sharp and dramatic with exposed wheels and detailed front wing. Colors are vivid and saturated. Mood: thunderous, heart-pounding, electric. NO text, logos, or license plates. Bottom-right corner: space for overlay.`,

    // Style 2: Classic American Muscle Revival
    `A stunning cinematic automotive photograph of a powerful wide-body American classic muscle car with a long hood, squared haunches, chrome details, and twin exhausts. Camera: ${pick(muscleCarVariations.angles)}. Setting: ${pick(muscleCarVariations.settings)}. The car's paint is ${pick(muscleCarVariations.colors)}. ${pick(muscleCarVariations.details)} Mood: raw power, American freedom, golden-era nostalgia. NO text, logos, or license plates. Bottom-right: space for overlay.`,

    // Style 3: Hypercar Tunnel/Urban Blast
    `An ultra-dramatic cinematic photograph of a low-slung hypercar with an aggressive wide-body stance, huge carbon splitter, gaping front intakes, and blazing headlights. Camera: ${pick(hypercarVariations.angles)}. Setting: ${pick(hypercarVariations.settings)}. The car's finish is ${pick(hypercarVariations.colors)}. ${pick(hypercarVariations.details)} Mood: ferocious, explosive, otherworldly. NO text, logos, or license plates. Bottom-right: space for overlay.`,

    // Style 4: Classic 1960s Sports Roadster
    `A gorgeous cinematic photograph of a curvaceous 1960s Italian-inspired open-top sports roadster with a long elegant hood, round headlights, wire wheels, and hand-formed aluminum bodywork. Camera: ${pick(roadsterVariations.angles)}. Setting: ${pick(roadsterVariations.settings)}. The car's paint is ${pick(roadsterVariations.colors)}. ${pick(roadsterVariations.details)} Mood: romantic, timeless, legendary. NO text, logos, or license plates. Bottom-right: space for overlay.`,

    // Style 5: Electric Rally Car
    `A ferocious cinematic action photograph of a compact electric rally car at full attack. Camera: ${pick(rallyCarVariations.angles)}. Setting: ${pick(rallyCarVariations.settings)}. The car's livery is ${pick(rallyCarVariations.colors)}. ${pick(rallyCarVariations.details)} Mood: wild, unhinged, heart-in-mouth rally drama. NO text, logos, or license plates. Bottom-right: space for overlay.`,

    // Style 6: Neon Cyberpunk EV Supercar
    `A cinematic night photograph of a futuristic electric supercar with an aggressive low wedge shape, active aerodynamics, and glowing underbody LED strips. Camera: ${pick(cyberpunkVariations.angles)}. Setting: ${pick(cyberpunkVariations.settings)}. The car's paint is ${pick(cyberpunkVariations.colors)}. ${pick(cyberpunkVariations.details)} Mood: cinematic cyberpunk, electric future. NO text, logos, or license plates. Bottom-right: space for overlay.`,
  ];

  const styleIndex = Math.floor(Math.random() * imageStyles.length);
  const imagePrompt = `${imageStyles[styleIndex]}
Topic context: ${title}. ${summary.slice(0, 150)}`;

  const openai = new OpenAI({ apiKey: openaiKey });

  let imageUrl: string;
  try {
    const response = await openai.images.generate({
      model,
      prompt: imagePrompt,
      n: 1,
      size,
      quality,
    });

    const url = response.data?.[0]?.url;
    const b64 = response.data?.[0]?.b64_json;
    if (url) {
      imageUrl = url;
    } else if (b64) {
      // gpt-image-1 family returns base64 by default, not a URL
      imageUrl = `data:image/png;base64,${b64}`;
    } else {
      throw new Error("GPT Image 1 Mini: no image data returned (no url or b64_json)");
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await trackAIUsage({
      type: "image_generation",
      model,
      size,
      cost: 0,
      success: false,
      errorMsg,
      postId,
      source,
    });
    throw error;
  }

  await trackAIUsage({
    type: "image_generation",
    model,
    size,
    cost,
    success: true,
    postId,
    source,
  });

  console.log(`GPT Image 1 Mini generated for: ${title.slice(0, 50)}... [source: ${source}, cost: $${cost}]`);

  try {
    return await applyBrandingOverlay(imageUrl);
  } catch (error) {
    console.warn("[AI] Branding overlay failed, using original image:", error);
    return imageUrl;
  }
}
