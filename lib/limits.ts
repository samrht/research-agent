// Vercel rejects any function request body over 4.5 MB at the edge, before our
// handler runs — the client gets a plain-text FUNCTION_PAYLOAD_TOO_LARGE page
// rather than a JSON error. Base64 inflates a PDF by 4/3, so the largest PDF
// that fits is ~3.37 MB. Cap at 3 MB to leave headroom for JSON overhead.
export const MAX_PDF_BYTES = 3 * 1024 * 1024;

export const MAX_PDF_LABEL = "3 MB";
