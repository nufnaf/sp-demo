import { NextResponse } from "next/server";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";
import {
  getPublicDoubaoVoiceSettings,
  readStoredDoubaoVoiceSettings,
  removeDoubaoVoiceSettings,
  saveDoubaoVoiceSettings,
} from "@/lib/voice/settings";

export const dynamic = "force-dynamic";

function forbidden() {
  return NextResponse.json({ error: "Request is not allowed" }, { status: 403 });
}

export async function GET(request: Request) {
  if (!isApiRequestAllowed(request)) return forbidden();
  try {
    return NextResponse.json(await getPublicDoubaoVoiceSettings(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isApiRequestAllowed(request)) return forbidden();
  if (!hasJsonContentType(request)) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const existing = await readStoredDoubaoVoiceSettings();
    const appId = typeof body.appId === "string" ? body.appId.trim() : "";
    const submittedAccessKey = typeof body.accessKey === "string" ? body.accessKey.trim() : "";
    const accessKey = submittedAccessKey || existing?.accessKey || "";
    const asrResourceId = typeof body.asrResourceId === "string" ? body.asrResourceId.trim() : "";
    const ttsResourceId = typeof body.ttsResourceId === "string" ? body.ttsResourceId.trim() : "";
    const ttsSpeaker = typeof body.ttsSpeaker === "string" ? body.ttsSpeaker.trim() : "";
    const ttsSampleRate = typeof body.ttsSampleRate === "number" ? body.ttsSampleRate : Number.NaN;

    if (!appId || appId.length > 256) {
      return NextResponse.json({ error: "A valid App ID is required" }, { status: 400 });
    }
    if (!accessKey || accessKey.length > 4_096) {
      return NextResponse.json({ error: "An Access Key is required" }, { status: 400 });
    }
    if ([asrResourceId, ttsResourceId, ttsSpeaker].some((value) => !value || value.length > 256)) {
      return NextResponse.json({ error: "ASR, TTS, and speaker IDs are required" }, { status: 400 });
    }
    if (!Number.isInteger(ttsSampleRate) || ttsSampleRate < 8_000 || ttsSampleRate > 48_000) {
      return NextResponse.json({ error: "TTS sample rate must be an integer between 8000 and 48000" }, { status: 400 });
    }

    await saveDoubaoVoiceSettings({ appId, accessKey, asrResourceId, ttsResourceId, ttsSpeaker, ttsSampleRate });
    return NextResponse.json(await getPublicDoubaoVoiceSettings(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isApiRequestAllowed(request)) return forbidden();
  try {
    await removeDoubaoVoiceSettings();
    return NextResponse.json(await getPublicDoubaoVoiceSettings(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
