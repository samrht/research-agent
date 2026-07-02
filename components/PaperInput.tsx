"use client";

import { useRef, useState } from "react";

export type PaperSubmission = { text: string } | { pdfBase64: string };

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;

const TOC = [
  { n: "01", label: "Paper Summary" },
  { n: "02", label: "Methodology Overview" },
  { n: "03", label: "Key Findings" },
  { n: "04", label: "The Evidence" },
  { n: "05", label: "Research Landscape" },
  { n: "06", label: "Open Questions" },
  { n: "07", label: "Verdict" },
];

type Props = {
  onSubmit: (submission: PaperSubmission) => void;
};

export default function PaperInput({ onSubmit }: Props) {
  const [text, setText] = useState("");
  const [pdf, setPdf] = useState<{ name: string; base64: string } | null>(
    null
  );
  const [lastFilled, setLastFilled] = useState<"text" | "pdf" | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setFileError(null);
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setFileError("Only PDF files are supported.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setFileError("PDF is too large (max 15 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      setPdf({ name: file.name, base64 });
      setLastFilled("pdf");
    };
    reader.onerror = () => setFileError("Could not read the file. Try again.");
    reader.readAsDataURL(file);
  }

  const trimmedText = text.trim();
  const hasText = trimmedText.length > 0;
  const textTooLong = trimmedText.length > MAX_TEXT_CHARS;
  const canSubmit = (hasText && !textTooLong) || pdf !== null;

  function submit() {
    if (lastFilled === "pdf" && pdf) {
      onSubmit({ pdfBase64: pdf.base64 });
    } else if (hasText && !textTooLong) {
      onSubmit({ text: trimmedText });
    } else if (pdf) {
      onSubmit({ pdfBase64: pdf.base64 });
    }
  }

  return (
    <>
      <div className="masthead">
        <div className="masthead-brand">STATE&nbsp;OF&nbsp;THE&nbsp;FIELD</div>
        <div className="masthead-meta">
          Manuscript&nbsp;Intake&nbsp;&middot;&nbsp;A&nbsp;Research&nbsp;Agent
        </div>
      </div>
      <div className="masthead-rule" />

      <div className="intake">
        <div className="intake-kicker">Deposit a paper for review</div>
        <h1 className="display-title">
          Submit a paper. Receive a <em>State of the Field</em> report.
        </h1>
        <p className="intake-lede">
          The agent parses your manuscript, analyzes its citations, then
          searches the live literature for evidence that corroborates &mdash;
          and contests &mdash; its central claims.
        </p>

        <div className="intake-grid">
          <div className="intake-card">
            <div className="intake-card-head">
              <span className="label">MANUSCRIPT&nbsp;TEXT</span>
              <span className="hint">
                plain text &middot; max{" "}
                {MAX_TEXT_CHARS.toLocaleString()}&nbsp;characters
              </span>
            </div>

            <textarea
              className="intake-text"
              value={text}
              placeholder="Paste the full paper text here — abstract, body, references…"
              onChange={(e) => {
                setText(e.target.value);
                setLastFilled("text");
              }}
            />
            {textTooLong && (
              <p className="field-error">
                Text is too long ({trimmedText.length.toLocaleString()} of{" "}
                {MAX_TEXT_CHARS.toLocaleString()} max characters). Trim it or
                submit as a PDF instead.
              </p>
            )}

            <div className="or-divider">
              <span className="rule" />
              <span className="word">OR</span>
              <span className="rule" />
            </div>

            <div
              className={dragging ? "dropzone dragging" : "dropzone"}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
            >
              <div className="deposit">⌹&nbsp;&nbsp;Deposit a PDF</div>
              {pdf ? (
                <div className="sub">
                  <span className="file-name">{pdf.name}</span> ready — drop
                  another to replace it
                </div>
              ) : (
                <div className="sub">
                  drop a file here, or click to browse &middot; max 15&nbsp;MB
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
            </div>

            {fileError && <p className="field-error">{fileError}</p>}

            <div className="intake-card-foot">
              <span className="est">est. 2&ndash;4&nbsp;min</span>
              <button
                className="begin-button"
                disabled={!canSubmit}
                onClick={submit}
              >
                BEGIN&nbsp;ANALYSIS&nbsp;&rarr;
              </button>
            </div>
          </div>

          <div className="contents-preview">
            <div className="contents-title">YOUR&nbsp;REPORT&nbsp;WILL&nbsp;CONTAIN</div>
            {TOC.map((t) => (
              <div className="contents-row" key={t.n}>
                <span className="n">{t.n}</span>
                <span className="label">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
