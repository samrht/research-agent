import { describe, it, expect } from "vitest";
import { splitStreamBody, STREAM_ERROR_MARKER } from "../stream";

describe("splitStreamBody", () => {
  it("returns the whole body as the report when there is no marker", () => {
    const result = splitStreamBody("a complete report");
    expect(result).toEqual({ report: "a complete report", streamError: null });
  });

  it("splits out a trailing stream error payload", () => {
    const body =
      "partial report" +
      STREAM_ERROR_MARKER +
      JSON.stringify({ status: 503, message: "overloaded" });
    const result = splitStreamBody(body);
    expect(result.report).toBe("partial report");
    expect(result.streamError).toEqual({ status: 503, message: "overloaded" });
  });

  it("treats a marker with unparseable JSON as no stream error", () => {
    const body = "partial report" + STREAM_ERROR_MARKER + "not json";
    const result = splitStreamBody(body);
    expect(result.report).toBe("partial report");
    expect(result.streamError).toBeNull();
  });
});
