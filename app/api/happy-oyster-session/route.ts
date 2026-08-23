import { NextResponse } from "next/server";

const MODEL = "reactor/happy-oyster-adventure";

export async function POST(request: Request) {
  const apiKey = process.env.REACTOR_API_KEY?.trim();
  const worldId = process.env.HAPPY_OYSTER_FIRE_WORLD_ID?.trim();
  let buildIntent = false;
  try {
    buildIntent = (await request.json()).intent === "build";
  } catch {
    buildIntent = false;
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "MISSING_KEY", message: "REACTOR_API_KEY is not configured." },
      { status: 500 }
    );
  }
  if (buildIntent && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "NOT_FOUND", message: "World building is disabled." }, { status: 404 });
  }
  if (!worldId && !buildIntent) {
    return NextResponse.json(
      { error: "MISSING_WORLD_ID", message: "HAPPY_OYSTER_FIRE_WORLD_ID is not configured." },
      { status: 503 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("https://api.reactor.inc/tokens", {
      method: "POST",
      headers: { "Reactor-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        authorization_details: [
          {
            type: "session",
            resources: { models: { match: [MODEL] } },
            constraints: { max_sessions: 2 },
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "TOKEN_EXCHANGE_FAILED", message: `Reactor returned HTTP ${response.status}.` },
        { status: 502 }
      );
    }
    const data = await response.json();
    const token = data.jwt ?? data.token;
    if (!token) {
      return NextResponse.json(
        { error: "INVALID_TOKEN_RESPONSE", message: "Reactor returned no session token." },
        { status: 502 }
      );
    }
    return NextResponse.json({ token, worldId: worldId ?? null });
  } catch {
    return NextResponse.json(
      { error: "NETWORK_ERROR", message: "Could not contact Reactor before the timeout." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
