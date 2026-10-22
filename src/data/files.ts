import type { DriveItem } from "../types";

interface Seed {
  id: string;
  parentId: string | null;
  name: string;
  kind: DriveItem["kind"];
  updatedAt: string;
  detail?: string;
  body?: string;
}

function itemsFor(clientId: string, seeds: Seed[]): DriveItem[] {
  return seeds.map((seed) => ({ ...seed, clientId }));
}

/** Shared client folder layout for demo Drive files. */
function clientFolderSeeds(input: {
  id: string;
  label: string;
  presentationTitle: string;
  presentationBody: string;
  playbookBody: string;
  cadenceBody: string;
  eventsBody: string;
  emailBody: string;
  implBody: string;
  trackerBody: string;
  updatedAt?: string;
}): Seed[] {
  const { id, label } = input;
  const updatedAt = input.updatedAt ?? "2026-10-08";
  return [
    {
      id: `${id}-presentation`,
    parentId: null,
      name: input.presentationTitle,
      kind: "pdf",
      updatedAt,
      detail: "Strategy deck",
      body: input.presentationBody,
    },
    {
      id: `${id}-playbook`,
    parentId: null,
      name: `${label}_In-Person_Networking_Playbook.doc`,
      kind: "doc",
      updatedAt,
      detail: "Playbook",
      body: input.playbookBody,
    },
    {
      id: `${id}-cadence`,
    parentId: null,
      name: `${label} blog topics + social media cadence.sheet`,
      kind: "sheet",
      updatedAt,
      detail: "1 sheet",
      body: input.cadenceBody,
    },
    {
      id: `${id}-events`,
    parentId: null,
      name: `${label}_Associations_Events_Strategy.sheet`,
    kind: "sheet",
      updatedAt,
    detail: "1 sheet",
      body: input.eventsBody,
    },
    {
      id: `${id}-email`,
    parentId: null,
      name: `${label}_Email_Lead_Generation_and_Nurture_Formatted.doc`,
    kind: "doc",
      updatedAt,
      detail: "Nurture",
      body: input.emailBody,
    },
    {
      id: `${id}-impl`,
    parentId: null,
      name: `${label}_Implementation_Service_Items.sheet`,
      kind: "sheet",
      updatedAt,
      detail: "1 sheet",
      body: input.implBody,
    },
    {
      id: `${id}-tracker`,
    parentId: null,
      name: `${label}_Lead_Generation_and_Nurture_Tracker.sheet`,
      kind: "sheet",
      updatedAt,
      detail: "1 sheet",
      body: input.trackerBody,
    },
  ];
}

const wbe = itemsFor(
  "wbe",
  clientFolderSeeds({
    id: "wbe",
    label: "WBE",
    presentationTitle: "WBE Final Strategy Presentation.pdf",
    presentationBody: `WBE — strategy presentation

Purpose
Position certified women-owned suppliers for buyer introductions and member growth.

Core message
Certification is proof. Introductions should follow category fit, not volume networking.

Priorities
1. Make certification status visible in every member-facing touch.
2. Run quarterly sessions that give members a reason to return.
3. Track introductions against named buyer categories.

Use this deck before drafting public posts or emails. Keep claims tied to program facts in the tracker and playbook.`,
    playbookBody: `WBE — In-person networking playbook

Before the room
Confirm category focus for the night. Bring a one-line intro that names certification and category, not a pitch deck.

In the room
Open with who you help. Ask one buyer question. Exchange a next step, not a brochure dump.

After the room
Log the introduction in the nurture tracker within 24 hours. Send one follow-up that names the fit.

Do not
Promise introductions you cannot make. Treat every badge as an automatic win.`,
    cadenceBody: `WBE — Blog topics + social cadence

Week | Theme | Channel
1 | What certification unlocks | LinkedIn + blog
2 | Category-fit introductions | Email + LinkedIn
3 | Member story (90 days) | Blog
4 | Upcoming session invite | Email + social

Cadence notes
Two LinkedIn posts per week max. One member story per month. Session invites go out 14 and 3 days before.`,
    eventsBody: `WBE — Associations & events strategy

Priority events
- Supplier diversity councils (regional)
- Industry buyer forums aligned to member categories
- Quarterly WBE member sessions

Selection rule
Attend only if at least three target buyer categories will be in the room.

Field | Value
Owner | Program lead
Review cycle | Monthly`,
    emailBody: `WBE — Email lead generation and nurture

Sequence
1. Welcome + what certification unlocks
2. How introductions are prioritized
3. Member story (specific, recent)
4. Invite to the next session

Rules
One CTA per email. No discount language. Reference the playbook for in-person follow-up.`,
    implBody: `WBE — Implementation service items

Item | Status | Owner
Voice lock for member emails | Done | Program lead
Session invite templates | In progress | Marketing
Buyer category list refresh | Planned | Partnerships
Tracker hygiene (weekly) | Ongoing | Ops`,
    trackerBody: `WBE — Lead generation and nurture tracker

Lead | Source | Stage | Next step | Owner
Avery Mills | Session | Nurture | Send story email | Marketing
Northwind Buyers | Event | Introduced | Book follow-up | Partnerships
River City Co-op | Referral | Awareness | Add to sequence | Marketing`,
  }),
);

