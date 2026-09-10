import { BLOB_HOST_SUFFIX, BLOB_PDF_PREFIX, MAX_PDF_BYTES } from "./limits";

export { MAX_PDF_BYTES };
export const MAX_TEXT_CHARS = 200_000;

export type AnalyzeInput =
  | { kind: "text"; text: string }
  | { kind: "pdf"; blobUrl: string };

export type ParseResult =
  | { ok: true; input: AnalyzeInput }
  | { ok: false; error: string };

const BAD_BLOB_URL = "That upload link is not valid. Try uploading again.";

/**
 * The analyze route fetches whatever URL it is handed, so this has to be a
 * strict allowlist: HTTPS, a Vercel Blob host, and a path under our own
 * upload prefix. Anything looser turns the route into an SSRF proxy.
 */
function isOurBlobUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (!url.hostname.endsWith(BLOB_HOST_SUFFIX)) return false;
  // Guard against a hostname that is only the suffix, e.g. ".blob.vercel-…".
  if (url.hostname.length <= BLOB_HOST_SUFFIX.length) return false;
  return url.pathname.startsWith(`/${BLOB_PDF_PREFIX}`);
}

export function parseAnalyzeRequest(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const { text, blobUrl } = body as { text?: unknown; blobUrl?: unknown };
  const hasText = typeof text === "string" && text.trim().length > 0;
  const hasPdf = typeof blobUrl === "string" && blobUrl.length > 0;

  if (hasText && hasPdf) {
    return { ok: false, error: "Provide either text or a PDF, not both." };
  }
  if (!hasText && !hasPdf) {
    return { ok: false, error: "Provide paper text or a PDF to analyze." };
  }

  if (hasText) {
    const trimmed = (text as string).trim();
    if (trimmed.length > MAX_TEXT_CHARS) {
      return {
        ok: false,
        error: `Pasted text is too long (max ${MAX_TEXT_CHARS.toLocaleString()} characters).`,
      };
    }
    return { ok: true, input: { kind: "text", text: trimmed } };
  }

  const url = blobUrl as string;
  if (!isOurBlobUrl(url)) {
    return { ok: false, error: BAD_BLOB_URL };
  }

  return { ok: true, input: { kind: "pdf", blobUrl: url } };
}
