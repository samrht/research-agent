// PDFs go from the browser straight to Vercel Blob, so the 4.5 MB function
// request body limit no longer applies and this cap is ours to pick. Gemini's
// Files API accepts far larger files; 25 MB keeps a paper comfortably inside
// the Blob free tier while covering figure-heavy manuscripts.
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export const MAX_PDF_LABEL = "25 MB";

// Uploads land under this prefix so the analyze route can tell a paper it is
// meant to read apart from anything else that ends up in the store.
export const BLOB_PDF_PREFIX = "papers/";

// Only blobs served by Vercel Blob are fetchable by the analyze route, so a
// caller cannot point it at an arbitrary URL.
export const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";
