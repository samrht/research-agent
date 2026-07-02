import { describe, expect, it, vi } from "vitest";
import { splitStreamBody } from "@/lib/stream";

const { generateContentStream } = vi.hoisted(() => ({
  generateContentStream: vi.fn(),
}));

vi.mock("@/lib/gemini", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/gemini")>();
  return {
    ...actual,
    getGeminiClient: () => ({
      models: { generateContentStream },
    }),
  };
});

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
