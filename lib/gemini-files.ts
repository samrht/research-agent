// A PDF uploaded to Gemini's Files API is not readable straight away — it
// sits in PROCESSING until the service has parsed it. Referencing it before
// then fails, so the analyze route has to wait for ACTIVE first.

export type GeminiFile = {
  name?: string;
  uri?: string;
  state?: string;
  error?: { message?: string };
};

export type GetFile = (name: string) => Promise<GeminiFile>;

type WaitOptions = {
  timeoutMs?: number;
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_MS = 1_000;

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function waitForActiveFile(
  getFile: GetFile,
  name: string,
  options: WaitOptions = {}
): Promise<GeminiFile> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    pollMs = DEFAULT_POLL_MS,
    sleep = defaultSleep,
    now = Date.now,
  } = options;

  const startedAt = now();

  for (;;) {
    const file = await getFile(name);

    if (file.state === "FAILED") {
      throw new Error(
        `Gemini could not read the PDF${
          file.error?.message ? `: ${file.error.message}` : "."
        }`
      );
    }

    if (file.state === "ACTIVE") {
      if (!file.uri) {
        throw new Error("Gemini returned an active file with no uri.");
      }
      return file;
    }

    if (now() - startedAt >= timeoutMs) {
      throw new Error("Gemini took too long to process the PDF.");
    }

    await sleep(pollMs);
  }
}
