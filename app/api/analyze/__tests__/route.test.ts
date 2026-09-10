import { beforeEach, describe, expect, it, vi } from "vitest";
import { splitStreamBody } from "@/lib/stream";

const {
  generateContentStream,
  filesUpload,
  filesGet,
  filesDelete,
  blobGet,
  blobDel,
} = vi.hoisted(() => ({
  generateContentStream: vi.fn(),
  filesUpload: vi.fn(),
  filesGet: vi.fn(),
  filesDelete: vi.fn(),
  blobGet: vi.fn(),
  blobDel: vi.fn(),
}));

vi.mock("@/lib/gemini", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/gemini")>();
  return {
    ...actual,
    getGeminiClient: () => ({
      models: { generateContentStream },
      files: { upload: filesUpload, get: filesGet, delete: filesDelete },
    }),
  };
});

vi.mock("@vercel/blob", () => ({
  get: blobGet,
  del: blobDel,
}));

const BLOB_URL =
  "https://abc123.private.blob.vercel-storage.com/papers/paper-x1.pdf";

function pdfStream(body = "%PDF-1.4 a real paper") {
  return new Response(Buffer.from(body)).body!;
}

/** Mocks a full happy-path blob fetch -> Files API upload -> ACTIVE. */
function mockPdfPipeline() {
  blobGet.mockResolvedValueOnce({ statusCode: 200, stream: pdfStream() });
  filesUpload.mockResolvedValueOnce({ name: "files/abc" });
  filesGet.mockResolvedValueOnce({
    name: "files/abc",
    state: "ACTIVE",
    uri: "https://gen.example/files/abc",
  });
}

