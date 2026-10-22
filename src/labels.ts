import type { DraftStatus, Format, Stage } from "./types";

/** B2B Marketing Content Kit — Awareness (HubSpot-style). */
export const AWARENESS_FORMATS: Format[] = [
  "Blog Post",
  "Social Media Post",
  "Whitepaper",
  "Checklist",
  "How-To Video",
  "Kit or Tool",
  "Ebook or Tip Sheet",
  "Educational Webinar",
];

/** B2B Marketing Content Kit — Consideration. */
export const CONSIDERATION_FORMATS: Format[] = [
  "Email nurturing sequence",
  "Product comparison guide",
  "Case study",
  "Videos",
  "Video demo",
  "Original research and reports",
  "Podcasts and webinars",
];

/** B2B Marketing Content Kit — Decision. */
export const DECISION_FORMATS: Format[] = [
  "Product brochures, data sheets",
  "Service / support / implementation sheets",
  "Pricing information",
  "FAQs",
  "Analyst reports",
  "Free trial / live demo",
  "Consultation",
];

export const FORMATS: Format[] = [
  ...AWARENESS_FORMATS,
  ...CONSIDERATION_FORMATS,
  ...DECISION_FORMATS,
];

export const TONES = [
  "Warm",
  "Authoritative",
  "Playful",
  "Direct",
  "Premium",
] as const;

export const STAGES: {
  id: Stage;
  label: string;
  description: string;
  contentFocus: string;
}[] = [
  {
    id: "awareness",
    label: "Awareness",
    description:
      "Top-level educational content to help solve a problem, get an answer, or meet a need.",
    contentFocus: "Educate. Name the problem. Do not push a purchase yet.",
  },
  {
    id: "consideration",
    label: "Consideration",
    description:
      "Prospects know they have a problem to solve and are discovering the best solution. A future purchase commitment starts to take shape as they evaluate options.",
    contentFocus: "Compare options. Prove fit. Help them evaluate.",
  },
  {
    id: "decision",
    label: "Decision",
    description:
      "Prospects are evaluating providers. Content should cover everything they need to make the purchase decision.",
    contentFocus: "Remove risk. Make the provider choice clear.",
  },
];

export const STATUS_OPTIONS: { id: DraftStatus; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "in_review", label: "In Review" },
  { id: "approved", label: "Approved" },
];

export function formatsForStage(stage: Stage | null | undefined): Format[] {
  if (stage === "awareness") return AWARENESS_FORMATS;
  if (stage === "consideration") return CONSIDERATION_FORMATS;
  if (stage === "decision") return DECISION_FORMATS;
  return FORMATS;
}

export function stageLabel(stage: Stage): string {
  return STAGES.find((item) => item.id === stage)?.label ?? stage;
}

export function statusLabel(status: DraftStatus): string {
  return STATUS_OPTIONS.find((item) => item.id === status)?.label ?? status;
}
