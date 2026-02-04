/**
 * Discord webhook integration for posting EV news
 */

interface DiscordEmbed {
  title: string;
  description?: string;
  url?: string;
  color?: number;
  thumbnail?: { url: string };
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

interface DiscordWebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
}

/**
 * Post a message to Discord via webhook
 */
export async function postToDiscord(payload: DiscordWebhookPayload): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error("DISCORD_WEBHOOK_URL is not configured");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord webhook failed: ${response.status} - ${errorText}`);
  }
}

/**
 * Format an article for Discord posting
 */
export function formatDiscordMessage(params: {
  title: string;
  summary: string;
  category: string;
  source: string;
  sourceUrl: string;
  articleUrl: string;
  imageUrl?: string;
}): DiscordWebhookPayload {
  const { title, summary, category, source, sourceUrl, articleUrl, imageUrl } = params;

  // Category to color mapping (Discord colors are decimal)
  const categoryColors: Record<string, number> = {
    MARKET: 0x3b82f6, // blue
    TECH: 0x8b5cf6, // purple
    TESLA: 0xef4444, // red
    POLICY: 0x22c55e, // green
    OTHER: 0x6b7280, // gray
  };

  const color = categoryColors[category] || categoryColors.OTHER;

  // Truncate summary if too long (Discord limit is 4096 for embed description)
  const truncatedSummary =
    summary.length > 300 ? summary.substring(0, 297) + "..." : summary;

  const embed: DiscordEmbed = {
    title: title,
    description: truncatedSummary,
    url: articleUrl,
    color: color,
    fields: [
      {
        name: "Category",
        value: category,
        inline: true,
      },
      {
        name: "Source",
        value: `[${source}](${sourceUrl})`,
        inline: true,
      },
    ],
    footer: {
      text: "EV Juice | Electric Vehicle News",
    },
    timestamp: new Date().toISOString(),
  };

  if (imageUrl) {
    embed.thumbnail = { url: imageUrl };
  }

  return {
    embeds: [embed],
  };
}
