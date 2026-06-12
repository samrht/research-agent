"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  markdown: string;
  streaming: boolean;
  interrupted: boolean;
};

// The six phases the analyzer prompt actually executes, in order.
const PHASES = [
  "Parse the paper",
  "Citation analysis",
  "Corroborating evidence",
  "Contesting evidence",
  "Research landscape",
  "Open questions",
];

const REPORT_DATE = "12 JUN 2026";

export default function ReportView({
  markdown,
  streaming,
  interrupted,
}: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);

  // Heading list mirrors the h2/h3 nodes react-markdown renders from the
  // same source, so index-based scrolling stays in sync.
  const headings = Array.from(markdown.matchAll(/^#{2,3}\s+(.+)$/gm)).map(
    (m) => m[1].replace(/^\d+\.\s*/, "")
  );

  function scrollToHeading(index: number) {
    const nodes = bodyRef.current?.querySelectorAll("h2, h3");
    nodes?.[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (streaming) {
    return (
      <AnalyzingView markdown={markdown} />
    );
  }

  return (
    <section className="report">
      <div className="masthead">
        <div className="masthead-brand">STATE&nbsp;OF&nbsp;THE&nbsp;FIELD</div>
        <div className="masthead-meta">
          Report&nbsp;&middot;&nbsp;{REPORT_DATE}
        </div>
      </div>
      <div className="masthead-rule" style={{ marginBottom: 34 }} />

      {interrupted && (
        <div className="status status-warning">
          GENERATION&nbsp;INTERRUPTED&nbsp;&middot;&nbsp;THE&nbsp;REPORT&nbsp;BELOW&nbsp;IS&nbsp;PARTIAL
        </div>
      )}

      <div className="report-grid">
        {headings.length > 1 ? (
          <nav className="toc" aria-label="Report sections">
            <div className="toc-title">CONTENTS</div>
            {headings.map((heading, i) => (
              <button
                key={`${heading}-${i}`}
                className="toc-row"
                onClick={() => scrollToHeading(i)}
              >
                <span className="n">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="label">{heading}</span>
              </button>
            ))}
          </nav>
        ) : (
          <div />
        )}

        <article className="report-article">
          <div className="report-body" ref={bodyRef}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </div>
          <div className="end-rule">
            &mdash;&nbsp;END&nbsp;OF&nbsp;REPORT&nbsp;&mdash;
          </div>
        </article>
      </div>
    </section>
  );
}

function AnalyzingView({ markdown }: { markdown: string }) {
  const [phaseIdx, setPhaseIdx] = useState(0);

  useEffect(() => {
    setPhaseIdx(0);
    const id = setInterval(() => {
      setPhaseIdx((i) => Math.min(i + 1, PHASES.length - 1));
    }, 2400);
    return () => clearInterval(id);
  }, []);

  const fillPct = ((phaseIdx + 0.5) / PHASES.length) * 100;

  return (
    <section className="analyzing">
      <div className="masthead">
        <div className="masthead-brand">STATE&nbsp;OF&nbsp;THE&nbsp;FIELD</div>
        <div className="masthead-meta is-live">
          <span className="live-dot" />IN&nbsp;REVIEW
        </div>
      </div>
      <div className="masthead-rule" style={{ marginBottom: 40 }} />

      <div className="analyzing-kicker">ANALYZING&nbsp;MANUSCRIPT</div>
      <h1 className="analyzing-title">
        Parsing the manuscript and weighing it against the live literature.
      </h1>

      <div className="analyzing-grid">
        <div>
          <div className="panel-label">PIPELINE</div>
          <div className="pipeline-bar">
            <div className="fill" style={{ width: `${fillPct}%` }} />
          </div>
          {PHASES.map((name, i) => {
            const state =
              i < phaseIdx ? "done" : i === phaseIdx ? "active" : "queued";
            const glyph =
              state === "done" ? "✓" : state === "active" ? "◉" : "○";
            const status =
              state === "done"
                ? "complete"
                : state === "active"
                ? "searching…"
                : "queued";
            return (
              <div className="phase-row" data-state={state} key={name}>
                <span className="glyph">{glyph}</span>
                <div style={{ flex: 1 }}>
                  <div className="name">{name}</div>
                  <div className="status">{status}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <div className="panel-label">LITERATURE&nbsp;SEARCH&nbsp;&middot;&nbsp;LIVE</div>
          <div className="searchlog">
            <div>&rsaquo; parsing manuscript &amp; extracting claims</div>
            <div>&rsaquo; searching the literature for corroboration</div>
            <div>
              &rsaquo; ranking sources by relevance
              <span className="caret-block" />
            </div>
          </div>

          <div className="panel-label">DRAFTING&nbsp;&middot;&nbsp;REPORT</div>
          <div className="draft-body">
            {markdown.length === 0 ? (
              <span className="placeholder">
                Waiting for the first results…
              </span>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {markdown}
              </ReactMarkdown>
            )}
            <span className="draft-caret" />
          </div>
        </div>
      </div>
    </section>
  );
}
