import { describe, it, expect } from "vitest";
import { checkPdfBytes } from "../pdf";
import { MAX_PDF_BYTES } from "../limits";

function pdfBytes(body = "%PDF-1.4 minimal"): Uint8Array {
  return new Uint8Array(Buffer.from(body));
}

describe("checkPdfBytes", () => {
  it("accepts bytes starting with the %PDF magic number", () => {
    expect(checkPdfBytes(pdfBytes())).toEqual({ ok: true });
  });

  it("rejects bytes without the %PDF magic number", () => {
    const result = checkPdfBytes(pdfBytes("<html>nope</html>"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not a pdf|look like a pdf/i);
  });

  it("rejects a file over the size cap", () => {
    const oversized = new Uint8Array(MAX_PDF_BYTES + 1);
    oversized.set(Buffer.from("%PDF-1.4"));
    const result = checkPdfBytes(oversized);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("25 MB");
  });

  it("accepts a file exactly at the size cap", () => {
    const atCap = new Uint8Array(MAX_PDF_BYTES);
    atCap.set(Buffer.from("%PDF-1.4"));
    expect(checkPdfBytes(atCap).ok).toBe(true);
  });

  it("rejects an empty file rather than reading past the end", () => {
    expect(checkPdfBytes(new Uint8Array(0)).ok).toBe(false);
  });
});
