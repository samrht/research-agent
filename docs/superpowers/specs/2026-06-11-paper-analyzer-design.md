# Research Paper Analyzer — Design Spec

**Date:** 2026-06-11
**Status:** Approved
**Scope:** v1 — Paper Analyzer pipeline only

## Purpose

A web app that takes an academic paper (pasted text or uploaded PDF) and produces a
"State of the Field" report: paper summary, methodology, key findings, supporting and
contradicting external evidence, research landscape, open questions, and a verdict.
The analysis is driven by a single phased prompt (Phases 1–6) executed by an LLM with
live web search, so supporting/contradicting evidence comes from real external papers,
not just training data.

## Decisions (locked with user)

| Decision | Choice | Rationale |
|---|---|---|
| LLM provider | Google Gemini 2.5 Flash, free tier | Only free API tier that includes web search grounding, which Phases 3–5 require. Key from aistudio.google.com. |
| Scope | Paper analyzer only | Market Intel pipeline is a fast-follow; its prompt is ported and kept in `lib/prompts.ts` but unused in v1. |
| Paper input | Paste text + PDF upload | Gemini accepts PDFs natively as base64 — no parsing library. URL/DOI fetch deferred. |
| Stack | Next.js (App Router, TypeScript), full-stack | One codebase, natural streaming, free Vercel deployment. Replaces the earlier `backend/` (Python) + `frontend/` split. |
| Orchestration | Single streaming model call per analysis | The phased prompt does the sequencing. No multi-agent pipeline in v1 (quality/quota/complexity trade-off). |

## Architecture

```
Browser                          Next.js server                 Google
─────────                        ──────────────                 ──────
PaperInput ──POST /api/analyze──▶ route.ts
  (text | pdfBase64)               ├─ validate input
                                   ├─ assemble prompt (lib/prompts.ts)
                                   └─ Gemini 2.5 Flash ─────────▶ generateContentStream
                                        tools: google_search        + search grounding
ReportView ◀──streamed markdown── ◀─────────────────────────────┘
  (live render)
```

## File structure

```
research-agent/
├─ app/
│  ├─ page.tsx               # state machine: input → analyzing → report | error
│  ├─ layout.tsx
│  └─ api/analyze/route.ts   # POST, streams markdown; maxDuration raised for long generations
├─ components/
│  ├─ PaperInput.tsx         # textarea + PDF drop zone, client-side validation
│  └─ ReportView.tsx         # streaming markdown render (react-markdown), section nav
├─ lib/
│  ├─ prompts.ts             # PAPER_ANALYZER_PROMPT (refined version) + MARKET_INTEL_PROMPT
│  └─ gemini.ts              # @google/genai client; GEMINI_API_KEY from env, server-only
└─ docs/superpowers/specs/   # this spec
```

## API contract

`POST /api/analyze`

Request body (JSON), exactly one of:
- `{ "text": string }` — pasted paper text (non-empty after trim)
- `{ "pdfBase64": string }` — base64-encoded PDF, ≤ 15 MB decoded

Response:
- `200` — `text/plain` chunked stream of the report markdown
- `400` — invalid input (empty, both/neither fields, oversized PDF, not a PDF)
- `429` — Gemini free-tier rate/daily limit, with retry guidance in body
- `500` — upstream or unexpected error, sanitized message

The Gemini call uses `gemini-2.5-flash` with the `google_search` tool enabled.
Exact free-tier grounding quotas to be verified during implementation; quota errors
must map to the 429 path with a friendly message.

## Prompt

`PAPER_ANALYZER_PROMPT` is the user's refined version (the one beginning "Analyze the
following research paper and produce a complete State of the Field report…", Phases 1–6,
8-section report format, ending with the trust verdict). Paper content is appended after
the `--- PAPER BELOW ---` marker (text) or attached as an inline PDF part.

## UI behavior

- **Input state:** textarea and PDF drop zone; whichever is filled last wins; Analyze
  button disabled until valid input exists.
- **Analyzing state:** report area renders markdown incrementally as chunks arrive,
  with a progress indicator; input controls disabled.
- **Done state:** full report with per-section navigation; "Analyze another" resets.
- **Error handling:** empty input and oversized/wrong-type files rejected client-side
  before any request; server errors shown as a dismissible banner; a stream that drops
  mid-generation keeps the partial report visible with a "generation interrupted" notice.

## Configuration

- `GEMINI_API_KEY` in `.env.local` (gitignored). README documents getting a free key
  at aistudio.google.com.
- Free-tier limits (~10 requests/min on 2.5 Flash) are acceptable for single-user use.

## Testing

- Unit tests: prompt assembly (text vs PDF path) and API route input validation
  (empty, both fields, oversized, bad base64).
- Integration: manual run against a real key with a real paper — streaming, grounding,
  and error paths verified in the running app.

## Out of scope for v1

- Market Intel UI/pipeline (prompt ported, no UI)
- URL/DOI fetching
- Multi-agent orchestration, report persistence/history, auth