const powerup = itemsFor(
  "powerup",
  clientFolderSeeds({
    id: "powerup",
    label: "PowerUp Leadership",
    presentationTitle: "NIM PowerUp Strategy First Final Presentation.pdf",
    presentationBody: `PowerUp Leadership — strategy presentation

Purpose
Move operators from interest in a peer growth cohort to a discovery call and enrollment.

Core message
PowerUp is operator-led. Cohorts stay small enough to speak and still get coached.

Priorities
1. Lead with the first 90 days, not a vague transformation promise.
2. Keep enrollment behind a short discovery call.
3. Use alumni proof that names what changed.

Drafting rule
If a line could belong to any leadership course, rewrite it until it only fits PowerUp.`,
    playbookBody: `PowerUp — In-person networking playbook

Before
Know which cohort window is open. Bring one alumni example from the last 90 days.

In the room
Ask what the operator is trying to change this quarter. Offer the discovery call only after that answer.

After
Log the contact. Send a short note that restates their goal and the call link.

Avoid
Pitching enrollment before listening. Stacking multiple CTAs in one follow-up.`,
    cadenceBody: `PowerUp — Blog topics + social cadence

Week | Theme | Channel
1 | What a cohort is for | LinkedIn
2 | First 90 days, plainly | Blog + email
3 | Alumni note (named change) | Social
4 | Discovery call invite | Email

Cadence notes
One long piece per month. Social points at the piece or the call, not both in the same post.`,
    eventsBody: `PowerUp — Associations & events strategy

Priority rooms
- Operator peer forums
- Regional growth dinners
- Partner-hosted roundtables

Rule
Show up only when the room is operators, not general career seekers.

Field | Value
Owner | Partnerships
Review cycle | Monthly`,
    emailBody: `PowerUp — Email lead generation and nurture

Sequence
1. What PowerUp is (and is not)
2. First 90 days overview
3. Alumni example
4. Book a discovery call

Rules
No long application wall in email. One link. Sound like a peer program.`,
    implBody: `PowerUp — Implementation service items

Item | Status | Owner
Discovery call script | Done | Partnerships
Alumni story bank | In progress | Content
Landing page CTA refresh | Planned | Marketing
Weekly lead hygiene | Ongoing | Ops`,
    trackerBody: `PowerUp — Lead generation and nurture tracker

Lead | Source | Stage | Next step | Owner
Jordan Lee | Roundtable | Discovery | Confirm call | Partnerships
Summit Ops Co. | Referral | Nurture | Send 90-day email | Marketing
Casey Nguyen | LinkedIn | Awareness | Add to sequence | Content`,
  }),
);

