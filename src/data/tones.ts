import type { ToneOfVoice } from "../types";

export const tones: ToneOfVoice[] = [
  {
    id: "authoritative-plain",
    name: "Authoritative & Plain-Spoken",
    status: "draft",
    clientLabel: "General business / B2B",
    icon: "hearts",
    summary:
      "Clear, confident, and concrete. Uses short, direct sentences, explains complex ideas in plain English, and supports claims with evidence. Avoids jargon, exaggerated promises, and unnecessary introductions.",
    traits: ["Direct", "Credible", "No fluff"],
    sample:
      "The claim is simple: a useful strategy connects the problem to a measurable outcome. Start by identifying what needs to change, establish how success will be measured, and choose the actions most likely to make a difference.",
    sampleCopy:
      "The claim is simple: a useful strategy connects the problem to a measurable outcome. Start by identifying what needs to change, establish how success will be measured, and choose the actions most likely to make a difference.",
    writingRules: [
      "Lead with the main point rather than a lengthy introduction.",
      "Prefer short, clear sentences and active voice.",
      "Explain technical terms when the audience may not know them.",
      "Support factual claims with approved evidence.",
      "End sections with a clear takeaway or practical next step.",
    ],
    preferredPhrases: [
      "The key consideration is…",
      "Here is what the evidence shows.",
      "Start by identifying…",
      "The next step is…",
    ],
    avoidedPhrases: [
      "Revolutionary game-changer",
      "Unlock unprecedented potential",
      "In today's fast-paced world",
      "Guaranteed results",
    ],
    bestFor:
      "B2B thought leadership, expert explainers, and technical blogs.",
  },
  {
    id: "warm-guide",
    name: "Warm Guide",
    status: "draft",
    clientLabel: "Educational content / Guides",
    icon: "compass",
    summary:
      "Helpful and human. Sounds like a knowledgeable colleague who understands the reader's challenges and explains solutions without judgment. Encourages action without sounding pushy or overly promotional.",
    traits: ["Warm", "Practical", "Inviting"],
    sample:
      "You may already know that a content strategy matters. The difficult part is turning that idea into a plan you can actually follow. Start with your audience, identify the questions they need answered, and build your content around those needs.",
    sampleCopy:
      "You may already know that a content strategy matters. The difficult part is turning that idea into a plan you can actually follow. Start with your audience, identify the questions they need answered, and build your content around those needs.",
    writingRules: [
      "Address the reader directly using “you” where appropriate.",
      "Acknowledge common challenges before offering solutions.",
      "Explain ideas step by step with practical examples.",
      "Use reassuring language without oversimplifying.",
      "Make recommendations feel supportive, not forceful.",
    ],
    preferredPhrases: [
      "A useful place to start is…",
      "You can approach this by…",
      "Let's break it down.",
      "Here's how to put it into practice.",
    ],
    avoidedPhrases: [
      "Obviously",
      "You should already know…",
      "It's as simple as that",
      "Aggressive sales language",
    ],
    bestFor:
      "Beginner guides, educational blogs, and onboarding content.",
  },
  {
    id: "premium-precise",
    name: "Premium & Precise",
    status: "draft",
    clientLabel: "Premium services / Executive audiences",
    icon: "diamonds",
    summary:
      "Measured, polished, and detail-oriented. Prioritizes specificity, considered language, and depth over volume. Communicates expertise through clarity and substance rather than extravagant adjectives.",
    traits: ["Premium", "Specific", "Restrained"],
    sample:
      "Strong content strategy begins with precise decisions: which audience matters, which questions deserve attention, and what evidence supports each recommendation. The quality of the work depends less on publishing volume than on the relevance and consistency of those decisions.",
    sampleCopy:
      "Strong content strategy begins with precise decisions: which audience matters, which questions deserve attention, and what evidence supports each recommendation. The quality of the work depends less on publishing volume than on the relevance and consistency of those decisions.",
    writingRules: [
      "Use precise language and remove redundant sentences.",
      "Choose specific nouns and verbs over decorative adjectives.",
      "Maintain a composed, professional rhythm.",
      "Include relevant nuance and qualifications.",
      "Never imply exclusivity, superiority, or performance without evidence.",
    ],
    preferredPhrases: [
      "The distinction lies in…",
      "A more considered approach…",
      "The relevant factors are…",
      "Precision matters when…",
    ],
    avoidedPhrases: [
      "Luxury like never before",
      "Unmatched excellence",
      "The ultimate solution",
      "Excessive superlatives",
    ],
    bestFor:
      "Executive insights, premium service pages, and high-consideration topics.",
  },
  {
    id: "operator-direct",
    name: "Operator Direct",
    status: "draft",
    clientLabel: "Operations / Implementation / How-to content",
    icon: "bolt",
    summary:
      "Action-first and practical. Helps busy professionals understand what to do, in what order, and why it matters. Removes filler and turns advice into concrete steps.",
    traits: ["Blunt", "Useful", "Action-first"],
    sample:
      "Start with three things: define the outcome, assign an owner, and set a deadline. Then identify the dependencies that could delay delivery. Review progress against those checkpoints and resolve blockers before they affect the schedule.",
    sampleCopy:
      "Start with three things: define the outcome, assign an owner, and set a deadline. Then identify the dependencies that could delay delivery. Review progress against those checkpoints and resolve blockers before they affect the schedule.",
    writingRules: [
      "State the action or recommendation first.",
      "Use numbered steps for processes and implementation guides.",
      "Specify owners, dependencies, and next steps when relevant.",
      "Keep paragraphs focused on one task or decision.",
      "Explain risks and constraints directly.",
    ],
    preferredPhrases: [
      "Start with…",
      "Prioritize…",
      "Check this before…",
      "The next action is…",
    ],
    avoidedPhrases: [
      "It is worth noting that…",
      "Leverage synergies",
      "Circle back",
      "Long introductions before actionable information",
    ],
    bestFor:
      "Implementation guides, checklists, process documentation, and practical how-to blogs.",
  },
];

