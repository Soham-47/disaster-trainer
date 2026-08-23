import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/happy-oyster-session/route";

describe("Happy Oyster session route", () => {
  const request = () => new Request("http://localhost/api/happy-oyster-session", { method: "POST" });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.REACTOR_API_KEY;
    delete process.env.HAPPY_OYSTER_FIRE_WORLD_ID;
  });

  it("mints an Adventure-scoped token and returns the reviewed world id", async () => {
    process.env.REACTOR_API_KEY = "server-key";
    process.env.HAPPY_OYSTER_FIRE_WORLD_ID = "world-123";
    const upstream = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jwt: "short-token" }),
    });
    vi.stubGlobal("fetch", upstream);

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ token: "short-token", worldId: "world-123" });
    const [, options] = upstream.mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({
      authorization_details: [{ resources: { models: { match: ["reactor/happy-oyster-adventure"] } } }],
    });
  });

  it("fails closed when the reviewed world id is missing", async () => {
    process.env.REACTOR_API_KEY = "server-key";
    const response = await POST(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "MISSING_WORLD_ID" });
  });

  it("can mint a development build token before a permanent world exists", async () => {
    process.env.REACTOR_API_KEY = "server-key";
    const upstream = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ jwt: "builder-token" }) });
    vi.stubGlobal("fetch", upstream);
    const request = new Request("http://localhost/api/happy-oyster-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "build" }),
    });

    const response = await POST(request);
    await expect(response.json()).resolves.toEqual({ token: "builder-token", worldId: null });
  });
});
