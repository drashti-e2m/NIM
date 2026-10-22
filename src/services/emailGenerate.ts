import { formatToneInstructions } from "../data/tones";
import type {
  Client,
  NurtureEmail,
  ToneOfVoice,
} from "../types";

export interface EmailSequenceBrief {
  name: string;
  objective: string;
  audience: string;
  emailCount: number;
  cadenceDays: number;
  timingNote: string;
}

export interface GenerateSequenceInput {
  client: Client;
  tone: ToneOfVoice | null;
  brief: EmailSequenceBrief;
  /** Optional excerpt from the client’s existing email nurture doc. */
  programNotes?: string;
}

const SEQUENCE_ROLES = [
  {
    label: "Welcome & relevance",
    subject: (client: string, audience: string) =>
      `${audience}: a practical start with ${client}`,
    angle: "Open with why this sequence exists and what they will get.",
  },
  {
    label: "Proof & clarity",
    subject: (client: string) =>
      `How teams like yours get value from ${client}`,
    angle: "Share a concrete proof point or example without hard selling.",
  },
  {
    label: "Objection handling",
    subject: () => "The question most buyers ask before the next step",
    angle: "Address the main hesitation with plain language.",
  },
  {
    label: "Soft invite",
    subject: (client: string) =>
      `A low-friction next step with ${client}`,
    angle: "Invite a conversation or resource without pressure.",
  },
  {
    label: "Follow-through",
    subject: () => "Still useful if the timing was off",
    angle: "Keep the door open and restate one clear CTA.",
  },
  {
    label: "Program deep dive",
    subject: (client: string) => `Inside ${client}: what happens after the intro`,
    angle: "Explain what engagement looks like after the first reply.",
  },
];

function clampCount(n: number): number {
  return Math.min(8, Math.max(2, Math.round(n) || 4));
}

function firstProof(client: Client): string {
  return (
    client.proofPoints[0]?.trim() ||
    `${client.name} leads with clarity for ${client.industry.toLowerCase()} buyers.`
  );
}

function toneHint(tone: ToneOfVoice | null): string {
  if (!tone) return "Write in a clear, professional brand voice.";
  return formatToneInstructions(tone).split("\n").slice(0, 4).join(" ");
}

function previewFromSubject(subject: string): string {
  const clean = subject.replace(/\s+/g, " ").trim();
  if (clean.length <= 90) return `${clean} - open for the short version.`;
  return `${clean.slice(0, 86)}…`;
}

