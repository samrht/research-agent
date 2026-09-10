import { del, get } from "@vercel/blob";
import { getGeminiClient, mapGeminiError, GEMINI_MODEL } from "@/lib/gemini";
import { waitForActiveFile } from "@/lib/gemini-files";
import { checkPdfBytes } from "@/lib/pdf";
import { buildAnalyzerContents, type AnalyzerSource } from "@/lib/prompts";
import { STREAM_ERROR_MARKER } from "@/lib/stream";
import { parseAnalyzeRequest } from "@/lib/validate";

// Full reports take minutes; raise the function timeout (Vercel fluid compute
// allows up to 300s on the hobby tier).
export const maxDuration = 300;

const PDF_MIME = "application/pdf";

/**
 * Pulls the uploaded paper out of Blob storage and hands it to Gemini's Files
 * API, returning a reference the model can read. Throws a message safe to
 * show the user.
 */
async function uploadPaperToGemini(
  ai: ReturnType<typeof getGeminiClient>,
  blobUrl: string
): Promise<{ source: AnalyzerSource; geminiFileName?: string }> {
  const result = await get(blobUrl, { access: "private" });
  if (!result || result.statusCode !== 200) {
    throw new Error("That upload has expired. Upload the PDF again.");
  }

  const bytes = new Uint8Array(
    await new Response(result.stream).arrayBuffer()
  );

  // The upload token was handed to the browser, so re-verify here.
  const check = checkPdfBytes(bytes);
  if (!check.ok) throw new Error(check.error);

  const uploaded = await ai.files.upload({
    file: new Blob([bytes as BlobPart], { type: PDF_MIME }),
    config: { mimeType: PDF_MIME, displayName: "paper.pdf" },
  });

  if (!uploaded.name) {
    throw new Error("Gemini did not return a file reference for the PDF.");
  }

  const active = await waitForActiveFile(
    async (name) => ai.files.get({ name }),
    uploaded.name
  );

  return {
    source: { kind: "file", fileUri: active.uri!, mimeType: PDF_MIME },
    geminiFileName: uploaded.name,
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const parsed = parseAnalyzeRequest(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  // Lets us stop pulling from Gemini if the client disconnects mid-stream.
  // Note this only stops our own server from consuming the response; per the
  // SDK docs it does not cancel the request on Gemini's side.
  const abortController = new AbortController();

  // Constructing the client validates GEMINI_API_KEY, so a misconfigured
  // deployment has to surface here rather than escaping as a bare 500.
  let ai: ReturnType<typeof getGeminiClient>;
  try {
    ai = getGeminiClient();
  } catch (err) {
    console.error("Gemini client could not be created:", err);
    const { status, message } = mapGeminiError(err);
    return Response.json({ error: message }, { status });
  }

  let source: AnalyzerSource;
  let geminiFileName: string | undefined;

  if (parsed.input.kind === "pdf") {
    const { blobUrl } = parsed.input;
    try {
      const resolved = await uploadPaperToGemini(ai, blobUrl);
      source = resolved.source;
      geminiFileName = resolved.geminiFileName;
    } catch (err) {
      console.error("Preparing the uploaded PDF failed:", err);
      return Response.json(
        { error: (err as Error).message },
        { status: 400 }
      );
    } finally {
      // The paper is in Gemini's hands (or the attempt failed); either way we
      // do not keep the user's manuscript sitting in our store.
      void del(blobUrl).catch((err: unknown) =>
        console.error("Could not delete the uploaded blob:", err)
      );
    }
  } else {
    source = parsed.input;
  }

  // Gemini keeps uploaded files for 48h; drop ours as soon as we are done.
  const cleanUpGeminiFile = () => {
    if (!geminiFileName) return;
    void ai.files
      .delete({ name: geminiFileName })
      .catch((err: unknown) =>
        console.error("Could not delete the Gemini file:", err)
      );
  };

  let geminiStream: AsyncIterable<{ text?: string }>;
  try {
    geminiStream = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents: buildAnalyzerContents(source),
      config: {
        tools: [{ googleSearch: {} }],
        abortSignal: abortController.signal,
      },
    });
  } catch (err) {
    console.error("Gemini request failed:", err);
    cleanUpGeminiFile();
    const { status, message } = mapGeminiError(err);
    return Response.json({ error: message }, { status });
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of geminiStream) {
          if (chunk.text) {
            controller.enqueue(encoder.encode(chunk.text));
          }
        }
        controller.close();
      } catch (err) {
        // The stream has already started (200 + partial body sent), so we
        // can't change the status code here. Instead, append the mapped
        // error as a trailing marker the client can parse out of the body
        // and close normally rather than erroring the stream.
        console.error("Gemini stream failed mid-generation:", err);
        const { status, message } = mapGeminiError(err);
        controller.enqueue(
          encoder.encode(
            STREAM_ERROR_MARKER + JSON.stringify({ status, message })
          )
        );
        controller.close();
      } finally {
        cleanUpGeminiFile();
      }
    },
    cancel() {
      abortController.abort();
      cleanUpGeminiFile();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
