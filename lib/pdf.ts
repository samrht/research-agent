import { MAX_PDF_BYTES, MAX_PDF_LABEL } from "./limits";

export type PdfCheck = { ok: true } | { ok: false; error: string };

const PDF_MAGIC = "%PDF";

/**
 * Re-checks a PDF server-side after pulling it out of Blob storage. The
 * browser already enforces type and size, but the upload token is handed to
 * the client, so nothing there can be trusted.
 */
export function checkPdfBytes(bytes: Uint8Array): PdfCheck {
  if (bytes.byteLength > MAX_PDF_BYTES) {
    return { ok: false, error: `PDF is too large (max ${MAX_PDF_LABEL}).` };
  }

  const header = Buffer.from(
    bytes.subarray(0, PDF_MAGIC.length)
  ).toString("latin1");
  if (header !== PDF_MAGIC) {
    return { ok: false, error: "That file does not look like a PDF." };
  }

  return { ok: true };
}
