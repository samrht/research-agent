"use client";

import { useEffect, useRef, useState } from "react";
import PaperInput, { PaperSubmission } from "@/components/PaperInput";
import ReportView from "@/components/ReportView";
import { splitStreamBody } from "@/lib/stream";

type Phase = "input" | "analyzing" | "done";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("input");
  const [report, setReport] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [interrupted, setInterrupted] = useState(false);
  const [interruptedMessage, setInterruptedMessage] = useState<string | null>(
    null
  );
  const abortRef = useRef<AbortController | null>(null);

  // Stop pulling from the server if the component unmounts mid-stream.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function handleSubmit(submission: PaperSubmission) {
    setPhase("analyzing");
    setReport("");
    setError(null);
    setInterrupted(false);
    setInterruptedMessage(null);

    const abortController = new AbortController();
    abortRef.current = abortController;

    let res: Response;
    try {
      res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
        signal: abortController.signal,
      });
    } catch {
      if (abortController.signal.aborted) return;
      setError(
        "Could not reach the server. Check your connection and try again."
      );
      setPhase("input");
      return;
    }

    if (!res.ok || !res.body) {
      let message = `Request failed (status ${res.status}).`;
      try {
        const data = (await res.json()) as { error?: string };
        if (data.error) message = data.error;
      } catch {
        // keep the default message
      }
      setError(message);
      setPhase("input");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let received = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += decoder.decode(value, { stream: true });
        setReport(received);
      }
    } catch {
      if (abortController.signal.aborted) return;
      setInterrupted(true);
    }

    const { report: finalReport, streamError } = splitStreamBody(received);
    setReport(finalReport);
    if (streamError) {
      setInterrupted(true);
      setInterruptedMessage(streamError.message);
    }
    setPhase("done");
  }

  function reset() {
    abortRef.current?.abort();
    setPhase("input");
    setReport("");
    setError(null);
    setInterrupted(false);
    setInterruptedMessage(null);
  }

  return (
    <main className="container">
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(null)}>DISMISS</button>
        </div>
      )}

      {phase === "input" && <PaperInput onSubmit={handleSubmit} />}

      {phase !== "input" && (
        <>
          <ReportView
            markdown={report}
            streaming={phase === "analyzing"}
            interrupted={interrupted}
            interruptedMessage={interruptedMessage}
          />
          {phase === "done" && (
            <button className="reset-button" onClick={reset}>
              ANALYZE&nbsp;ANOTHER&nbsp;PAPER
            </button>
          )}
        </>
      )}
    </main>
  );
}
