import type { Brief, Client, Format, Stage, TopicSuggestion } from "../types";
import { topicsFor } from "../data/topics";

const toneOpeners: Record<string, string> = {
  Warm: "You already know the vague version of this. Here is the version that helps.",
  Authoritative: "The claim is simple. The useful part is what sits underneath it.",
  Playful: "No jargon tour. Just the part you can actually use.",
  Direct: "Here is the point. Then the next step.",
  Premium: "The difference is in the details that usually get skipped.",
};

export function suggestTopics(
  clientId: string,
  stage: Stage,
  brief: Brief,
): TopicSuggestion[] {
  const topics = topicsFor(clientId, stage);
  const keywords = splitKeywords(brief.keywords);
  if (keywords.length === 0 || topics.length === 0) return topics;
  const last = topics[topics.length - 1];
  return topics.map((topic) =>
    topic.id === last.id
      ? {
          ...topic,
          angle: `${topic.angle} Built to carry ${formatList(keywords)}.`,
        }
      : topic,
  );
}

export function generateDraft(input: {
  client: Client;
  stage: Stage;
  brief: Brief;
  topic: TopicSuggestion;
  variant: number;
}): { title: string; body: string } {
  const { client, stage, brief, topic, variant } = input;
  const title = topic.title;
  const core = buildCore({ client, stage, brief, topic, variant });
  const body = wrapFormat(brief.format, title, core, brief, client);
  return { title, body };
}

function buildCore(input: {
  client: Client;
  stage: Stage;
  brief: Brief;
  topic: TopicSuggestion;
  variant: number;
}): string[] {
  const { client, stage, brief, topic, variant } = input;
  const persona = brief.persona.trim() || "the reader";
  const goal = sentence(brief.goal.trim());
  const proof = sentence(
    client.proofPoints[variant % client.proofPoints.length] ??
      client.proofPoints[0],
  );
  const opener = toneOpeners[brief.tone] ?? toneOpeners.Warm;
  const keywords = splitKeywords(brief.keywords);

  const stageLine =
    stage === "awareness"
      ? `${topic.angle} This is educational content for ${persona}.`
      : stage === "consideration"
        ? `${topic.angle} ${persona} is comparing options and judging fit.`
        : `${topic.angle} ${persona} is evaluating providers and needs a clear next step.`;

  const lines = [opener, stageLine, proof];
  if (goal) lines.push(goal);
  if (keywords.length > 0) {
    lines.push(`The wording stays with ${formatList(keywords)}.`);
  }
  return lines;
}

function wrapFormat(
  format: Format,
  title: string,
  core: string[],
  brief: Brief,
  client: Client,
): string {
  const cta = brief.cta.trim() || "Take the next step";
  const copy = core.join("\n\n");
  const tags = splitKeywords(brief.keywords)
    .slice(0, 3)
    .map((word) => `#${word.replace(/[^a-z0-9]+/gi, "")}`)
    .filter((tag) => tag.length > 1);

  switch (format) {
    case "Social Media Post":
      return [core[0], "", core[2] ?? "", "", cta, tags.join(" "), client.name]
        .filter((line) => line !== "")
        .join("\n\n");

    case "Checklist":
      return [
        title,
        "",
        copy,
        "",
        "Checklist",
        "1. Name the problem in one sentence.",
        "2. Confirm who feels it most.",
        "3. List what a useful next step looks like.",
        "4. Capture the proof you can stand behind.",
        "5. " + cta,
        "",
        client.name,
      ].join("\n");

    case "How-To Video":
    case "Videos":
    case "Video demo":
      return [
        `Video outline - ${title}`,
        "",
        "Hook (0:00)",
        core[0],
        "",
        "Problem (0:20)",
        core[1],
        "",
        "Proof (0:50)",
        core[2] ?? "",
        "",
        "Close",
        cta,
        "",
        client.name,
      ].join("\n");

    case "Educational Webinar":
    case "Podcasts and webinars":
      return [
        `Session plan - ${title}`,
        "",
        "Audience",
        brief.persona || "Ideal buyers in this stage",
        "",
        "Agenda",
        "1. Frame the problem",
        "2. Walk the useful answer",
        "3. Show proof",
        "4. Q&A and next step",
        "",
        copy,
        "",
        `Close CTA: ${cta}`,
        "",
        client.name,
      ].join("\n");

    case "Email nurturing sequence":
      return [
        `Nurture sequence - ${title}`,
        "",
        "Email 1 - Open the problem",
        core[0],
        "",
        "Email 2 - Add proof",
        core[2] ?? core[1],
        "",
        "Email 3 - Invite the next step",
        `${core[1]}\n\n${cta}`,
        "",
        client.name,
      ].join("\n");

    case "Product comparison guide":
      return [
        title,
        "",
        copy,
        "",
        "Comparison frame",
        "Option A - Status quo",
        "Option B - Partial fix",
        `Option C - ${client.name}`,
        "",
        "Decision criteria",
        "- Fit for the buyer’s real constraint",
        "- Proof you can verify",
        "- Clarity of next step",
        "",
        cta,
        "",
        client.name,
      ].join("\n");

    case "Case study":
    case "Original research and reports":
    case "Whitepaper":
    case "Ebook or Tip Sheet":
    case "Analyst reports":
      return [
        title,
        "",
        "Executive summary",
        copy,
        "",
        "What this covers",
        "- The problem buyers are naming",
        "- What a useful approach looks like",
        `- How ${client.name} shows up in the solution`,
        "",
        cta,
        "",
        client.name,
      ].join("\n");

    case "Kit or Tool":
      return [
        `Kit - ${title}`,
        "",
        "What is inside",
        "- One-page problem frame",
        "- Working checklist",
        "- Example language buyers can reuse",
        "",
        copy,
        "",
        `How to use it: ${cta}`,
        "",
        client.name,
      ].join("\n");

    case "Product brochures, data sheets":
    case "Service / support / implementation sheets":
    case "Pricing information":
      return [
        title,
        "",
        "Overview",
        copy,
        "",
        "What buyers need on this sheet",
        "- What it is",
        "- Who it is for",
        "- What happens next",
        "",
        cta,
        "",
        client.name,
      ].join("\n");

    case "FAQs":
      return [
        `FAQs - ${title}`,
        "",
        "Q: What problem is this for?",
        `A: ${core[1]}`,
        "",
        "Q: What proof should we trust?",
        `A: ${core[2] ?? ""}`,
        "",
        "Q: What is the next step?",
        `A: ${cta}`,
        "",
        client.name,
      ].join("\n");

    case "Free trial / live demo":
    case "Consultation":
      return [
        title,
        "",
        copy,
        "",
        "Offer details",
        `- Format: ${format}`,
        `- For: ${brief.persona || "qualified prospects"}`,
        `- Next step: ${cta}`,
        "",
        client.name,
      ].join("\n");

    case "Blog Post":
    default:
      return [copy, "", `${cta} - ${client.name}`].join("\n");
  }
}

function sentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return capitalized.endsWith(".") ? capitalized : `${capitalized}.`;
}

function splitKeywords(keywords: string): string[] {
  return keywords
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatList(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}
