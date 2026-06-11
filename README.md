# Research Agent — Paper Analyzer

Paste an academic paper (or upload its PDF) and get a streamed **State of the
Field** report: summary, methodology, key findings, supporting and
contradicting external evidence (via live Google Search grounding), research
landscape, open questions, and a trust verdict.

## Stack

Next.js (App Router, TypeScript) · Gemini 2.5 Flash (free tier) with Google
Search grounding · react-markdown · Vitest.

## Setup

1. Get a free API key at https://aistudio.google.com/apikey
2. Copy the env template and add your key:

   ```
   cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
   ```

   then set `GEMINI_API_KEY=<your key>` in `.env.local`.
3. Install and run:

   ```
   npm install
   npm run dev
   ```

4. Open http://localhost:3000, paste paper text or drop a PDF (max 15 MB),
   and click **Analyze paper**.

## Notes & limits

- **Free tier:** Gemini's free tier allows roughly 10 requests/minute with a
  daily cap, and search grounding has its own free daily quota. Hitting a
  limit returns a clear "try again in a minute" error.
- **Long reports:** a full report takes a few minutes and streams in as it
  generates. The API route sets `maxDuration = 300`.
- **Vercel deploys:** request bodies are capped at ~4.5 MB on Vercel, so
  large PDF uploads only work when running locally — paste the text instead.
- The Market Intel prompt (`lib/prompts.ts`) is ported but has no UI yet —
  it's the planned fast-follow.

## Tests

```
npm test
```

Unit tests cover request validation, prompt/content assembly, and Gemini
error mapping. The streaming pipeline is verified manually against a live
key.
