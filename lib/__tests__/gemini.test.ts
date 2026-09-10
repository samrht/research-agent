import { describe, it, expect, afterEach } from "vitest";
import { mapGeminiError, readApiKey } from "../gemini";

describe("readApiKey", () => {
  const original = process.env.GEMINI_API_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = original;
  });

  it("strips a leading UTF-8 BOM", () => {
    // A BOM sneaks in when the key is piped into `vercel env add` from a
    // PowerShell redirect; it makes the SDK throw an opaque ByteString error.
    process.env.GEMINI_API_KEY = "﻿AQ.Ab8RN6key";
    expect(readApiKey()).toBe("AQ.Ab8RN6key");
  });

  it("strips surrounding whitespace and newlines", () => {
    process.env.GEMINI_API_KEY = "  AQ.Ab8RN6key\r\n";
    expect(readApiKey()).toBe("AQ.Ab8RN6key");
  });

  it("returns a clean key untouched", () => {
    process.env.GEMINI_API_KEY = "AQ.Ab8RN6key";
    expect(readApiKey()).toBe("AQ.Ab8RN6key");
  });

  it("throws when the key is unset", () => {
    delete process.env.GEMINI_API_KEY;
    expect(() => readApiKey()).toThrow(/GEMINI_API_KEY/);
  });

  it("throws when the key is only whitespace or a BOM", () => {
    process.env.GEMINI_API_KEY = "﻿  ";
    expect(() => readApiKey()).toThrow(/GEMINI_API_KEY/);
  });

  it("rejects a key with characters that cannot go in an HTTP header", () => {
    process.env.GEMINI_API_KEY = "AQ.Ab8 RN6key";
    expect(() => readApiKey()).toThrow(/invalid characters/i);
  });
});

describe("mapGeminiError", () => {
  it("maps an error object carrying status 429 to a friendly 429", () => {
    const err = Object.assign(new Error("quota exceeded"), { status: 429 });
    const result = mapGeminiError(err);
    expect(result.status).toBe(429);
    expect(result.message).toContain("free-tier");
  });

  it("maps RESOURCE_EXHAUSTED messages to 429", () => {
    const result = mapGeminiError(
      new Error("got status: RESOURCE_EXHAUSTED. quota exceeded for model")
    );
    expect(result.status).toBe(429);
  });

  it("maps an error object carrying status 503 to a friendly 503", () => {
    const err = Object.assign(new Error("got status: UNAVAILABLE"), {
      status: 503,
    });
    const result = mapGeminiError(err);
    expect(result.status).toBe(503);
    expect(result.message).toContain("overloaded");
  });

  it("maps UNAVAILABLE messages to 503", () => {
    const result = mapGeminiError(
      new Error(
        'got status: UNAVAILABLE. {"error":{"code":503,"message":"This model is currently experiencing high demand."}}'
      )
    );
    expect(result.status).toBe(503);
  });

  it("passes GEMINI_API_KEY config errors through verbatim", () => {
    const result = mapGeminiError(
      new Error("GEMINI_API_KEY is not set. Add it to .env.local.")
    );
    expect(result.status).toBe(500);
    expect(result.message).toContain("GEMINI_API_KEY");
  });

  it("maps a rejected API key to an actionable message", () => {
    const result = mapGeminiError(
      new Error('got status: 400 {"error":{"message":"API key not valid"}}')
    );
    expect(result.message).toContain("GEMINI_API_KEY");
  });

  it("maps an oversized-input 400 to a length message, not a key message", () => {
    // Regression: any 400 used to be reported as a bad API key, which sent
    // you looking at env vars when the real problem was the paper's length.
    const err = Object.assign(
      new Error(
        '{"error":{"code":400,"message":"The input token count exceeds the maximum number of tokens allowed 1048576.","status":"INVALID_ARGUMENT"}}'
      ),
      { status: 400 }
    );
    const result = mapGeminiError(err);
    expect(result.message).toMatch(/too long/i);
    expect(result.message).not.toContain("GEMINI_API_KEY");
  });

  it("does not blame the API key for an unrelated 400", () => {
    const err = Object.assign(new Error("some other bad request"), {
      status: 400,
    });
    expect(mapGeminiError(err).message).not.toContain("GEMINI_API_KEY");
  });

  it("maps anything else to a sanitized 500", () => {
    const result = mapGeminiError(new Error("ECONNRESET something internal"));
    expect(result.status).toBe(500);
    expect(result.message).not.toContain("ECONNRESET");
  });

  it("handles non-Error throwables", () => {
    const result = mapGeminiError("string failure");
    expect(result.status).toBe(500);
  });

  it("does not misclassify unrelated messages that merely contain the substring 429", () => {
    const result = mapGeminiError(
      new Error("connect ECONNREFUSED 127.0.0.1:429")
    );
    expect(result.status).toBe(500);
  });

  it("maps a status: 429 message to 429", () => {
    const result = mapGeminiError(new Error("got status: 429. rate limited"));
    expect(result.status).toBe(429);
  });
});
