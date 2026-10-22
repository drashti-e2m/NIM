import type { Stage, TopicSuggestion } from "../types";

const bank: Record<string, Record<Stage, Omit<TopicSuggestion, "id">[]>> = {
  wbe: {
    awareness: [
      {
        title: "What certification actually unlocks in a buyer room",
        angle:
          "Certification is proof for a conversation, not a slogan for a brochure.",
      },
      {
        title: "Why volume networking fails certified suppliers",
        angle:
          "Category fit beats collecting badges. The useful intro follows the category.",
      },
      {
        title: "A plain note on supplier diversity fatigue",
        angle:
          "Buyers have heard the pitch. They need a clear category and a next step.",
      },
      {
        title: "What members wish they knew before the first forum",
        angle:
          "Bring a one-line intro and a question. Leave with a logged follow-up.",
      },
    ],
    consideration: [
      {
        title: "How WBE prioritizes introductions",
        angle:
          "Show the rule: category fit first, then the room, then the follow-up.",
      },
      {
        title: "Quarterly sessions versus one-off mixers",
        angle:
          "A returning session gives members a reason to re-engage without a hard sell.",
      },
      {
        title: "Member story: the first useful introduction",
        angle:
          "Keep the story specific to category and outcome, not a generic win.",
      },
      {
        title: "What to prepare before a buyer forum",
        angle:
          "Certification status, category line, and one question — nothing more.",
      },
    ],
    decision: [
      {
        title: "Reserve a seat at the next WBE session",
        angle:
          "The ask is one seat, with the category focus named up front.",
      },
      {
        title: "Bring a colleague who needs the same room",
        angle:
          "A second seat only works if the category fit is real.",
      },
      {
        title: "Log your next introduction this week",
        angle:
          "The close is a tracked follow-up, not another badge photo.",
      },
      {
        title: "Ask for a category-fit introduction",
        angle:
          "Make the request specific enough that the team can act on it.",
      },
    ],
  },
  powerup: {
    awareness: [
      {
        title: "What a growth cohort is actually for",
        angle:
          "Operators need peers and coaching, not another course library.",
      },
      {
        title: "The first 90 days, without the transformation speech",
        angle:
          "Name what changes early. Leave the vague promise out.",
      },
      {
        title: "Why operators stop trusting leadership funnels",
        angle:
          "Long applications and soft claims burn trust. Discovery should be short.",
      },
      {
        title: "A peer note on showing up ready to speak",
        angle:
          "Cohorts stay useful when the room is small enough for real talk.",
      },
    ],
    consideration: [
      {
        title: "PowerUp versus a solo advisory retainer",
        angle:
          "Compare peer learning and coaching against one-to-one advice alone.",
      },
      {
        title: "How enrollment actually works",
        angle:
          "A discovery call first. No application wall in the middle of the story.",
      },
      {
        title: "Alumni note: what shifted in 90 days",
        angle:
          "Keep the proof specific to an operator outcome.",
      },
      {
        title: "Who PowerUp is not for",
        angle:
          "Say the fit clearly so the wrong reader can leave early.",
      },
    ],
    decision: [
      {
        title: "Book a PowerUp discovery call",
        angle:
          "The next step is a short call, not a form marathon.",
      },
      {
        title: "Join the next open cohort window",
        angle:
          "Name the window. Keep the ask singular.",
      },
      {
        title: "Bring your operating question to the call",
        angle:
          "The useful prep is one question about this quarter.",
      },
      {
        title: "Talk with partnerships about fit",
        angle:
          "If unsure, the call is the filter — say that plainly.",
      },
    ],
  },
  crosscap: {
    awareness: [
      {
        title: "Operator outcomes beat fund jargon",
        angle:
          "Readers decide whether you understand their business before they care about structure.",
      },
      {
        title: "Why capital conversations start too late",
        angle:
          "Education should arrive before the ask, while operators still have room to think.",
      },
      {
        title: "What association presence is actually for",
        angle:
          "Presence matters when it maps to named accounts, not attendance trophies.",
      },
      {
        title: "A calm read on advisory versus capital",
        angle:
          "Separate the help from the check so the reader can place you.",
      },
    ],
    consideration: [
      {
        title: "How CrossCap evaluates fit",
        angle:
          "Show the criteria in plain language operators can reuse internally.",
      },
      {
        title: "Association proof without the name-drop parade",
        angle:
          "One relevant room and a follow-up path beat a long logo list.",
      },
      {
        title: "Education sequence before a capital ask",
        angle:
          "Put the teaching emails first. Keep the ask for the end.",
      },
      {
        title: "Questions operators should ask any partner",
        angle:
          "Give them a short list that works even if they do not choose CrossCap.",
      },
    ],
    decision: [
      {
        title: "Talk with the CrossCap team",
        angle:
          "The ask is a conversation, not a term sheet in the inbox.",
      },
      {
        title: "Bring your operating question to the intro",
        angle:
          "Useful prep is the problem, not a polished deck.",
      },
      {
        title: "Request a fit conversation this month",
        angle:
          "Keep timing concrete without fake urgency.",
      },
      {
        title: "Share the education pack with your partner",
        angle:
          "A forwardable note helps an internal champion.",
      },
    ],
  },
  "function-point": {
    awareness: [
      {
        title: "Why estimates fail in stakeholder rooms",
        angle:
          "The breakdown is usually the conversation, not the spreadsheet.",
      },
      {
        title: "Predictability versus another feature list",
        angle:
          "Delivery leads care whether the plan holds, not how many modules you named.",
      },
      {
        title: "A labeled illustration of reading an estimate",
        angle:
          "Show the example, mark it as an illustration, and stop before promising dates.",
      },
      {
        title: "What buyers wish vendors would stop saying",
        angle:
          "Absolute certainty and vague AI claims both lose the room.",
      },
    ],
    consideration: [
      {
        title: "Function Point for delivery conversations",
        angle:
          "Place the product next to the stakeholder talk, not a feature matrix.",
      },
      {
        title: "How teams defend estimates without theater",
        angle:
          "Give a process buyers can recognize from their last tough review.",
      },
      {
        title: "Walkthrough versus a cold demo",
        angle:
          "Education first, then a product walkthrough when they ask for depth.",
      },
      {
        title: "What an illustration is allowed to claim",
        angle:
          "Spell the boundary so drafts stay safe.",
      },
    ],
    decision: [
      {
        title: "Request a Function Point walkthrough",
        angle:
          "The CTA follows education, not a cold blast.",
      },
      {
        title: "Bring one live estimate question to the call",
        angle:
          "Useful prep is a real stakeholder question.",
      },
      {
        title: "Share the illustration with your delivery lead",
        angle:
          "A forwardable example helps an internal champion.",
      },
      {
        title: "Start with a short product walkthrough",
        angle:
          "Keep the ask small and specific.",
      },
    ],
  },
  pggc: {
    awareness: [
      {
        title: "What a networking playbook changes in the room",
        angle:
          "Attendance is not the win. A logged next step is.",
      },
      {
        title: "Association presence with a follow-up path",
        angle:
          "Show up only when the theme and the accounts line up.",
      },
      {
        title: "Content cadence that maps to pipeline themes",
        angle:
          "Blog and social should support named themes, not random posting.",
      },
      {
        title: "A host-like note on first touches",
        angle:
          "Sound like someone who can open a useful intro, not a blast.",
      },
    ],
    consideration: [
      {
        title: "How PGGC runs the growth program in practice",
        angle:
          "Playbook, cadence, associations, nurture, and trackers as one system.",
      },
      {
        title: "Email nurture without the attachment dump",
        angle:
          "One CTA, short paragraphs, education before the ask.",
      },
      {
        title: "Which events are worth the calendar",
        angle:
          "Named accounts, theme fit, and a seven-day follow-up path.",
      },
      {
        title: "What the lead tracker is for",
        angle:
          "First touch through a booked conversation — nothing fuzzier.",
      },
    ],
    decision: [
      {
        title: "Book a 20-minute intro call",
        angle:
          "The ask is short and concrete.",
      },
      {
        title: "Bring your association question to the call",
        angle:
          "Useful prep is the room you care about this quarter.",
      },
      {
        title: "Request the networking playbook follow-up",
        angle:
          "Offer the useful artifact, then the conversation.",
      },
      {
        title: "Start nurture with the current pipeline theme",
        angle:
          "Pick one theme and run it cleanly.",
      },
    ],
  },
};

export function topicsFor(clientId: string, stage: Stage): TopicSuggestion[] {
  const rows = bank[clientId]?.[stage] ?? [];
  return rows.map((topic, index) => ({
    ...topic,
    id: `${clientId}-${stage}-${index + 1}`,
  }));
}
