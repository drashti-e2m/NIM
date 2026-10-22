import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useClients } from "../context/ClientsContext";
import { useBlogs } from "../context/BlogsContext";
import { DeadlineBoardPanel } from "../components/DeadlineBoard";
import { usePageTitle } from "../usePageTitle";

export function DashboardPage() {
  usePageTitle("Home");
  const { clients } = useClients();
  const { blogs } = useBlogs();

  const draftBlogs = blogs.filter(
    (b) => b.status === "draft" || b.status === "in_review",
  );
  const approvedBlogs = blogs.filter((b) => b.status === "approved");

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
        <Link className="kpi-card" to="/library">
          <div className="kpi-top">
            <span className="kpi-ico">▤</span>
            <span className="kpi-label">Total Blogs</span>
          </div>
          <strong className="kpi-value">{blogs.length}</strong>
          <span className="kpi-trend">All generated drafts</span>
        </Link>
        <Link className="kpi-card" to="/library?status=progress">
          <div className="kpi-top">
            <span className="kpi-ico">◷</span>
            <span className="kpi-label">Drafts in Progress</span>
          </div>
          <strong className="kpi-value">{draftBlogs.length}</strong>
          <span className="kpi-trend">
            {blogs.filter((b) => b.status === "in_review").length} in review
          </span>
        </Link>
        <Link className="kpi-card" to="/library?status=approved">
          <div className="kpi-top">
            <span className="kpi-ico">✓</span>
            <span className="kpi-label">Approved</span>
          </div>
          <strong className="kpi-value">{approvedBlogs.length}</strong>
          <span className="kpi-trend">Ready to publish</span>
        </Link>
        <Link className="kpi-card" to="/clients">
          <div className="kpi-top">
            <span className="kpi-ico">◎</span>
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
