import { NextResponse } from "next/server";

export async function POST() {
  const apiKey = process.env.REACTOR_API_KEY ? process.env.REACTOR_API_KEY.trim() : null;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "MISSING_KEY",
        message: "REACTOR_API_KEY environment variable is not configured.",
        mode: "fallback",
      },
      { status: 500 }
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch("https://api.reactor.inc/tokens", {
      method: "POST",
      headers: {
        "Reactor-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        authorization_details: [
          {
            type: "session",
            resources: { models: { match: ["reactor/lingbot-world-2"] } },
            constraints: { max_sessions: 10 },
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const token = data.jwt || data.token;
      if (!token) {
        return NextResponse.json(
          { error: "INVALID_TOKEN_RESPONSE", message: "Reactor returned no session token.", mode: "fallback" },
          { status: 502 }
        );
      }
      return NextResponse.json({
        token,
        expiresAt: data.expires_at ? data.expires_at * 1000 : Date.now() + 3600000,
        model: "lingbot-world-2",
        mode: "live",
      });
    }

    const errorText = await response.text();
    console.warn(`[Reactor Token API] Upstream HTTP ${response.status}:`, errorText);
    return NextResponse.json(
      {
        error: "TOKEN_EXCHANGE_FAILED",
        message: `Reactor API returned HTTP ${response.status}: ${errorText}`,
        mode: "fallback",
      },
      { status: 502 }
    );
  } catch (netErr: any) {
    console.warn(
      `[Reactor Token API] Upstream network error (${netErr.code || netErr.name || netErr.message}).`
    );
    return NextResponse.json(
      {
        error: "NETWORK_ERROR",
        message: "Network timeout or connection error contacting Reactor API",
        mode: "fallback",
      },
      { status: 502 }
    );
  }
}

export async function GET() {
  const apiKey = process.env.REACTOR_API_KEY ? process.env.REACTOR_API_KEY.trim() : null;
  return NextResponse.json({
    status: "ok",
    hasKey: Boolean(apiKey),
  });
}

