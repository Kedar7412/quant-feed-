import { describe, it, expect, afterEach } from "bun:test";
import {
  isRealtimeEnabled,
  realtimeWsUrl,
} from "@/lib/realtime/ws-config";

const ORIGINAL = process.env.NEXT_PUBLIC_WS_URL;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.NEXT_PUBLIC_WS_URL;
  } else {
    process.env.NEXT_PUBLIC_WS_URL = ORIGINAL;
  }
});

describe("ws-config gating", () => {
  it("is disabled when NEXT_PUBLIC_WS_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_WS_URL;
    expect(isRealtimeEnabled()).toBe(false);
    expect(realtimeWsUrl()).toBeNull();
  });

  it("is disabled when NEXT_PUBLIC_WS_URL is empty/whitespace", () => {
    process.env.NEXT_PUBLIC_WS_URL = "   ";
    expect(isRealtimeEnabled()).toBe(false);
    expect(realtimeWsUrl()).toBeNull();
  });

  it("is enabled and normalized (trailing slash trimmed) when set", () => {
    process.env.NEXT_PUBLIC_WS_URL = "wss://example.com/ws/graph/";
    expect(isRealtimeEnabled()).toBe(true);
    expect(realtimeWsUrl()).toBe("wss://example.com/ws/graph");
  });
});
