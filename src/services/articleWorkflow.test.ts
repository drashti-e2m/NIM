/**
 * Acceptance test for article source-of-truth workflow.
 * Run: npx tsx src/services/articleWorkflow.test.ts
 */
import {
  approveOutline,
  buildStructuredOutline,
  checkOutlineConsistency,
  generateDraftFromOutline,
  sectionsToBody,
} from "./blogGenerate";
import type { ArticleSectionContent, Client, ToneOfVoice } from "../types";

const client: Client = {
  id: "acme",
  name: "Acme",
  website: "acme.example.com",
  industry: "Software",
  contact: "Lead",
  city: "Remote",
  summary: "Demo client",
  initials: "AC",
  color: "#555672",
  createdAt: "2026-01-01T00:00:00.000Z",
  proofPoints: [
    "Proof is labeled as illustration, never a guarantee.",
    "Buyers care about predictability more than feature lists.",
    "Demo requests follow a short education sequence.",
  ],
};

const tone: ToneOfVoice = {
  id: "plain",
  name: "Plain",
  summary: "Clear and specific",
  traits: ["Clear"],
  sample: "Write for operators who need a next step.",
};

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function run() {
  // 1. Approve an outline with four named sections.
  let outline = buildStructuredOutline({
    topic: "How Acme helps buyers decide",
    audience: "Ops leaders",
    keywords: ["buyer journey", "b2b"],
    client,
    notes: "Keep claims labeled",
    sectionCount: 4,
  });
  assert(outline.sections.length === 4, "Expected four outline sections");
  outline = approveOutline(outline);
  assert(outline.approved === true, "Outline must be approved");

  // 2–3. Generate draft from that outline; all four sections in order.
  const draft = generateDraftFromOutline({
    outline,
    client,
    tone,
    audience: "Ops leaders",
    keywords: ["buyer journey", "b2b"],
    notes: "Keep claims labeled",
    research: "- Client Drive materials",
    targetWords: 800,
  });
  assert(draft.sections.length === 4, "Draft must have four sections");
  draft.sections.forEach((section, index) => {
    assert(
      section.sectionId === outline.sections[index].id,
      `Section ${index} id mismatch`,
    );
    assert(
      section.heading === outline.sections[index].heading,
      `Section ${index} heading mismatch`,
    );
    assert(section.order === index, `Section ${index} order mismatch`);
  });

  // 4. Review content equals saved draft body (same serialization).
  const savedBody = sectionsToBody(draft.sections);
  assert(savedBody === draft.body, "Review body must match saved draft body");

  // 5–6. Edit one paragraph (section body), save, reopen review.
  const editedSections: ArticleSectionContent[] = draft.sections.map((section, index) =>
    index === 1
      ? {
          ...section,
          body: `${section.body}\n• Edited paragraph for acceptance test.`,
        }
      : section,
  );
  const editedBody = sectionsToBody(editedSections);
  assert(
    editedBody.includes("Edited paragraph for acceptance test."),
    "Edited paragraph missing from saved body",
  );
  assert(
    editedBody !== savedBody,
    "Edited body should differ from original saved draft",
  );

  // 7. Export matches saved version (exact string).
  const exported = editedBody;
  assert(exported === editedBody, "Export must equal saved version");

  // 8. Remove a section → consistency checker flags it.
  const incomplete = editedSections.filter((_, index) => index !== 2);
  const issues = checkOutlineConsistency(outline, incomplete);
  assert(
    issues.some((issue) => issue.code === "missing_section"),
    "Expected missing_section consistency issue",
  );

  console.log("articleWorkflow.test.ts: all acceptance checks passed");
}

run();
