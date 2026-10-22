import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyToBackend } from "../src/lib/server/proxy";

describe("proxyToBackend", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("answers 503 without calling Flask when DISABLE_BACKEND_FALLBACK is set", async () => {
    vi.stubEnv("DISABLE_BACKEND_FALLBACK", "1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await proxyToBackend(new Request("https://example.com/api/guidebooks"));
    expect(response.status).toBe(503);
    expect((await response.json()).fallback).toBe("disabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks proxied responses so they can be told apart from Next.js ones", async () => {
    vi.stubEnv("DISABLE_BACKEND_FALLBACK", ""); // Preview builds run this suite with the switch on
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok")));
    const response = await proxyToBackend(new Request("https://example.com/api/guidebooks"));
    expect(response.headers.get("x-guidewise-served-by")).toBe("flask");
  });
});
