import { NextResponse } from "next/server";
import {
  createDoubaoVoiceSession,
  DoubaoVoiceConfigurationError,
} from "@/lib/voice/doubao-session";
import { isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isApiRequestAllowed(request)) {
    return NextResponse.json({ error: "Request is not allowed" }, { status: 403 });
  }
  try {
    return NextResponse.json(await createDoubaoVoiceSession(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const isConfigurationError = error instanceof DoubaoVoiceConfigurationError;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      {
        status: isConfigurationError ? 503 : 502,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
