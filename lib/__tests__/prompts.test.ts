import { describe, it, expect } from "vitest";
import { PAPER_ANALYZER_PROMPT, buildAnalyzerContents } from "../prompts";

describe("PAPER_ANALYZER_PROMPT", () => {
  it("ends with the paper marker so content can be appended", () => {
    expect(
      PAPER_ANALYZER_PROMPT.trimEnd().endsWith("--- PAPER BELOW ---")
    ).toBe(true);
  });
});

describe("buildAnalyzerContents", () => {
  it("appends pasted text after the prompt in a single part", () => {
    const contents = buildAnalyzerContents({
      kind: "text",
      text: "The mitochondria is the powerhouse of the cell.",
    });
    expect(contents).toHaveLength(1);
    expect(contents[0].role).toBe("user");
    expect(contents[0].parts).toHaveLength(1);
    const part = contents[0].parts[0] as { text: string };
    expect(part.text.startsWith("Analyze the following research paper")).toBe(
      true
    );
    expect(part.text).toContain(
      "--- PAPER BELOW ---\n\nThe mitochondria is the powerhouse of the cell."
    );
  });

  it("references an uploaded PDF as a fileData part after the prompt", () => {
    const contents = buildAnalyzerContents({
      kind: "file",
      fileUri: "https://generativelanguage.googleapis.com/v1beta/files/abc",
      mimeType: "application/pdf",
    });
    expect(contents).toHaveLength(1);
    expect(contents[0].parts).toHaveLength(2);
    expect(contents[0].parts[0]).toEqual({ text: PAPER_ANALYZER_PROMPT });
    expect(contents[0].parts[1]).toEqual({
      fileData: {
        mimeType: "application/pdf",
        fileUri: "https://generativelanguage.googleapis.com/v1beta/files/abc",
      },
    });
  });
});
