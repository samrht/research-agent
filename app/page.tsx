"use client";

import { useState } from "react";
import PaperInput, { PaperSubmission } from "@/components/PaperInput";
import ReportView from "@/components/ReportView";

type Phase = "input" | "analyzing" | "done";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("input");
  const [report, setReport] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [interrupted, setInterrupted] = useState(false);

  async function handleSubmit(submission: PaperSubmission) {
    setPhase("analyzing");
    setReport("");
    setError(null);
    setInterrupted(false);

    let res: Response;
    try {
      res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      });
    } catch {
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
      setInterrupted(true);
    }
    setPhase("done");
  }

  function reset() {
    setPhase("input");
    setReport("");
    setError(null);
    setInterrupted(false);
  }

  return (
    <main className="container">
      <header className="header">
        <h1>Research Agent</h1>
        <p>
          Paste a paper or upload a PDF to get a State of the Field report —
          findings checked against live literature search.
        </p>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {phase === "input" && <PaperInput onSubmit={handleSubmit} />}

      {phase !== "input" && (
        <>
          <ReportView
            markdown={report}
            streaming={phase === "analyzing"}
            interrupted={interrupted}
          />
          {phase === "done" && (
            <button className="reset-button" onClick={reset}>
              Analyze another paper
            </button>
          )}
        </>
      )}
    </main>
  );
}
