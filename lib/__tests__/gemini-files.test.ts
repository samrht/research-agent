import { describe, it, expect, vi } from "vitest";
import { waitForActiveFile } from "../gemini-files";

const noSleep = () => Promise.resolve();

describe("waitForActiveFile", () => {
  it("returns immediately when the file is already ACTIVE", async () => {
    const getFile = vi.fn().mockResolvedValue({
      name: "files/abc",
      uri: "https://gen.example/files/abc",
      state: "ACTIVE",
    });
    const file = await waitForActiveFile(getFile, "files/abc", {
      sleep: noSleep,
    });
    expect(file.uri).toBe("https://gen.example/files/abc");
    expect(getFile).toHaveBeenCalledTimes(1);
  });

  it("polls while the file is PROCESSING and resolves once ACTIVE", async () => {
    const getFile = vi
      .fn()
      .mockResolvedValueOnce({ name: "files/abc", state: "PROCESSING" })
      .mockResolvedValueOnce({ name: "files/abc", state: "PROCESSING" })
      .mockResolvedValueOnce({
        name: "files/abc",
        uri: "https://gen.example/files/abc",
        state: "ACTIVE",
      });
    const file = await waitForActiveFile(getFile, "files/abc", {
      sleep: noSleep,
    });
    expect(file.state).toBe("ACTIVE");
    expect(getFile).toHaveBeenCalledTimes(3);
  });

  it("throws when Gemini reports the file FAILED", async () => {
    const getFile = vi.fn().mockResolvedValue({
      name: "files/abc",
      state: "FAILED",
      error: { message: "unreadable pdf" },
    });
    await expect(
      waitForActiveFile(getFile, "files/abc", { sleep: noSleep })
    ).rejects.toThrow(/could not read|unreadable/i);
  });

  it("gives up once the deadline passes instead of polling forever", async () => {
    const getFile = vi.fn().mockResolvedValue({
      name: "files/abc",
      state: "PROCESSING",
    });
    let clock = 0;
    await expect(
      waitForActiveFile(getFile, "files/abc", {
        sleep: async () => {
          clock += 1_000;
        },
        now: () => clock,
        timeoutMs: 5_000,
      })
    ).rejects.toThrow(/took too long|timed out/i);
    // Bounded, not unbounded: it stopped rather than spinning.
    expect(getFile.mock.calls.length).toBeLessThan(10);
  });

  it("throws when an ACTIVE file somehow has no uri to reference", async () => {
    const getFile = vi
      .fn()
      .mockResolvedValue({ name: "files/abc", state: "ACTIVE" });
    await expect(
      waitForActiveFile(getFile, "files/abc", { sleep: noSleep })
    ).rejects.toThrow(/uri/i);
  });
});