const crosscap = itemsFor(
  "crosscap",
  clientFolderSeeds({
    id: "crosscap",
    label: "CrossCap",
    presentationTitle: "CrossCap Final Strategy Presentation.pdf",
    presentationBody: `CrossCap — strategy presentation

Purpose
Build credibility with operators before a capital or advisory conversation.

Core message
Operator outcomes first. Fund jargon last.

Priorities
1. Publish education that helps operators decide, not only pitch decks.
2. Track association and event presence against named accounts.
3. Separate nurture education from a capital ask.

Drafting rule
If a sentence needs a glossary, cut it or define it in plain language in the same line.`,
    playbookBody: `CrossCap — In-person networking playbook

Before
Pull the target account list for the event. Know one operator outcome story.

In the room
Lead with the problem you help operators solve. Do not open with the fund structure.

After
Log the conversation. Send education first; capital ask only after a clear fit signal.

Avoid
Collecting badges without a next step. Treating every handshake as a pipeline win.`,
    cadenceBody: `CrossCap — Blog topics + social cadence

Week | Theme | Channel
1 | Operator outcomes, not jargon | Blog
2 | Association presence this month | LinkedIn
3 | How we evaluate fit | Email
4 | Soft invite to talk | Email + LinkedIn

Cadence notes
One educational piece before any capital CTA in a sequence.`,
    eventsBody: `CrossCap — Associations & events strategy

Priority associations
- Industry operator associations
- Regional capital forums with operator attendance
- Partner dinners with named accounts

Selection rule
Must map to at least two accounts on the current target list.

Field | Value
Owner | Marketing lead
Review cycle | Monthly`,
    emailBody: `CrossCap — Email lead generation and nurture

Sequence
1. Operator outcome story
2. How fit is evaluated
3. Association / event proof
4. Invite to talk with the team

Rules
No term-sheet language in nurture. Keep the ask conversational.`,
    implBody: `CrossCap — Implementation service items

Item | Status | Owner
Target account list refresh | Done | Marketing
Outcome story templates | In progress | Content
Event ROI tracker | Planned | Ops
Nurture sequence QA | Ongoing | Marketing`,
    trackerBody: `CrossCap — Lead generation and nurture tracker

Lead | Source | Stage | Next step | Owner
Harbor Ops LLC | Association | Nurture | Send fit email | Marketing
Blue Ridge Co. | Event | Conversation | Schedule call | Growth
Atlas Retail | Referral | Awareness | Add to sequence | Content`,
  }),
);

const functionPoint = itemsFor(
  "function-point",
  clientFolderSeeds({
    id: "function-point",
    label: "FunctionPoint",
    presentationTitle:
      "Function Point Strategy Presentation Final 8.19.2022.pdf",
    presentationBody: `Function Point — strategy presentation

Purpose
Educate delivery leads on clearer estimation conversations, then invite a product walkthrough.

Core message
Predictability of delivery beats feature lists.

Priorities
1. Keep estimation examples labeled as illustrations.
2. Teach the conversation buyers actually have with stakeholders.
3. Move educated leads into a walkthrough, not a cold demo blast.

Drafting rule
Never invent delivery dates. Never imply a guarantee from an example figure.`,
    playbookBody: `Function Point — In-person networking playbook

Before
Bring one estimation conversation example labeled as an illustration.

In the room
Ask how the team currently defends estimates to stakeholders. Speak to that pain.

After
Send the education piece, then the walkthrough link if they asked for product depth.

Avoid
Feature tours before the problem is named. Absolute claims about schedule certainty.`,
    cadenceBody: `Function Point — Blog topics + social cadence

Week | Theme | Channel
1 | Why estimates fail in stakeholder rooms | Blog
2 | Illustration: reading an estimate | LinkedIn
3 | Predictability vs feature lists | Email
4 | Request a walkthrough | Email

Cadence notes
Every numeric example must say “illustration.” One CTA max per piece.`,
    eventsBody: `Function Point — Associations & events strategy

Priority rooms
- Delivery / PMO communities
- Software leadership roundtables
- Partner webinars with estimation themes

Rule
Skip pure “tool shootout” events unless a named account is attending.

Field | Value
Owner | Content lead
Review cycle | Monthly`,
    emailBody: `Function Point — Email lead generation and nurture

Sequence
1. Why estimates fail with stakeholders
2. Illustration walkthrough (labeled)
3. Predictability vs feature lists
4. Request a product walkthrough

Rules
No guaranteed dates. No invented client metrics.`,
    implBody: `Function Point — Implementation service items

Item | Status | Owner
Illustration library | Done | Content
Walkthrough CTA on blog | In progress | Marketing
PMO community list | Planned | Partnerships
Weekly tracker review | Ongoing | Ops`,
    trackerBody: `Function Point — Lead generation and nurture tracker

Lead | Source | Stage | Next step | Owner
Devon Park | Blog | Nurture | Send illustration | Content
Brightline PMO | Webinar | Walkthrough | Confirm time | Sales
Nova Delivery | LinkedIn | Awareness | Add to sequence | Marketing`,
  }),
);

