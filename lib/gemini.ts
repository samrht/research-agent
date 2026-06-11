import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = "gemini-2.5-flash";

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (see .env.example)."
    );
  }
  return new GoogleGenAI({ apiKey });
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
    text.includes("429")
  ) {
    return {
      status: 429,
      message:
        "Gemini free-tier limit reached (roughly 10 requests/minute and a daily cap). Wait a minute and try again.",
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
