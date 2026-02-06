import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Brand, Topic, Frequency, Language } from "@prisma/client";

const VALID_BRANDS = Object.values(Brand);
const VALID_TOPICS = Object.values(Topic);
const VALID_FREQUENCIES = Object.values(Frequency);
const VALID_LANGUAGES = Object.values(Language);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { brands, topics, digestFrequency, language, alertsEnabled, alertThreshold } = body;

  // Validate brands
  if (brands !== undefined) {
    if (!Array.isArray(brands) || !brands.every((b: string) => VALID_BRANDS.includes(b as Brand))) {
      return NextResponse.json({ error: "Invalid brands" }, { status: 400 });
    }
  }

  // Validate topics
  if (topics !== undefined) {
    if (!Array.isArray(topics) || !topics.every((t: string) => VALID_TOPICS.includes(t as Topic))) {
      return NextResponse.json({ error: "Invalid topics" }, { status: 400 });
    }
  }

  // Validate digestFrequency
  if (digestFrequency !== undefined && !VALID_FREQUENCIES.includes(digestFrequency)) {
    return NextResponse.json({ error: "Invalid digest frequency" }, { status: 400 });
  }

  // Validate language
  if (language !== undefined && !VALID_LANGUAGES.includes(language)) {
    return NextResponse.json({ error: "Invalid language" }, { status: 400 });
  }

  // Validate alertsEnabled
  if (alertsEnabled !== undefined && typeof alertsEnabled !== "boolean") {
    return NextResponse.json({ error: "Invalid alertsEnabled" }, { status: 400 });
  }

  // Validate alertThreshold
  if (alertThreshold !== undefined) {
    if (typeof alertThreshold !== "number" || alertThreshold < 0 || alertThreshold > 100) {
      return NextResponse.json({ error: "Invalid alertThreshold" }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};
  if (brands !== undefined) data.brands = brands;
  if (topics !== undefined) data.topics = topics;
  if (digestFrequency !== undefined) data.digestFrequency = digestFrequency;
  if (language !== undefined) data.language = language;
  if (alertsEnabled !== undefined) data.alertsEnabled = alertsEnabled;
  if (alertThreshold !== undefined) data.alertThreshold = alertThreshold;

  const preference = await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {
      ...data,
      updatedAt: new Date(),
    },
    create: {
      id: crypto.randomUUID(),
      userId: user.id,
      ...data,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, preference });
}