function bodyFor(
  role: (typeof SEQUENCE_ROLES)[number],
  input: GenerateSequenceInput,
  index: number,
  total: number,
): string {
  const { client, brief } = input;
  const proof = firstProof(client);
  const notes = input.programNotes?.trim()
    ? `\n\nProgram note: ${input.programNotes.trim().split("\n")[0]}`
    : "";

  return [
    `Hi {{first_name}},`,
    ``,
    `Email ${index + 1} of ${total} · ${role.label}`,
    ``,
    `You are on this sequence because we want to help ${brief.audience} with: ${brief.objective}.`,
    ``,
    role.angle,
    ``,
    proof,
    ``,
    `What this looks like with ${client.name}:`,
    `- One clear idea (no attachment dump)`,
    `- Language that matches how ${brief.audience} actually talk`,
    `- A single next step when you are ready`,
    notes,
    ``,
    toneHint(input.tone),
    ``,
    `Talk soon,`,
    `{{sender_name}}`,
    `${client.name}`,
  ]
    .filter((line) => line !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ctaFor(index: number, total: number, client: Client): string {
  if (index === 0) return `See how ${client.name} works`;
  if (index >= total - 1) return "Book a short intro call";
  if (index === 1) return "Read a short example";
  return "Reply with your top question";
}

export function generateNurtureSequence(
  input: GenerateSequenceInput,
): NurtureEmail[] {
  const count = clampCount(input.brief.emailCount);
  const cadence = Math.max(1, input.brief.cadenceDays || 3);
  const emails: NurtureEmail[] = [];

  for (let i = 0; i < count; i += 1) {
    const role = SEQUENCE_ROLES[i % SEQUENCE_ROLES.length];
    const subject = role.subject(input.client.name, input.brief.audience);
    emails.push({
      id: crypto.randomUUID(),
      order: i + 1,
      sendDayOffset: i * cadence,
      subject,
      previewText: previewFromSubject(subject),
      body: bodyFor(role, input, i, count),
      cta: ctaFor(i, count, input.client),
      status: "draft",
    });
  }

  return emails;
}

export function regenerateNurtureEmail(
  input: GenerateSequenceInput,
  email: NurtureEmail,
  total: number,
): NurtureEmail {
  const role =
    SEQUENCE_ROLES[(email.order - 1) % SEQUENCE_ROLES.length] ??
    SEQUENCE_ROLES[0];
  const subject = `${role.subject(input.client.name, input.brief.audience)} (${email.order})`;
  return {
    ...email,
    subject,
    previewText: previewFromSubject(subject),
    body: bodyFor(role, input, email.order - 1, total),
    cta: ctaFor(email.order - 1, total, input.client),
    status: "draft",
  };
}

export function defaultCampaignName(client: Client, objective: string): string {
  const short = objective.trim().split(/\s+/).slice(0, 6).join(" ");
  return short
    ? `${client.name} nurture - ${short}`
    : `${client.name} email nurture`;
}

export interface SingleEmailBrief {
  goal: string;
  audience: string;
  cta: string;
  instructions?: string;
  contentType: "single" | "blog_to_email" | "newsletter";
}

export function generateSingleEmail(input: {
  client: Client;
  tone: ToneOfVoice | null;
  brief: SingleEmailBrief;
  programNotes?: string;
}): NurtureEmail {
  const { client, brief } = input;
  const proof = firstProof(client);
  const subject =
    brief.contentType === "newsletter"
      ? `${client.name} update: what matters this month`
      : brief.contentType === "blog_to_email"
        ? `From our latest piece: what ${brief.audience.toLowerCase()} should know`
        : `5 ways ${client.name} helps ${brief.audience.toLowerCase()} move forward`;

  const bullets = [
    `Focus on high-intent opportunities for ${brief.audience.toLowerCase()}`,
    `Improve clarity so ${client.name} claims stay credible`,
    `Use proof points buyers can verify quickly`,
    `Keep one clear next step - “${brief.cta}”`,
    `Stay consistent with the brand voice in follow-ups`,
  ];

  const body = [
    `Hi {{first_name}},`,
    ``,
    brief.contentType === "newsletter"
      ? `A short roundup from ${client.name} - built for ${brief.audience.toLowerCase()}.`
      : `If you are focused on “${brief.goal.toLowerCase()}”, here is a practical take from ${client.name}.`,
    ``,
    proof,
    ``,
    `Here is what we recommend:`,
    ...bullets.map((line, i) => `${i + 1}. ${line}`),
    ``,
    brief.instructions?.trim()
      ? `Note: ${brief.instructions.trim()}`
      : "",
    ``,
    `When you are ready, use the button below.`,
    ``,
    `Talk soon,`,
    `{{sender_name}}`,
    `${client.name}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: crypto.randomUUID(),
    order: 1,
    sendDayOffset: 0,
    subject,
    previewText: previewFromSubject(subject),
    body,
    cta: brief.cta,
    status: "draft",
  };
}

export function subjectVariants(
  client: Client,
  audience: string,
  base: string,
): string[] {
  return [
    base,
    `${client.name} for ${audience}: a clearer next step`,
    `What ${audience.toLowerCase()} ask before they engage ${client.name}`,
    `A short note from ${client.name} (worth 2 minutes)`,
  ];
}
