import { describe, it, expect } from "vitest";
import { parseAnalyzeRequest, MAX_PDF_BYTES, MAX_TEXT_CHARS } from "../validate";

const validPdfBase64 = Buffer.from("%PDF-1.4 fake minimal pdf body").toString(
  "base64"
);

describe("parseAnalyzeRequest", () => {
  it("accepts pasted text and trims it", () => {
    const result = parseAnalyzeRequest({ text: "  A study of things.  " });
    expect(result).toEqual({
      ok: true,
      input: { kind: "text", text: "A study of things." },
    });
  });

  it("rejects whitespace-only text", () => {
    const result = parseAnalyzeRequest({ text: "   " });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(parseAnalyzeRequest(null).ok).toBe(false);
    expect(parseAnalyzeRequest("hello").ok).toBe(false);
  });

  it("rejects when both text and pdfBase64 are provided", () => {
    const result = parseAnalyzeRequest({
      text: "abc",
      pdfBase64: validPdfBase64,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects when neither field is provided", () => {
    expect(parseAnalyzeRequest({}).ok).toBe(false);
  });

  it("accepts a valid PDF payload", () => {
    const result = parseAnalyzeRequest({ pdfBase64: validPdfBase64 });
    expect(result).toEqual({
      ok: true,
      input: { kind: "pdf", pdfBase64: validPdfBase64 },
    });
  });

  it("rejects invalid base64", () => {
    const result = parseAnalyzeRequest({ pdfBase64: "not base64!!!" });
    expect(result.ok).toBe(false);
  });

  it("rejects data without a %PDF header", () => {
    const notPdf = Buffer.from("hello world this is text").toString("base64");
    const result = parseAnalyzeRequest({ pdfBase64: notPdf });
    expect(result.ok).toBe(false);
  });

  it("rejects PDFs over the size cap", () => {
    const oversized = Buffer.alloc(MAX_PDF_BYTES + 1).toString("base64");
    const result = parseAnalyzeRequest({ pdfBase64: oversized });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("15 MB");
  });

  it("accepts text right at the character cap", () => {
    const result = parseAnalyzeRequest({ text: "a".repeat(MAX_TEXT_CHARS) });
    expect(result.ok).toBe(true);
  });

  it("rejects text over the character cap", () => {
    const result = parseAnalyzeRequest({
      text: "a".repeat(MAX_TEXT_CHARS + 1),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("too long");
  });
});
