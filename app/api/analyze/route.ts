import { getGeminiClient, mapGeminiError, GEMINI_MODEL } from "@/lib/gemini";
import { buildAnalyzerContents } from "@/lib/prompts";
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

  let geminiStream: AsyncIterable<{ text?: string }>;
  try {
    const ai = getGeminiClient();
    geminiStream = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents: buildAnalyzerContents(parsed.input),
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
  } catch (err) {
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
        // Surfaces to the client as a dropped stream; the UI shows the
        // partial report with an "interrupted" notice.
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