async function readBody(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

async function* asyncGen<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

describe("POST /api/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    blobDel.mockResolvedValue(undefined);
    filesDelete.mockResolvedValue(undefined);
  });

  it("rejects an invalid body without calling Gemini", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://test/api/analyze", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
    expect(generateContentStream).not.toHaveBeenCalled();
  });

  it("streams chunks from Gemini through to the response body", async () => {
    generateContentStream.mockResolvedValueOnce(
      asyncGen([{ text: "Hello " }, { text: "world" }])
    );
    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://test/api/analyze", {
        method: "POST",
        body: JSON.stringify({ text: "a paper" }),
      })
    );
    expect(res.status).toBe(200);
    expect(await readBody(res)).toBe("Hello world");
  });

  it("maps a pre-stream Gemini failure to a friendly status and message", async () => {
    generateContentStream.mockRejectedValueOnce(
      Object.assign(new Error("quota exceeded"), { status: 429 })
    );
    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://test/api/analyze", {
        method: "POST",
        body: JSON.stringify({ text: "a paper" }),
      })
    );
    expect(res.status).toBe(429);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("free-tier");
  });

  it("appends a mapped error marker when the stream fails mid-generation", async () => {
    async function* failingGen() {
      yield { text: "partial report" };
      throw Object.assign(new Error("got status: UNAVAILABLE"), {
        status: 503,
      });
    }
    generateContentStream.mockResolvedValueOnce(failingGen());
    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://test/api/analyze", {
        method: "POST",
        body: JSON.stringify({ text: "a paper" }),
      })
    );
    // The stream still returns 200: headers are already committed by the
    // time a mid-generation failure happens, so the error rides in the body.
    expect(res.status).toBe(200);
    const body = await readBody(res);
    const { report, streamError } = splitStreamBody(body);
    expect(report).toBe("partial report");
    expect(streamError?.status).toBe(503);
    expect(streamError?.message).toContain("overloaded");
  });

  describe("PDF via Blob upload", () => {
    it("fetches the blob, uploads it to the Files API, and streams the report", async () => {
      mockPdfPipeline();
      generateContentStream.mockResolvedValueOnce(
        asyncGen([{ text: "Report body" }])
      );
      const { POST } = await import("../route");
      const res = await POST(
        new Request("http://test/api/analyze", {
          method: "POST",
          body: JSON.stringify({ blobUrl: BLOB_URL }),
        })
      );

      expect(res.status).toBe(200);
      expect(await readBody(res)).toBe("Report body");
      expect(blobGet).toHaveBeenCalledWith(BLOB_URL, { access: "private" });

      // The model must be handed a file reference, not inline bytes.
      const contents = generateContentStream.mock.calls[0][0].contents;
      expect(contents[0].parts[1]).toEqual({
        fileData: {
          mimeType: "application/pdf",
          fileUri: "https://gen.example/files/abc",
        },
      });
    });

    it("deletes the blob once the PDF has been handed to Gemini", async () => {
      mockPdfPipeline();
      generateContentStream.mockResolvedValueOnce(asyncGen([{ text: "ok" }]));
      const { POST } = await import("../route");
      await POST(
        new Request("http://test/api/analyze", {
          method: "POST",
          body: JSON.stringify({ blobUrl: BLOB_URL }),
        })
      );
      expect(blobDel).toHaveBeenCalledWith(BLOB_URL);
    });

    it("still deletes the blob when preparing the PDF fails", async () => {
      blobGet.mockResolvedValueOnce({ statusCode: 404 });
      const { POST } = await import("../route");
      const res = await POST(
        new Request("http://test/api/analyze", {
          method: "POST",
          body: JSON.stringify({ blobUrl: BLOB_URL }),
        })
      );
      expect(res.status).toBe(400);
      expect(blobDel).toHaveBeenCalledWith(BLOB_URL);
      expect(generateContentStream).not.toHaveBeenCalled();
    });

    it("rejects a blob whose bytes are not actually a PDF", async () => {
      blobGet.mockResolvedValueOnce({
        statusCode: 200,
        stream: pdfStream("<html>not a pdf</html>"),
      });
      const { POST } = await import("../route");
      const res = await POST(
        new Request("http://test/api/analyze", {
          method: "POST",
          body: JSON.stringify({ blobUrl: BLOB_URL }),
        })
      );
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toMatch(/does not look like a PDF/i);
      expect(filesUpload).not.toHaveBeenCalled();
    });

    it("refuses a blobUrl pointing at a host we do not own", async () => {
      const { POST } = await import("../route");
      const res = await POST(
        new Request("http://test/api/analyze", {
          method: "POST",
          body: JSON.stringify({
            blobUrl: "https://evil.example.com/papers/x.pdf",
          }),
        })
      );
      expect(res.status).toBe(400);
      expect(blobGet).not.toHaveBeenCalled();
    });

    it("deletes the Gemini file after the report finishes streaming", async () => {
      mockPdfPipeline();
      generateContentStream.mockResolvedValueOnce(asyncGen([{ text: "ok" }]));
      const { POST } = await import("../route");
      const res = await POST(
        new Request("http://test/api/analyze", {
          method: "POST",
          body: JSON.stringify({ blobUrl: BLOB_URL }),
        })
      );
      await readBody(res);
      expect(filesDelete).toHaveBeenCalledWith({ name: "files/abc" });
    });
  });

  it("returns the mapped config error when the Gemini client cannot be built", async () => {
    // Regression: this used to escape the handler as a bare 500 with an
    // empty body, which is how a missing key looked in production.
    const gemini = await import("@/lib/gemini");
    const spy = vi
      .spyOn(gemini, "getGeminiClient")
      .mockImplementation(() => {
        throw new Error("GEMINI_API_KEY is not set. Add it to .env.local.");
      });
    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://test/api/analyze", {
        method: "POST",
        body: JSON.stringify({ text: "a paper" }),
      })
    );
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("GEMINI_API_KEY");
    spy.mockRestore();
  });

  it("aborts the Gemini call when the client cancels the response stream", async () => {
    let capturedSignal: AbortSignal | undefined;
    generateContentStream.mockImplementationOnce(async (params: any) => {
      capturedSignal = params.config.abortSignal;
      return asyncGen([{ text: "chunk" }]);
    });
    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://test/api/analyze", {
        method: "POST",
        body: JSON.stringify({ text: "a paper" }),
      })
    );
    expect(capturedSignal?.aborted).toBe(false);
    await res.body!.cancel();
    expect(capturedSignal?.aborted).toBe(true);
  });
});
