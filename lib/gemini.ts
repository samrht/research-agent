import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = "gemini-2.5-flash";

// Visible ASCII only — anything else blows up when the SDK appends the key as
// an HTTP header, with an error that names ByteString rather than the key.
const HEADER_SAFE_RE = /^[\x21-\x7e]+$/;

/**
 * Reads GEMINI_API_KEY, stripping the BOM and stray whitespace that env-var
 * tooling (notably `vercel env add` fed from a PowerShell redirect) prepends.
 */
export function readApiKey(): string {
  const apiKey = (process.env.GEMINI_API_KEY ?? "")
    .replace(/﻿/g, "")
    .trim();

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (see .env.example)."
    );
  }
  if (!HEADER_SAFE_RE.test(apiKey)) {
    throw new Error(
      "GEMINI_API_KEY contains invalid characters. Re-add the key with no quotes, spaces, or line breaks."
    );
  }
  return apiKey;
}

export function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: readApiKey() });
}

export function mapGeminiError(err: unknown): {
  status: number;
  message: string;
} {
  const text = err instanceof Error ? err.message : String(err);
  const status =
    typeof (err as { status?: unknown })?.status === "number"
      ? (err as { status: number }).status
      : undefined;

  if (
    status === 429 ||
    text.includes("RESOURCE_EXHAUSTED") ||
    /\bstatus:\s*429\b/i.test(text)
  ) {
    return {
      status: 429,
      message:
        "Gemini free-tier limit reached (roughly 10 requests/minute and a daily cap). Wait a minute and try again.",
    };
  }

  // Config errors from readApiKey() name the env var and carry no secret, so
  // pass them through verbatim rather than hiding them behind "unexpected".
  if (text.startsWith("GEMINI_API_KEY")) {
    return { status: 500, message: text };
  }

  // Only claim a key problem when the upstream message actually says so.
  // Matching on status 400 alone mislabels every other bad request.
  if (text.includes("API_KEY_INVALID") || text.includes("API key not valid")) {
    return {
      status: 500,
      message:
        "Gemini rejected the API key. Check GEMINI_API_KEY in your Vercel project settings.",
    };
  }

  if (text.includes("input token count exceeds")) {
    return {
      status: 413,
      message:
        "This paper is too long for the model to read in one pass. Try a shorter paper, or paste just the sections you want analyzed.",
    };
  }

  if (status === 503 || text.includes("UNAVAILABLE")) {
    return {
      status: 503,
      message:
        "Gemini is overloaded right now (free-tier capacity). Wait a few minutes and try again.",
    };
  }

  return {
    status: 500,
    message: "The analysis service hit an unexpected error. Please try again.",
  };
}
