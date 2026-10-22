import type { UsageEvent } from "../types";

/** Demo targets shown on Usage & Cost when all filters are clear. */
export const USAGE_DEMO = {
  budget: 300,
  totalSpend: 42.8,
  blogsGenerated: 48,
  avgCostPerBlog: 0.89,
  claudeCost: 29.6,
  semrushCost: 13.2,
  claudeRequests: 132,
  semrushActions: 180,
} as const;

const CLIENTS = [
  "wbe",
  "powerup",
  "crosscap",
  "function-point",
  "pggc",
] as const;

function daysAgo(n: number, hour = 11): string {
  const d = new Date();
  d.setHours(hour, 15, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build Claude + Semrush events that sum exactly to USAGE_DEMO targets,
 * spread across clients and the last 8 days for chart realism.
 */
function buildUsageEvents(): UsageEvent[] {
  const events: UsageEvent[] = [];
  let id = 0;
  const nextId = (prefix: string) => `${prefix}-${++id}`;

  // Daily Claude cost weights (sum → 29.60) and blog-generation runs (sum → 48)
  const claudeDays = [
    { day: 0, cost: 4.2, blogs: 7, other: 12 },
    { day: 1, cost: 3.8, blogs: 6, other: 11 },
    { day: 2, cost: 4.5, blogs: 8, other: 10 },
    { day: 3, cost: 2.9, blogs: 5, other: 9 },
    { day: 4, cost: 3.6, blogs: 6, other: 11 },
    { day: 5, cost: 2.4, blogs: 4, other: 10 },
    { day: 6, cost: 4.1, blogs: 6, other: 11 },
    { day: 7, cost: 4.1, blogs: 6, other: 10 },
  ];
  // blogs 7+6+8+5+6+4+6+6 = 48; other 12+11+10+9+11+10+11+10 = 84; total requests 132

  for (const row of claudeDays) {
    const client = CLIENTS[row.day % CLIENTS.length];
    const blogCost = round2(row.cost * 0.72);
    const otherCost = round2(row.cost - blogCost);
    const blogTokens = row.blogs * 2800;
    const otherTokens = row.other * 900;

    events.push({
      id: nextId("u-claude-blog"),
      clientId: client,
      category: "llm",
      provider: "Claude",
      model: "claude-sonnet",
      operation: "Blog generation",
      runs: row.blogs,
      cost: blogCost,
      tokens: blogTokens,
      at: daysAgo(row.day, 10),
    });

    events.push({
      id: nextId("u-claude-other"),
      clientId: client,
      category: "llm",
      provider: "Claude",
      model: "claude-sonnet",
      operation: row.day % 2 === 0 ? "Outline generation" : "Draft revision",
      runs: row.other,
      cost: otherCost,
      tokens: otherTokens,
      at: daysAgo(row.day, 16),
    });
  }

  // Daily Semrush cost weights (sum → 13.20) and research actions (sum → 180)
  const semrushDays = [
    { day: 0, cost: 1.8, runs: 24 },
    { day: 1, cost: 1.5, runs: 22 },
    { day: 2, cost: 2.1, runs: 28 },
    { day: 3, cost: 1.2, runs: 18 },
    { day: 4, cost: 1.8, runs: 25 },
    { day: 5, cost: 1.4, runs: 20 },
    { day: 6, cost: 1.7, runs: 22 },
    { day: 7, cost: 1.7, runs: 21 },
  ];
  // runs 24+22+28+18+25+20+22+21 = 180

  for (const row of semrushDays) {
    const client = CLIENTS[(row.day + 2) % CLIENTS.length];
    const researchRuns = Math.round(row.runs * 0.35);
    const seoRuns = row.runs - researchRuns;
    const researchCost = round2(row.cost * 0.35);
    const seoCost = round2(row.cost - researchCost);

    events.push({
      id: nextId("u-semrush-seo"),
      clientId: client,
      category: "seo",
      provider: "Semrush",
      model: "keyword-overview",
      operation: "Keyword research",
      runs: seoRuns,
      cost: seoCost,
      at: daysAgo(row.day, 12),
    });

    events.push({
      id: nextId("u-semrush-research"),
      clientId: client,
      category: "research",
      provider: "Semrush",
      model: "topic-research",
      operation: "Source pack",
      runs: researchRuns,
      cost: researchCost,
      at: daysAgo(row.day, 14),
    });
  }

  // Correct any float drift so provider totals match targets exactly.
  const claudeEvents = events.filter((e) => e.provider === "Claude");
  const semrushEvents = events.filter((e) => e.provider === "Semrush");
  const claudeSum = claudeEvents.reduce((n, e) => n + e.cost, 0);
  const semrushSum = semrushEvents.reduce((n, e) => n + e.cost, 0);
  claudeEvents[0].cost = round2(
    claudeEvents[0].cost + (USAGE_DEMO.claudeCost - claudeSum),
  );
  semrushEvents[0].cost = round2(
    semrushEvents[0].cost + (USAGE_DEMO.semrushCost - semrushSum),
  );

  return events;
}

export const usageEvents: UsageEvent[] = buildUsageEvents();
