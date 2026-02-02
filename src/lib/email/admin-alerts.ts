import { Resend } from "resend";
import { POSTING_CONFIG } from "@/lib/config/posting";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

interface AlertParams {
  subject: string;
  body: string;
}

/**
 * Send alert email to all admin addresses
 */
export async function sendAdminAlert({ subject, body }: AlertParams): Promise<void> {
  if (!resend) {
    console.log("[Admin Alert] Resend not configured");
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);
    return;
  }

  const adminEmails = POSTING_CONFIG.ADMIN_EMAILS;

  if (adminEmails.length === 0) {
    console.log("[Admin Alert] No admin emails configured");
    return;
  }

  try {
    await resend.emails.send({
      from: "China EV News <alerts@chinaevnews.com>",
      to: adminEmails,
      subject: `[EV Platform] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1;">EV Platform Alert</h2>
          <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
            ${body.replace(/\n/g, "<br>")}
          </div>
          <p style="color: #666; font-size: 12px;">
            This is an automated alert from China EV News platform.
          </p>
        </div>
      `,
    });
    console.log(`[Admin Alert] Sent: ${subject}`);
  } catch (error) {
    console.error("[Admin Alert] Failed to send:", error);
  }
}

/**
 * Alert when no content is available for digest
 */
export async function alertNoDigestContent(digestTime: string): Promise<void> {
  await sendAdminAlert({
    subject: "No Content for Daily Digest",
    body: `
The scheduled digest for ${digestTime} UTC has no eligible posts.

Criteria for digest posts:
- Status: APPROVED
- Not yet published to X
- Not included in previous digest
- Relevance score: 50-84

Please check if the scraper is running and producing content.
    `.trim(),
  });
}

/**
 * Alert when digest posting fails
 */
export async function alertDigestPostingFailed(
  digestTime: string,
  error: string
): Promise<void> {
  await sendAdminAlert({
    subject: "Digest Posting Failed",
    body: `
The scheduled digest for ${digestTime} UTC failed to post.

Error: ${error}

Please check the X API credentials and rate limits.
    `.trim(),
  });
}

/**
 * Alert when daily post limit is reached
 */
export async function alertDailyLimitReached(count: number): Promise<void> {
  await sendAdminAlert({
    subject: "Daily Post Limit Reached",
    body: `
The daily X posting limit has been reached.

Posts today: ${count}
Limit: ${POSTING_CONFIG.MAX_POSTS_PER_DAY}

VIP posts will resume tomorrow.
    `.trim(),
  });
}