export function getTone(id: string): ToneOfVoice | undefined {
  return tones.find((tone) => tone.id === id);
}

export function defaultToneExtras(
  tone: Pick<ToneOfVoice, "traits" | "sample" | "summary">,
): Pick<
  ToneOfVoice,
  | "status"
  | "clientLabel"
  | "icon"
  | "writingRules"
  | "preferredPhrases"
  | "avoidedPhrases"
  | "sampleCopy"
  | "bestFor"
> {
  return {
    status: "draft",
    clientLabel: "Custom",
    icon: "spark",
    writingRules: [
      "Stay consistent with the tone traits",
      "Prefer concrete language over vague claims",
      "Match the sample line's rhythm",
    ],
    preferredPhrases: tone.traits.slice(0, 3).map((trait) => `${trait}…`),
    avoidedPhrases: ["Obviously", "Basically", "Game-changer"],
    sampleCopy: tone.sample || tone.summary,
    bestFor: "General blog and email content for this brand voice.",
  };
}

/**
 * Pack a saved tone profile into reusable LLM instructions.
 * Writers select the tone once; generation consumes this block automatically.
 */
export function formatToneInstructions(tone: ToneOfVoice): string {
  const lines: string[] = [
    `Tone of voice: ${tone.name}`,
    `Personality: ${tone.summary.trim()}`,
  ];
  if (tone.bestFor?.trim()) {
    lines.push(`Best for (context): ${tone.bestFor.trim()}`);
  }
  const rules = (tone.writingRules ?? []).map((rule) => rule.trim()).filter(Boolean);
  if (rules.length) {
    lines.push("Writing rules (follow closely):");
    for (const rule of rules) lines.push(`- ${rule}`);
  }
  const preferred = (tone.preferredPhrases ?? [])
    .map((phrase) => phrase.trim())
    .filter(Boolean);
  if (preferred.length) {
    lines.push(
      `Preferred phrases (use where natural): ${preferred.map((p) => `“${p}”`).join("; ")}`,
    );
  }
  const avoided = (tone.avoidedPhrases ?? [])
    .map((phrase) => phrase.trim())
    .filter(Boolean);
  if (avoided.length) {
    lines.push(
      `Avoided phrases (do not use): ${avoided.map((p) => `“${p}”`).join("; ")}`,
    );
  }
  const sample = (tone.sampleCopy || tone.sample).trim();
  if (sample) {
    lines.push(`Sample copy (match this style): ${sample}`);
  }
  if (tone.traits.length) {
    lines.push(`Traits: ${tone.traits.join(", ")}`);
  }
  return lines.join("\n");
}
