"use client";

import { useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  markdown: string;
  streaming: boolean;
  interrupted: boolean;
};

export default function ReportView({
  markdown,
  streaming,
  interrupted,
}: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);

  // Heading list mirrors the h2/h3 nodes react-markdown renders from the
  // same source, so index-based scrolling stays in sync.
  const headings = Array.from(markdown.matchAll(/^#{2,3}\s+(.+)$/gm)).map(
    (m) => m[1]
  );

  function scrollToHeading(index: number) {
    const nodes = bodyRef.current?.querySelectorAll("h2, h3");
    nodes?.[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="report">
      {streaming && (
        <div className="status">
          Analyzing — the report streams in below as it is generated. A full
          report can take a few minutes.
        </div>
      )}
      {interrupted && (
        <div className="status status-warning">
          Generation was interrupted — the report below is partial.
        </div>
      )}

      {headings.length > 1 && (
        <nav className="section-nav" aria-label="Report sections">
          {headings.map((heading, i) => (
            <button key={`${heading}-${i}`} onClick={() => scrollToHeading(i)}>
              {heading}
            </button>
          ))}
        </nav>
      )}

      <div className="report-body" ref={bodyRef}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>

      {streaming && markdown.length === 0 && (
        <div className="placeholder">Waiting for the first results…</div>
      )}
    </section>
  );
}
