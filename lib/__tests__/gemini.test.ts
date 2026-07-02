import { describe, it, expect } from "vitest";
import { mapGeminiError } from "../gemini";

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
