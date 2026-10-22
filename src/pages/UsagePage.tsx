import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { USAGE_DEMO, usageEvents } from "../data/usage";
import { useClients } from "../context/ClientsContext";
import { usePageTitle } from "../usePageTitle";
import { relativeTime } from "../format";
import { DropdownSelect } from "../components/DropdownSelect";
import type { UsageEvent } from "../types";

type Grain = "daily" | "weekly" | "monthly";
type Period = "7d" | "14d" | "30d" | "month" | "all";

const BUDGET = USAGE_DEMO.budget;
const CHART_H = 180;
const CHART_W = 640;
const PAD = { top: 16, right: 16, bottom: 36, left: 40 };

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

export function UsagePage() {
  usePageTitle("Usage & Cost");
  const { clients, getClient } = useClients();
  const [grain, setGrain] = useState<Grain>("daily");
  const [period, setPeriod] = useState<Period>("30d");
  const [clientFilter, setClientFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");

  const providers = useMemo(() => {
    return Array.from(new Set(usageEvents.map((event) => event.provider))).sort();
  }, []);

  const rangeStart = useMemo(() => periodStart(period), [period]);

  const filtered = useMemo(() => {
    return usageEvents.filter((event) => {
      if (clientFilter !== "all" && event.clientId !== clientFilter) return false;
      if (providerFilter !== "all" && event.provider !== providerFilter) {
        return false;
      }
      if (rangeStart && new Date(event.at) < rangeStart) return false;
      return true;
    });
  }, [clientFilter, providerFilter, rangeStart]);

  const totals = useMemo(() => {
    const spend = sumCost(filtered);
    const blogCount = countBlogGenerations(filtered);
    const llm = sumCost(filtered.filter((event) => event.category === "llm"));
    const seo = sumCost(
      filtered.filter(
        (event) => event.category === "seo" || event.category === "research",
      ),
    );
    const avg = blogCount > 0 ? spend / blogCount : spend;
    const budgetPct = Math.min(100, Math.round((spend / BUDGET) * 100));
    return { spend, blogCount, llm, seo, avg, budgetPct };
  }, [filtered]);

  const series = useMemo(
    () => buildStackedSeries(filtered, grain, rangeStart),
    [filtered, grain, rangeStart],
  );
  const maxY = niceMax(Math.max(...series.map((point) => point.llm + point.seo), 1));

  const providerRows = useMemo(() => {
    const llmEvents = filtered.filter((event) => event.category === "llm");
    const seoEvents = filtered.filter(
      (event) => event.category === "seo" || event.category === "research",
    );
    const llmName = groupByProvider(llmEvents)[0]?.provider ?? "Claude";
    const seoName = groupByProvider(seoEvents)[0]?.provider ?? "Semrush";
    return {
      llm: {
        name: llmName,
        tag: "Usage-based",
        requests: llmEvents.reduce((n, event) => n + event.runs, 0),
        inputTokens: Math.round(
          llmEvents.reduce((n, event) => n + (event.tokens ?? 0) * 0.4, 0),
        ),
        outputTokens: Math.round(
          llmEvents.reduce((n, event) => n + (event.tokens ?? 0) * 0.6, 0),
        ),
        cost: sumCost(llmEvents),
      },
      seo: {
        name: seoName,
        tag: "Plan-based",
        requests: seoEvents.reduce((n, event) => n + event.runs, 0),
        units: seoEvents.reduce((n, event) => n + event.runs * 12, 0),
        subscription: Number((sumCost(seoEvents) * 0.55).toFixed(2)),
        cost: sumCost(seoEvents),
      },
    };
  }, [filtered]);

  const perClient = useMemo(() => {
    return clients
      .map((client) => {
        const rows = filtered.filter((event) => event.clientId === client.id);
        return {
          client,
          blogs: countBlogGenerations(rows),
          llm: sumCost(rows.filter((event) => event.category === "llm")),
          seo: sumCost(
            rows.filter(
              (event) =>
                event.category === "seo" || event.category === "research",
            ),
          ),
          cost: sumCost(rows),
        };
      })
      .filter((row) => clientFilter === "all" || row.client.id === clientFilter)
      .sort((a, b) => b.cost - a.cost);
  }, [clients, filtered, clientFilter]);

  const recent = useMemo(() => {
    return [...filtered]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 8);
  }, [filtered]);

  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;

  return (
    <div className="usage-page">
      <header className="usage-hero">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1>Usage &amp; Cost</h1>
          <p className="lede">
            Track your AI and SEO usage, monitor costs, and see what&apos;s being
            used across all clients.
          </p>
        </div>
        <div className="usage-filters">
          <DropdownSelect
            className="field field-inline usage-period-field"
            label="Date range"
            labelHidden
            value={period}
            options={PERIOD_OPTIONS}
            onChange={(value) => setPeriod(value as Period)}
          />
          <DropdownSelect
            className="field field-inline"
            label="Client"
            labelHidden
            value={clientFilter}
            options={[
              { value: "all", label: "All clients" },
              ...clients.map((client) => ({
                value: client.id,
                label: client.name,
              })),
            ]}
            onChange={setClientFilter}
          />
          <DropdownSelect
            className="field field-inline"
            label="Provider"
            labelHidden
            value={providerFilter}
            options={[
              { value: "all", label: "All providers" },
              ...providers.map((provider) => ({
                value: provider,
                label: provider,
              })),
            ]}
            onChange={setProviderFilter}
          />
        </div>
      </header>

      <section className="usage-kpi-grid" aria-label="Cost summary">
        <article className="usage-kpi-card">
          <div className="usage-kpi-top">
            <div>
              <p className="usage-kpi-label">Total provider spend</p>
              <p className="usage-kpi-value">${totals.spend.toFixed(2)}</p>
              <p className="usage-kpi-delta is-down">↓ 12% vs prior period</p>
            </div>
            <span className="usage-kpi-icon tone-purple" aria-hidden>
              $
            </span>
          </div>
          <div className="usage-kpi-footer" aria-hidden />
        </article>
        <article className="usage-kpi-card">
          <div className="usage-kpi-top">
            <div>
              <p className="usage-kpi-label">Blogs generated</p>
              <p className="usage-kpi-value">{totals.blogCount}</p>
              <p className="usage-kpi-delta is-up">↑ 18% vs prior period</p>
            </div>
            <span className="usage-kpi-icon tone-blue" aria-hidden>
              ≡
            </span>
          </div>
          <div className="usage-kpi-footer" aria-hidden />
        </article>
        <article className="usage-kpi-card">
          <div className="usage-kpi-top">
            <div>
              <p className="usage-kpi-label">Average cost per blog</p>
              <p className="usage-kpi-value">${totals.avg.toFixed(2)}</p>
              <p className="usage-kpi-delta is-down">↓ 15% vs prior period</p>
            </div>
            <span className="usage-kpi-icon tone-green" aria-hidden>
              ◎
            </span>
          </div>
          <div className="usage-kpi-footer" aria-hidden />
        </article>
        <article className="usage-kpi-card">
          <div className="usage-kpi-top">
            <div>
              <p className="usage-kpi-label">Monthly budget</p>
              <p className="usage-kpi-value">{totals.budgetPct}%</p>
              <p className="usage-kpi-sub">
                ${totals.spend.toFixed(2)} of ${BUDGET.toFixed(2)}
              </p>
            </div>
            <span className="usage-kpi-icon tone-orange" aria-hidden>
              ⏱
            </span>
          </div>
          <div className="usage-kpi-footer">
            <div className="usage-budget-bar" aria-hidden>
              <span style={{ width: `${totals.budgetPct}%` }} />
            </div>
          </div>
        </article>
      </section>

      <div className="usage-mid-grid">
        <section className="usage-panel">
          <div className="usage-panel-head">
            <h2>Cost over time</h2>
            <div className="seg-control" role="group" aria-label="Time aggregation">
              {(["daily", "weekly", "monthly"] as Grain[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={grain === item ? "seg active" : "seg"}
                  onClick={() => setGrain(item)}
                >
                  {item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="usage-chart-legend">
            <span>
              <i className="swatch llm" /> Claude / AI generation
            </span>
            <span>
              <i className="swatch seo" /> SEO research
            </span>
          </div>
          <div className="usage-chart-wrap">
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              className="usage-stacked-chart"
              role="img"
              aria-label="Stacked cost chart"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                const y = PAD.top + plotH * (1 - tick);
                return (
                  <g key={tick}>
                    <line
                      x1={PAD.left}
                      x2={CHART_W - PAD.right}
                      y1={y}
                      y2={y}
                      stroke="#e8eaef"
                      strokeWidth="1"
                    />
                    <text
                      x={PAD.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="10"
                      fill="#7d8494"
                    >
                      ${Math.round(maxY * tick)}
                    </text>
                  </g>
                );
              })}
              {series.map((point, index) => {
                const slot = plotW / Math.max(series.length, 1);
                const barW = Math.min(28, slot * 0.55);
                const x =
                  PAD.left + slot * index + (slot - barW) / 2;
                const seoH = (point.seo / maxY) * plotH;
                const llmH = (point.llm / maxY) * plotH;
                const baseY = PAD.top + plotH;
                return (
                  <g key={point.label}>
                    <rect
                      x={x}
                      y={baseY - seoH}
                      width={barW}
                      height={Math.max(seoH, 0)}
                      fill="#5aa8a0"
                      rx="3"
                    />
                    <rect
                      x={x}
                      y={baseY - seoH - llmH}
                      width={barW}
                      height={Math.max(llmH, 0)}
                      fill="#6b5f9a"
                      rx="3"
                    />
                    <text
                      x={x + barW / 2}
                      y={CHART_H - 12}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#7d8494"
                    >
                      {formatBucketLabel(point.label, grain)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>

        <section className="usage-panel">
          <div className="usage-panel-head">
            <h2>Provider usage &amp; cost</h2>
          </div>
          <div className="usage-provider-list">
            <article className="usage-provider-card">
              <header>
                <span className="usage-provider-icon llm" aria-hidden>
                  ✦
                </span>
                <div>
                  <h3>{providerRows.llm.name}</h3>
                  <span className="usage-provider-tag">{providerRows.llm.tag}</span>
                </div>
              </header>
              <dl>
                <div>
                  <dt>API requests</dt>
                  <dd>{providerRows.llm.requests}</dd>
                </div>
                <div>
                  <dt>Input tokens</dt>
                  <dd>{formatCompact(providerRows.llm.inputTokens)}</dd>
                </div>
                <div>
                  <dt>Output tokens</dt>
                  <dd>{formatCompact(providerRows.llm.outputTokens)}</dd>
                </div>
                <div>
                  <dt>API cost</dt>
                  <dd>${providerRows.llm.cost.toFixed(2)}</dd>
                </div>
              </dl>
            </article>
            <article className="usage-provider-card">
              <header>
                <span className="usage-provider-icon seo" aria-hidden>
                  ⌕
                </span>
                <div>
                  <h3>{providerRows.seo.name}</h3>
                  <span className="usage-provider-tag">{providerRows.seo.tag}</span>
                </div>
              </header>
              <dl>
                <div>
                  <dt>Research actions</dt>
                  <dd>{providerRows.seo.requests}</dd>
                </div>
                <div>
                  <dt>API units</dt>
                  <dd>{providerRows.seo.units.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Subscription</dt>
                  <dd>${providerRows.seo.subscription.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>Allocated cost</dt>
                  <dd>${providerRows.seo.cost.toFixed(2)}</dd>
                </div>
              </dl>
            </article>
          </div>
        </section>
      </div>

      <section className="usage-panel">
        <div className="usage-panel-head">
          <h2>Per-client breakdown</h2>
        </div>
        <div className="table-wrap">
          <table className="data-table usage-client-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Blogs generated</th>
                <th>AI cost</th>
                <th>SEO cost</th>
                <th>Total cost</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {perClient.map((row) => (
                <tr key={row.client.id}>
                  <td>
                    <Link
                      className="usage-client-cell"
                      to={`/clients/${row.client.id}`}
                    >
                      <span
                        className="usage-client-avatar"
                        style={{ background: row.client.color }}
                        aria-hidden
                      >
                        {row.client.initials}
                      </span>
                      <span>
                        <strong>{row.client.name}</strong>
                        <span className="muted">{row.client.website}</span>
                      </span>
                    </Link>
                  </td>
                  <td>{row.blogs}</td>
                  <td>${row.llm.toFixed(2)}</td>
                  <td>${row.seo.toFixed(2)}</td>
                  <td>
                    <strong>${row.cost.toFixed(2)}</strong>
                  </td>
                  <td className="usage-row-chevron" aria-hidden>
                    ›
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="usage-panel">
        <div className="usage-panel-head">
          <h2>Recent usage activity</h2>
        </div>
        <ul className="usage-activity-list">
          {recent.map((event) => {
            const client = getClient(event.clientId);
            return (
              <li key={event.id}>
                <span
                  className={`usage-activity-icon cat-${event.category}`}
                  aria-hidden
                >
                  {event.category === "llm"
                    ? "≡"
                    : event.category === "seo"
                      ? "⌕"
                      : "◈"}
                </span>
                <div className="usage-activity-copy">
                  <strong>{event.operation}</strong>
                  <span className="muted">
                    {client?.name ?? "Client"} · {event.provider}
                    {event.model ? ` · ${event.model}` : ""}
                  </span>
                </div>
                <time className="muted">{relativeTime(event.at)}</time>
                <span className="usage-activity-cost">
                  ${event.cost.toFixed(2)}
                </span>
              </li>
            );
          })}
        </ul>
        <aside className="usage-demo-note">
          This is a simulated view for demo purposes. In a real setup, costs and
          usage will be fetched from Claude, Semrush, and connected tools.
        </aside>
      </section>
    </div>
  );
}

function sumCost(events: { cost: number }[]): number {
  return events.reduce((n, event) => n + event.cost, 0);
}

function countBlogGenerations(events: UsageEvent[]): number {
  return events
    .filter(
      (event) =>
        event.category === "llm" &&
        /blog generation/i.test(event.operation),
    )
    .reduce((n, event) => n + event.runs, 0);
}

function periodStart(period: Period): Date | null {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === "all") return null;
  if (period === "month") {
    return new Date(start.getFullYear(), start.getMonth(), 1);
  }
  const days = period === "7d" ? 7 : period === "14d" ? 14 : 30;
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function niceMax(value: number): number {
  if (value <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function groupByProvider(events: UsageEvent[]) {
  const map = new Map<string, number>();
  for (const event of events) {
    map.set(event.provider, (map.get(event.provider) ?? 0) + event.cost);
  }
  return [...map.entries()]
    .map(([provider, cost]) => ({ provider, cost }))
    .sort((a, b) => b.cost - a.cost);
}

function buildStackedSeries(
  events: UsageEvent[],
  grain: Grain,
  rangeStart: Date | null,
): { label: string; llm: number; seo: number }[] {
  const buckets = new Map<string, { llm: number; seo: number }>();
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  if (grain === "daily") {
    const start = rangeStart
      ? new Date(rangeStart)
      : new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
    start.setHours(12, 0, 0, 0);
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      buckets.set(bucketKey(d.toISOString(), "daily"), { llm: 0, seo: 0 });
    }
  } else if (grain === "weekly") {
    for (let i = 3; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i * 7);
      buckets.set(bucketKey(d.toISOString(), "weekly"), { llm: 0, seo: 0 });
    }
  } else {
    for (let i = 2; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setMonth(today.getMonth() - i);
      buckets.set(bucketKey(d.toISOString(), "monthly"), { llm: 0, seo: 0 });
    }
  }

  for (const event of events) {
    const key = bucketKey(event.at, grain);
    const current = buckets.get(key) ?? { llm: 0, seo: 0 };
    if (event.category === "llm") current.llm += event.cost;
    else current.seo += event.cost;
    buckets.set(key, current);
  }

  const ordered = [...buckets.entries()].sort(([a], [b]) => {
    if (grain === "weekly") return weekSortKey(a) - weekSortKey(b);
    return a.localeCompare(b);
  });

  const limit =
    grain === "daily" ? Math.min(ordered.length, 10) : grain === "weekly" ? 4 : 3;
  return ordered.slice(-limit).map(([label, costs]) => ({ label, ...costs }));
}

function formatBucketLabel(label: string, grain: Grain): string {
  if (grain === "daily" && /^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const [, month, day] = label.split("-");
    return `${Number(month)}/${Number(day)}`;
  }
  return label;
}

function weekSortKey(label: string): number {
  const match = /^W(\d+)\/(\d+)$/.exec(label);
  if (!match) return 0;
  return Number(match[1]) * 100 + Number(match[2]);
}

function bucketKey(iso: string, grain: Grain): string {
  const d = new Date(iso);
  if (grain === "monthly") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (grain === "weekly") {
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    return `W${start.getMonth() + 1}/${start.getDate()}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
