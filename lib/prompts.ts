import type { AnalyzeInput } from "./validate";

export const PAPER_ANALYZER_PROMPT = `Analyze the following research paper and produce a complete State of the Field report. Work through each phase fully before moving to the next.

Phase 1 — Parse the Paper
Extract the core thesis, methodology, key findings, author-acknowledged limitations, and a full list of cited works. If there are charts, tables, or figures, interpret what they show.

Phase 2 — Citation Analysis
For the 10 most important cited works: summarize what each contributes, distinguish foundational from supporting references, and flag any that are contested or controversial in the field.

Phase 3 — Agreeing Evidence
Search for external papers and studies that support or replicate the central findings. For each: what they found, why it agrees, and how strong the evidence is (methodology quality, sample size, recency).

Phase 4 — Disagreeing Evidence
Search for papers that challenge, contradict, or offer alternative explanations. For each: what they found, why it conflicts, and whether the disagreement is methodological, interpretive, or empirical.

Phase 5 — Research Landscape
Identify the most active research groups and institutions in this area. Describe the 2-3 major schools of thought or competing frameworks. Trace how thinking in this field has evolved over the last 5-10 years.

Phase 6 — Open Questions
List what this paper explicitly leaves unanswered, what the broader field has not yet resolved, and what a rigorous follow-up study should investigate.

Deliver the output as a structured report with these sections:
1. Paper Summary (3-4 sentences)
2. Methodology Overview
3. Key Findings
4. Supporting Evidence
5. Contradicting Evidence
6. Research Landscape
7. Open Questions & Future Directions
8. Verdict — how strong and significant is this paper's contribution, and should it be trusted?

Be thorough. Check your own reasoning before finalizing each section. Flag any claims you are uncertain about rather than presenting them as fact.

--- PAPER BELOW ---`;

// Ported from backend/prompts.py for the planned Market Intel fast-follow.
// Not wired to any UI in v1.
export const MARKET_INTEL_PROMPT = `You are a senior market research analyst. When a user gives you a startup idea, company, or market vertical, produce a Market Intelligence Brief by executing this pipeline autonomously.

Phase 1 — Define the Space
Clarify the market. Identify the core problem and who has it. Establish the category. Estimate TAM/SAM/SOM with reasoning.

Phase 2 — Competitive Landscape
Map all relevant players: direct competitors, indirect competitors, incumbents to displace.
For each: founding year, funding, business model, key differentiator, traction, notable customers/investors.

Phase 3 — Funding & Investment Signals
Recent funding rounds (last 2 years). Most active VCs in this category. Recent acquisitions or exits. Current investor appetite.

Phase 4 — Trend Analysis
Is this market growing, plateauing, or declining? Macro trends driving or threatening it. What changed in the last 12-24 months. Search trends, hiring trends, media coverage as signals.

Phase 5 — SWOT
Strengths, Weaknesses, Opportunities, Threats for a new entrant.

Phase 6 — Key Players & Ecosystem
Most important people (founders, investors, researchers). Communities, conferences, publications that define this market. Ideal early customers or design partners.

Phase 7 — Verdict
Is this a good market to enter right now and why? What would a winning wedge look like? Single biggest risk. Single biggest opportunity being missed.

Output as a structured report:
1. Executive Summary (5 sentences max)
2. Market Definition & Size
3. Competitive Map (table: Company | Stage | Model | Differentiator | Funding)
4. Investment Signals
5. Trend Analysis
6. SWOT
7. Ecosystem & Key Players
8. Analyst Verdict

Be direct. Make calls. Flag uncertain claims. Do not hedge everything — a useful brief takes positions.`;

export type ContentPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export type Content = { role: "user"; parts: ContentPart[] };

export function buildAnalyzerContents(input: AnalyzeInput): Content[] {
  if (input.kind === "text") {
    return [
      {
        role: "user",
        parts: [{ text: `${PAPER_ANALYZER_PROMPT}\n\n${input.text}` }],
      },
    ];
  }
  return [
    {
      role: "user",
      parts: [
        { text: PAPER_ANALYZER_PROMPT },
        {
          inlineData: { mimeType: "application/pdf", data: input.pdfBase64 },
        },
      ],
    },
  ];
}
