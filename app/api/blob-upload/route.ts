import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { MAX_PDF_BYTES, BLOB_PDF_PREFIX } from "@/lib/limits";

// Mints a short-lived, scoped token so the browser can upload a paper
// straight to Blob storage. The PDF never passes through a function, which
// is what lets it exceed Vercel's 4.5 MB request body limit.
export async function POST(request: Request): Promise<Response> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN is not set; PDF upload is disabled.");
    return Response.json(
      {
        error:
          "PDF upload is not configured on this deployment. Paste the paper text instead.",
      },
      { status: 500 }
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // The token goes to the browser, so these constraints are the real
        // enforcement point — the client-side checks are only for feedback.
        if (!pathname.startsWith(BLOB_PDF_PREFIX)) {
          throw new Error("Uploads must go under the papers/ prefix.");
        }
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_PDF_BYTES,
          addRandomSuffix: true,
          // An upload that is never analyzed is orphaned, so keep the window
          // to claim one short.
          validUntil: Date.now() + 60 * 60 * 1000,
        };
      },
      onUploadCompleted: async () => {
        // Nothing to record: /api/analyze deletes the blob once it has read
        // it, and there is no database to update.
      },
    });

    return Response.json(jsonResponse);
  } catch (err) {
    console.error("Blob upload token request failed:", err);
    return Response.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
