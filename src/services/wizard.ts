import type { Brief, DraftStatus, Stage, TopicSuggestion } from "../types";
import { getDefaultBrief } from "../data/briefs";

const steps = ["stage", "brief", "topics", "draft"] as const;
type StepId = (typeof steps)[number];

export interface WizardSnapshot {
  step: StepId;
  brief: Brief;
  stage: Stage | null;
  topics: TopicSuggestion[];
  selectedTopicId: string | null;
  title: string;
  body: string;
  status: DraftStatus;
  variant: number;
  savedId: string | null;
  snapshot: string;
}

function key(clientId: string) {
  return `nim.wizard.${clientId}`;
}

export function emptyWizard(clientId: string): WizardSnapshot {
  return {
    step: "stage",
    brief: getDefaultBrief(clientId),
    stage: null,
    topics: [],
    selectedTopicId: null,
    title: "",
    body: "",
    status: "draft",
    variant: 0,
    savedId: null,
    snapshot: "",
  };
}

export function readWizard(clientId: string): WizardSnapshot {
  const fallback = emptyWizard(clientId);
  try {
    const raw = sessionStorage.getItem(key(clientId));
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isSnapshot(parsed)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

export function writeWizard(clientId: string, value: WizardSnapshot) {
  try {
    sessionStorage.setItem(key(clientId), JSON.stringify(value));
  } catch {
    // The in-progress brief still lives in memory for this visit.
  }
}

function isSnapshot(value: unknown): value is WizardSnapshot {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<WizardSnapshot>;
  return (
    (item.step === "brief" ||
      item.step === "stage" ||
      item.step === "topics" ||
      item.step === "draft") &&
    isBrief(item.brief) &&
    (item.stage === null ||
      item.stage === "awareness" ||
      item.stage === "consideration" ||
      item.stage === "decision") &&
    Array.isArray(item.topics) &&
    typeof item.title === "string" &&
    typeof item.body === "string" &&
    (item.status === "draft" ||
      item.status === "in_review" ||
      item.status === "approved")
  );
}

function isBrief(value: unknown): value is Brief {
  if (!value || typeof value !== "object") return false;
  const brief = value as Partial<Brief>;
  return (
    typeof brief.format === "string" &&
    typeof brief.persona === "string" &&
    typeof brief.tone === "string" &&
    typeof brief.goal === "string" &&
    typeof brief.keywords === "string" &&
    typeof brief.cta === "string" &&
    typeof brief.instructions === "string"
  );
}
