// Marks the end of the visible report in the /api/analyze response body.
// Anything after it is a JSON-encoded { status, message } describing a
// mid-stream failure, letting the client show the same friendly message a
// pre-stream error would get instead of a bare "connection dropped".
export const STREAM_ERROR_MARKER = " STREAM_ERROR ";

export type StreamError = { status: number; message: string };

export function splitStreamBody(body: string): {
  report: string;
  streamError: StreamError | null;
} {
  const markerIndex = body.indexOf(STREAM_ERROR_MARKER);
  if (markerIndex === -1) {
    return { report: body, streamError: null };
  }

  const report = body.slice(0, markerIndex);
  const payload = body.slice(markerIndex + STREAM_ERROR_MARKER.length);
  try {
    const streamError = JSON.parse(payload) as StreamError;
    return { report, streamError };
  } catch {
    return { report, streamError: null };
  }
}