const pggc = itemsFor(
  "pggc",
  clientFolderSeeds({
    id: "pggc",
    label: "PGGC",
    presentationTitle: "Official PGGC full strategy presentation Sept 2026.pdf",
    presentationBody: `PGGC — strategy presentation (Sept 2026)

Purpose
Full client example covering positioning, networking, content cadence, associations, email nurture, and implementation tracking.

Core message
In-person networking follows a playbook. Content and nurture support named pipeline themes.

Priorities
1. Run the Angel in-person networking playbook consistently.
2. Align blog and social cadence to pipeline themes.
3. Track leads from first touch through a booked conversation.

This folder is the reference shape for other client programs in the demo.`,
    playbookBody: `Angel / PGGC in-person networking playbook

Before the event
Confirm the theme for the night. Bring two questions and one clear next step.

In the room
Listen first. Offer a useful intro or follow-up, not a brochure.

After
Log every meaningful conversation in the lead tracker within one business day.
Send a short follow-up that names the theme you discussed.

Do not
Treat attendance as the win. The win is a logged next step.`,
    cadenceBody: `PGGC blog topics + social media cadence

Week | Theme | Channel
1 | Association landscape this quarter | Blog
2 | Networking playbook tip | LinkedIn
3 | Pipeline theme deep dive | Blog + email
4 | Soft CTA for intro call | Email + LinkedIn

Cadence notes
Two social posts weekly. One long piece monthly. Themes must map to the tracker.`,
    eventsBody: `PGGC_Associations_Events_Strategy

Priority associations / events
- Regional professional associations
- Industry dinners with decision-makers
- Partner-hosted roundtables

Selection criteria
Named accounts present, theme fit, and a follow-up path within seven days.

Field | Value
Owner | Growth lead
Review cycle | Monthly`,
    emailBody: `PGGC_Email_Lead_Generation_and_Nurture_Formatted

Sequence
1. Host-like introduction and what PGGC helps with
2. Networking playbook tip (useful, short)
3. Association / event proof point
4. Book a 20-minute intro call

Formatting
One CTA. Short paragraphs. No attachment dumps in nurture one.`,
    implBody: `PGGC_Implementation_Service_Items

Item | Status | Owner
Playbook distribution | Done | Growth
Cadence calendar live | Done | Content
Association target list | In progress | Partnerships
Tracker weekly hygiene | Ongoing | Ops
Email sequence QA | Planned | Marketing`,
    trackerBody: `PGGC_Lead_Generation_and_Nurture_Tracker

Lead | Source | Stage | Next step | Owner
Sam Ortiz | Association | Nurture | Send playbook tip | Marketing
Helen Cho | Event | Conversation | Book intro call | Growth
Parkside Group | Referral | Awareness | Add to sequence | Content`,
  }),
);

export const driveItems: DriveItem[] = [
  ...wbe,
  ...powerup,
  ...crosscap,
  ...functionPoint,
  ...pggc,
];
