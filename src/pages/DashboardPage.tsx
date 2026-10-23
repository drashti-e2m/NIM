import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useClients } from "../context/ClientsContext";
import { useBlogs } from "../context/BlogsContext";
import { DeadlineBoardPanel } from "../components/DeadlineBoard";
import { usePageTitle } from "../usePageTitle";
import { statusLabel } from "../labels";

export function DashboardPage() {
  usePageTitle("Home");
  const { clients } = useClients();
  const { blogs } = useBlogs();

  const draftCount = blogs.filter((b) => b.status === "draft").length;
  const inReviewCount = blogs.filter((b) => b.status === "in_review").length;
  const approvedCount = blogs.filter((b) => b.status === "approved").length;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <div className="dash">
      <header className="dash-head">
        <div className="dash-intro">
          <div className="dash-top-row">
            <p className="dash-crumbs">Home / Dashboard</p>
            <div className="dash-account">
              <span className="user-avatar-wrap" title="Studio demo · online">
                <span className="user-avatar" aria-hidden>
                  DB
                </span>
                <span className="user-status" aria-label="Online" />
              </span>
            </div>
          </div>
          <div className="dash-title-row">
            <h1>{greeting}</h1>
          </div>
        </div>
      </header>

      <section className="dash-kpis" aria-label="Key metrics">
        <Link className="kpi-card" to="/library?status=draft">
          <div className="kpi-top">
            <span className="kpi-ico">✎</span>
            <span className="kpi-label">{statusLabel("draft")}</span>
          </div>
          <strong className="kpi-value">{draftCount}</strong>
          <span className="kpi-trend">{blogs.length} total blogs</span>
        </Link>
        <Link className="kpi-card" to="/library?status=in_review">
          <div className="kpi-top">
            <span className="kpi-ico">◷</span>
            <span className="kpi-label">{statusLabel("in_review")}</span>
          </div>
          <strong className="kpi-value">{inReviewCount}</strong>
          <span className="kpi-trend">Awaiting review</span>
        </Link>
        <Link className="kpi-card" to="/library?status=approved">
          <div className="kpi-top">
            <span className="kpi-ico">✓</span>
            <span className="kpi-label">{statusLabel("approved")}</span>
          </div>
          <strong className="kpi-value">{approvedCount}</strong>
          <span className="kpi-trend">Ready for handoff</span>
        </Link>
        <Link className="kpi-card" to="/clients">
          <div className="kpi-top">
            <span className="kpi-ico" aria-hidden>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
                <circle
                  cx="9"
                  cy="8"
                  r="3.25"
                  stroke="currentColor"
                  strokeWidth="1.75"
                />
                <circle
                  cx="17"
                  cy="9.25"
                  r="2.5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                />
                <path
                  d="M3.75 18.5c.7-2.85 2.9-4.25 5.25-4.25s4.55 1.4 5.25 4.25"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
                <path
                  d="M14.2 14.5c1.35-.55 2.95-.45 4.55.55 1.1.7 1.85 1.75 2.1 3.45"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="kpi-label">Clients</span>
          </div>
          <strong className="kpi-value">{clients.length}</strong>
          <span className="kpi-trend">
            <span className="dot-live" /> All active
          </span>
        </Link>
      </section>

      <section className="dash-card deadline-board-wrap">
        <DeadlineBoardPanel blogs={blogs} clients={clients} />
      </section>
    </div>
  );
}
