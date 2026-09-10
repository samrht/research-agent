import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";
import { MAX_PDF_BYTES, BLOB_PDF_PREFIX } from "@/lib/limits";

// Issues a short-lived presigned URL so the browser can upload a paper
// straight to Blob storage. The PDF never passes through a function, which
// is what lets it exceed Vercel's 4.5 MB request body limit.
//
// This is the OIDC flow (VERCEL_OIDC_TOKEN + BLOB_STORE_ID), which is what
// connecting a store to a project provisions. The older handleUpload/
// generateClientToken path needs a BLOB_READ_WRITE_TOKEN, which is not
// issued any more.
export async function POST(request: Request): Promise<Response> {
  let body: HandleUploadPresignedBody;
  try {
    body = (await request.json()) as HandleUploadPresignedBody;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (!process.env.BLOB_STORE_ID) {
    console.error("BLOB_STORE_ID is not set; PDF upload is disabled.");
    return Response.json(
      {
        error:
          "PDF upload is not configured on this deployment. Paste the paper text instead.",
      },
      { status: 500 }
    );
  }

  try {
    const jsonResponse = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        // The presigned URL goes to the browser, so these constraints are
        // the real enforcement point — the client-side checks only exist to
        // give quick feedback.
        if (!pathname.startsWith(BLOB_PDF_PREFIX)) {
          throw new Error("Uploads must go under the papers/ prefix.");
        }
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_PDF_BYTES,
          // An upload that is never analyzed is orphaned, so keep the window
          // to claim one short.
          validUntil: Date.now() + 60 * 60 * 1000,
        });
        return { token };
      },
      // No onUploadCompleted: there is nothing to record (no database, and
      // /api/analyze deletes the blob once it has read it). Omitting it also
      // avoids registering a webhook callback that Blob cannot reach when
      // running on localhost.
    });

    return Response.json(jsonResponse);
  } catch (err) {
    console.error("Blob presigned upload request failed:", err);
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
