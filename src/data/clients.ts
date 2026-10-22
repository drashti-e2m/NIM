import type { Client } from "../types";

const COLORS = ["#6b3a5a", "#2f5d50", "#245a86", "#8a5a2b", "#8c3a2f", "#3d4f6f", "#5a3d2b"];

export const seedClients: Client[] = [
  {
    id: "wbe",
    name: "WBE",
    website: "wbe.example.com",
    industry: "Certification & supplier diversity",
    contact: "Program lead",
    city: "National",
    summary:
      "Program for a women’s business enterprise network focused on certification visibility, buyer introductions, and member growth.",
    initials: "WB",
    color: "#6b3a5a",
    createdAt: "2026-09-01T12:00:00.000Z",
    proofPoints: [
      "Members use certification status as the first proof point in buyer conversations.",
      "Introductions are prioritized by category fit, not generic networking volume.",
      "Quarterly events give members a reason to re-engage without a hard sell.",
    ],
  },
  {
    id: "powerup",
    name: "PowerUp Leadership",
    website: "vertexeng.com",
    industry: "Leadership development",
    contact: "Partnerships",
    city: "Regional",
    summary:
      "Leadership development for scaling private companies — leadership challenges in growth, talent retention, post-acquisition leadership gaps, and team alignment.",
    initials: "PU",
    color: "#2f5d50",
    createdAt: "2026-09-08T12:00:00.000Z",
    proofPoints: [
      "Content priorities: leadership challenges in scaling companies.",
      "Talent retention and manager readiness for growing teams.",
      "Post-acquisition leadership gaps and cross-team alignment.",
    ],
  },
  {
    id: "crosscap",
    name: "CrossCap",
    website: "crosscap.example.com",
    industry: "Capital & advisory",
    contact: "Marketing lead",
    city: "National",
    summary:
      "CrossCap work focused on credibility with operators, association presence, and a nurture path for capital conversations.",
    initials: "CC",
    color: "#245a86",
    createdAt: "2026-09-15T12:00:00.000Z",
    proofPoints: [
      "Content leads with operator outcomes, not fund jargon.",
      "Association and event presence is tracked against named target accounts.",
      "Nurture sequences separate education from a capital ask.",
    ],
  },
  {
    id: "function-point",
    name: "Function Point",
    website: "functionpoint.example.com",
    industry: "Software",
    contact: "Content lead",
    city: "Remote",
    summary:
      "Function Point program around estimation clarity, buyer education, and a lead path from blog and email into product conversations.",
    initials: "FP",
    color: "#8a5a2b",
    createdAt: "2026-09-22T12:00:00.000Z",
    proofPoints: [
      "Estimation examples stay labeled as illustrations, never as guarantees.",
      "Buyers care about predictability of delivery more than feature lists.",
      "Demo requests follow a short education sequence, not a cold CTA.",
    ],
  },
  {
    id: "pggc",
    name: "PGGC",
    website: "pggc.example.com",
    industry: "Professional services",
    contact: "Growth lead",
    city: "Regional",
    summary:
      "Full client example: presentation, networking playbook, content cadence, associations strategy, email nurture, and implementation trackers.",
    initials: "PG",
    color: "#8c3a2f",
    createdAt: "2026-10-01T12:00:00.000Z",
    proofPoints: [
      "In-person networking follows a repeatable playbook, not ad-hoc event hopping.",
      "Blog and social cadence is planned against named pipeline themes.",
      "Lead nurture is tracked from first touch through a booked conversation.",
    ],
  },
];

/** @deprecated Prefer useClients(). Kept for modules that only need seed lookup during boot. */
export const clients = seedClients;

export function getClient(id: string): Client | undefined {
  return seedClients.find((client) => client.id === id);
}

export function makeClientDraft(input: {
  name: string;
  website: string;
  industry?: string;
  city?: string;
  summary?: string;
}): Client {
  const name = input.name.trim();
  const words = name.split(/\s+/).filter(Boolean);
  const initials = (
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`
      : name.slice(0, 2)
  ).toUpperCase();
  const idBase = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "client";
  return {
    id: `${idBase}-${crypto.randomUUID().slice(0, 8)}`,
    name,
    website: input.website.trim().replace(/^https?:\/\//, ""),
    industry: input.industry?.trim() || "General",
    contact: "Account lead",
    city: input.city?.trim() || "Remote",
    summary:
      input.summary?.trim() ||
      `NIM Content Studio workspace for ${name}.`,
    initials,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    createdAt: new Date().toISOString(),
    proofPoints: [
      `${name} work stays inside this client workspace.`,
      "Tone, drafts, and usage are attributed to this client id.",
      "Content is generated through the blog pipeline for this client.",
    ],
  };
}
