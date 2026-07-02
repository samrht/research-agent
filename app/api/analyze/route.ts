import { getGeminiClient, mapGeminiError, GEMINI_MODEL } from "@/lib/gemini";
import { buildAnalyzerContents } from "@/lib/prompts";
import { STREAM_ERROR_MARKER } from "@/lib/stream";
import { parseAnalyzeRequest } from "@/lib/validate";

// Full reports take minutes; raise the function timeout (Vercel fluid compute
// allows up to 300s on the hobby tier).
export const maxDuration = 300;

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

  let geminiStream: AsyncIterable<{ text?: string }>;
  try {
    const ai = getGeminiClient();
    geminiStream = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents: buildAnalyzerContents(parsed.input),
      config: {
        tools: [{ googleSearch: {} }],
        abortSignal: abortController.signal,
      },
    });
  } catch (err) {
    console.error("Gemini request failed:", err);
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
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
