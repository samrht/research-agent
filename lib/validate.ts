export const MAX_PDF_BYTES = 15 * 1024 * 1024;

export type AnalyzeInput =
  | { kind: "text"; text: string }
  | { kind: "pdf"; pdfBase64: string };

export type ParseResult =
  | { ok: true; input: AnalyzeInput }
  | { ok: false; error: string };

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export function parseAnalyzeRequest(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const { text, pdfBase64 } = body as { text?: unknown; pdfBase64?: unknown };
  const hasText = typeof text === "string" && text.trim().length > 0;
  const hasPdf = typeof pdfBase64 === "string" && pdfBase64.length > 0;

  if (hasText && hasPdf) {
    return { ok: false, error: "Provide either text or a PDF, not both." };
  }
  if (!hasText && !hasPdf) {
    return { ok: false, error: "Provide paper text or a PDF to analyze." };
  }

  if (hasText) {
    return { ok: true, input: { kind: "text", text: (text as string).trim() } };
  }

  const b64 = pdfBase64 as string;
  if (!BASE64_RE.test(b64)) {
    return { ok: false, error: "PDF data is not valid base64." };
  }

  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((b64.length * 3) / 4) - padding;
  if (decodedBytes > MAX_PDF_BYTES) {
    return { ok: false, error: "PDF is too large (max 15 MB)." };
  }

  const headerPrefix = Buffer.from(b64.slice(0, 8), "base64").toString(
    "latin1"
  );
  if (!headerPrefix.startsWith("%PDF")) {
    return { ok: false, error: "File does not look like a PDF." };
  }

  return { ok: true, input: { kind: "pdf", pdfBase64: b64 } };
}
