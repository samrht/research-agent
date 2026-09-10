import { describe, it, expect } from "vitest";
import { parseAnalyzeRequest, MAX_TEXT_CHARS } from "../validate";

const validBlobUrl =
  "https://42ji8ihaqx56cqj9.private.blob.vercel-storage.com/papers/paper-abc123.pdf";

describe("parseAnalyzeRequest", () => {
  it("accepts pasted text and trims it", () => {
    const result = parseAnalyzeRequest({ text: "  A study of things.  " });
    expect(result).toEqual({
      ok: true,
      input: { kind: "text", text: "A study of things." },
    });
  });

  it("rejects whitespace-only text", () => {
    expect(parseAnalyzeRequest({ text: "   " }).ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(parseAnalyzeRequest(null).ok).toBe(false);
    expect(parseAnalyzeRequest("hello").ok).toBe(false);
  });

  it("rejects when both text and blobUrl are provided", () => {
    const result = parseAnalyzeRequest({
      text: "abc",
      blobUrl: validBlobUrl,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects when neither field is provided", () => {
    expect(parseAnalyzeRequest({}).ok).toBe(false);
  });

  it("accepts a blob URL from our store under the papers prefix", () => {
    const result = parseAnalyzeRequest({ blobUrl: validBlobUrl });
    expect(result).toEqual({
      ok: true,
      input: { kind: "pdf", blobUrl: validBlobUrl },
    });
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

  describe("blob URL allowlist", () => {
    // The route fetches this URL server-side, so anything that is not our own
    // blob store must be refused or the endpoint becomes an SSRF proxy.
    const rejected: [string, string][] = [
      ["a host we do not own", "https://evil.example.com/papers/x.pdf"],
      [
        "a lookalike host suffix",
        "https://evil.com/papers/x.pdf#.blob.vercel-storage.com",
      ],
      [
        "a subdomain-suffix trick",
        "https://notblob.vercel-storage.com.evil.com/papers/x.pdf",
      ],
      ["plain http", "http://abc.blob.vercel-storage.com/papers/x.pdf"],
      [
        "a path outside the papers prefix",
        "https://abc.blob.vercel-storage.com/secrets/key.txt",
      ],
      ["localhost", "http://localhost:3000/papers/x.pdf"],
      ["the cloud metadata endpoint", "http://169.254.169.254/latest/meta-data"],
      ["a file URL", "file:///etc/passwd"],
      ["not a URL at all", "papers/x.pdf"],
    ];

    for (const [label, url] of rejected) {
      it(`rejects ${label}`, () => {
        const result = parseAnalyzeRequest({ blobUrl: url });
        expect(result.ok).toBe(false);
      });
    }
  });
});
