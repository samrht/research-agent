"use client";

import { useRef, useState } from "react";

export type PaperSubmission = { text: string } | { pdfBase64: string };

const MAX_PDF_BYTES = 15 * 1024 * 1024;

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

  const hasText = text.trim().length > 0;
  const canSubmit = hasText || pdf !== null;

  function submit() {
    if (lastFilled === "pdf" && pdf) {
      onSubmit({ pdfBase64: pdf.base64 });
    } else if (hasText) {
      onSubmit({ text: text.trim() });
    } else if (pdf) {
      onSubmit({ pdfBase64: pdf.base64 });
    }
  }

  return (
    <div className="paper-input">
      <textarea
        value={text}
        placeholder="Paste the full paper text here…"
        onChange={(e) => {
          setText(e.target.value);
          setLastFilled("text");
        }}
      />

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
        {pdf ? (
          <span>
            <span className="file-name">{pdf.name}</span> ready — drop another
            PDF to replace it
          </span>
        ) : (
          <span>…or drop a PDF here (max 15 MB), or click to browse</span>
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

      <button className="analyze-button" disabled={!canSubmit} onClick={submit}>
        Analyze paper
      </button>
    </div>
  );
}
