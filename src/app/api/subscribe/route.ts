import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Language, Frequency } from "@prisma/client";
import { Resend } from "resend";
import crypto from "crypto";

function generateId(): string {
  return crypto.randomBytes(12).toString("hex");
}

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const subscribeSchema = z.object({
  email: z.string().email("Invalid email address"),
  language: z.enum(["EN", "ZH"]).optional().default("EN"),
  categories: z.array(z.string()).optional().default([]),
  frequency: z.enum(["DAILY", "WEEKLY"]).optional().default("DAILY"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = subscribeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { email, language, categories, frequency } = validation.data;

    // Check if already subscribed
    const existing = await prisma.subscriber.findUnique({
      where: { email },
    });

    if (existing) {
      if (existing.verified) {
        return NextResponse.json(
          { error: "Email already subscribed" },
          { status: 409 }
        );
      }

      // Resend verification email
      const verifyToken = crypto.randomBytes(32).toString("hex");
      await prisma.subscriber.update({
        where: { email },
        data: { verifyToken },
      });

      await sendVerificationEmail(email, verifyToken);

      return NextResponse.json({
        message: "Verification email resent",
        requiresVerification: true,
      });
    }

    // Create new subscriber
    const verifyToken = crypto.randomBytes(32).toString("hex");

    const subscriber = await prisma.subscriber.create({
      data: {
        id: generateId(),
        email,
        language: language as Language,
        categories,
        frequency: frequency as Frequency,
        verifyToken,
        updatedAt: new Date(),
      },
    });

    // Send verification email
    await sendVerificationEmail(email, verifyToken);

    return NextResponse.json(
      {
        message: "Subscription created. Please verify your email.",
        subscriberId: subscriber.id,
        requiresVerification: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json(
      { error: "Failed to create subscription" },
      { status: 500 }
    );
  }
}

async function sendVerificationEmail(email: string, token: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const verifyUrl = `${siteUrl}/api/subscribe/verify?token=${token}`;

  if (!resend) {
    console.log("Resend not configured. Verification URL:", verifyUrl);
    return;
  }

  await resend.emails.send({
    from: "EV Juice <noreply@evjuice.net>",
    to: email,
    subject: "Verify your subscription to EV Juice",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6366f1;">Welcome to EV Juice!</h1>
        <p>Thank you for subscribing to our newsletter.</p>
        <p>Please click the button below to verify your email address:</p>
        <a href="${verifyUrl}"
           style="display: inline-block; background-color: #6366f1; color: white;
                  padding: 12px 24px; text-decoration: none; border-radius: 6px;
                  margin: 16px 0;">
          Verify Email
        </a>
        <p style="color: #666; font-size: 14px;">
          Or copy this link: ${verifyUrl}
        </p>
        <p style="color: #999; font-size: 12px;">
          If you didn't subscribe, you can ignore this email.
        </p>
      </div>
    `,
  });
}

// Verification endpoint
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Verification token required" },
        { status: 400 }
      );
    }

    const subscriber = await prisma.subscriber.findFirst({
      where: { verifyToken: token },
    });

    if (!subscriber) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: {
        verified: true,
        verifyToken: null,
      },
    });

    // Redirect to success page
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    return NextResponse.redirect(`${siteUrl}?subscribed=true`);
  } catch (error) {
    console.error("Error verifying subscription:", error);
    return NextResponse.json(
      { error: "Failed to verify subscription" },
      { status: 500 }
    );
  }
}
