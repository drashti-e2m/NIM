import type { Brief } from "../types";

export const defaultBriefs: Record<string, Brief> = {
  wbe: {
    format: "Educational Webinar",
    persona: "Certified women-owned suppliers seeking buyer introductions",
    tone: "Warm",
    goal: "Invite members into the next networking window with a clear reason to show up",
    keywords: "certification, supplier diversity, introductions",
    cta: "Reserve a seat at the next session",
    instructions:
      "Lead with certification as proof, not as a slogan. Keep the ask one step.",
  },
  powerup: {
    format: "Blog Post",
    persona:
      "Founders, executives, and leaders of fast-growing private companies",
    tone: "Strategic, practical, credible, and approachable",
    goal: "Help leaders spot leadership readiness gaps before the next stage of growth",
    keywords: "leadership team development",
    cta: "Start a focused leadership assessment",
    instructions:
      "Stay strategic and practical. No invented client results. Cover scaling leadership, talent retention, and team alignment.",
  },
  crosscap: {
    format: "Blog Post",
    persona: "Operators evaluating capital and advisory partners",
    tone: "Authoritative",
    goal: "Build credibility before a capital conversation",
    keywords: "operators, capital, associations",
    cta: "Talk with the CrossCap team",
    instructions:
      "Avoid fund jargon. Use operator outcomes and association presence as proof.",
  },
  "function-point": {
    format: "Whitepaper",
    persona: "Delivery leads who need clearer estimation conversations",
    tone: "Direct",
    goal: "Educate buyers on predictable delivery before a demo ask",
    keywords: "estimation, delivery, predictability",
    cta: "Request a product walkthrough",
    instructions:
      "Label examples as illustrations. Do not promise delivery dates.",
  },
  pggc: {
    format: "Email nurturing sequence",
    persona: "Association and event contacts who can open warm introductions",
    tone: "Warm",
    goal: "Nurture association leads into a booked conversation",
    keywords: "associations, events, nurture",
    cta: "Book a 20-minute intro call",
    instructions:
      "Reference the networking playbook and cadence. Keep the tone host-like.",
  },
};

export function getDefaultBrief(clientId: string): Brief {
  return (
    defaultBriefs[clientId] ?? {
      format: "Blog Post",
      persona: "",
      tone: "Warm",
      goal: "",
      keywords: "",
      cta: "",
      instructions: "",
    }
  );
}
