import { useEffect, useMemo, useState, type FormEvent } from "react";
import { NavLink, Outlet, useLocation, Link, useNavigate } from "react-router-dom";
import { useClients } from "../context/ClientsContext";
import { useBlogs } from "../context/BlogsContext";
import {
  scheduleSharedPush,
  STUDIO_SYNC_EVENT,
} from "../services/sharedStore";

const COLLAPSE_KEY = "nim.sidebar.collapsed.v3";

export function AppShell() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_KEY);
      // Expanded by default so renamed sidebar labels are visible
      if (saved === null) return false;
      return saved === "1";
    } catch {
      return false;
    }
  });
  const [dashboardOpen, setDashboardOpen] = useState(true);
  const [blogOpen, setBlogOpen] = useState(true);
  const [query, setQuery] = useState("");
  const { clients } = useClients();
  const { blogs } = useBlogs();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const onBlog =
    /^\/clients\/[^/]+\/blog\/[^/]+/.test(location.pathname) &&
    !location.pathname.endsWith("/edit");

  const dashboardActive = useMemo(
    () =>
      location.pathname === "/" ||
      location.pathname.startsWith("/clients") ||
      location.pathname.startsWith("/calendar") ||
      location.pathname.startsWith("/activity") ||
      location.pathname.startsWith("/tones") ||
      location.pathname.startsWith("/usage"),
    [location.pathname],
  );

  const blogActive = useMemo(
    () => location.pathname.startsWith("/library"),
    [location.pathname],
  );

  const onEmail = /\/clients\/[^/]+\/email/.test(location.pathname);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (dashboardActive) setDashboardOpen(true);
  }, [dashboardActive]);

  useEffect(() => {
    if (blogActive) setBlogOpen(true);
  }, [blogActive]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
      scheduleSharedPush();
    } catch {
      // ignore
    }
  }, [collapsed]);

  useEffect(() => {
    const onSync = () => {
      try {
        const saved = localStorage.getItem(COLLAPSE_KEY);
        if (saved === null) return;
        setCollapsed(saved === "1");
      } catch {
        // ignore
      }
    };
    window.addEventListener(STUDIO_SYNC_EVENT, onSync);
    return () => window.removeEventListener(STUDIO_SYNC_EVENT, onSync);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const field = document.getElementById("side-search-input");
        if (field instanceof HTMLInputElement) {
          field.focus();
          setCollapsed(false);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function runSearch(event: FormEvent) {
    event.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const blogHit = blogs.find(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.keywords.some((k) => k.toLowerCase().includes(q)),
    );
    if (blogHit) {
      navigate(`/clients/${blogHit.clientId}/blog/${blogHit.id}`);
      return;
    }
    const clientHit = clients.find(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.website.toLowerCase().includes(q),
    );
    if (clientHit) {
      navigate(`/clients/${clientHit.id}`);
      return;
    }
    navigate(`/library?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div
      className={[
        "shell studio-shell shell-light",
        collapsed ? "sidebar-collapsed" : "",
        onBlog ? "studio-blog" : "",
        onEmail ? "studio-email" : "",
        isHome ? "shell-home" : "",
        mobileOpen ? "mobile-nav-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      {mobileOpen ? (
        <button
          className="backdrop"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={mobileOpen ? "sidebar open" : "sidebar"}
        aria-label="Primary navigation"
      >
        <div className="side-top">
          <Link to="/" className="brand" title="NIM Studio">
            <img
              className="brand-mark"
              src="/nim-logo.png"
              alt="New Initiatives Marketing"
              width={40}
              height={40}
            />
            <span className="brand-text">
              <span className="brand-name">NIM Studio</span>
              <span className="brand-sub">Content workspace</span>
            </span>
          </Link>

          <button
            type="button"
            className="side-collapse-btn"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
              <path
                d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <form className="side-search" onSubmit={runSearch} role="search">
          <span className="side-search-ico" aria-hidden>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
              <path d="M16.2 16.2 20 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          <input
            id="side-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search clients, articles, or keywords"
          />
          <span className="side-search-keys" aria-hidden>
            <kbd>⌘</kbd>
            <kbd>K</kbd>
          </span>
        </form>

        <nav id="primary-nav" className="side-nav" aria-label="Primary">
          <div className={`side-group${dashboardActive ? " active-group" : ""}`}>
            <button
              type="button"
              className={`side-link side-parent${dashboardActive ? " active" : ""}`}
              aria-expanded={dashboardOpen}
              title="Dashboard"
              onClick={() => {
                if (collapsed) {
                  navigate("/");
                  return;
                }
                setDashboardOpen((value) => !value);
              }}
            >
              <NavIcon name="home" />
              <span className="side-link-text">Dashboard</span>
              <span className={`side-chevron${dashboardOpen ? " open" : ""}`} aria-hidden>
                ▾
              </span>
            </button>

            {dashboardOpen || collapsed ? (
              <div className="side-tree" role="group" aria-label="Dashboard">
                <NavLink to="/" end className={treeClass} title="Overview">
                  <span className="tree-dot" aria-hidden />
                  Overview
                </NavLink>
                <NavLink to="/clients" className={treeClass} title="Clients">
                  <span className="tree-dot" aria-hidden />
                  Clients
                </NavLink>
                <NavLink to="/calendar" className={treeClass} title="Calendar">
                  <span className="tree-dot" aria-hidden />
                  Calendar
                </NavLink>
                <NavLink to="/activity" className={treeClass} title="Activity">
                  <span className="tree-dot" aria-hidden />
                  Activity
                </NavLink>
                <NavLink to="/tones" className={treeClass} title="Voice & Tone">
                  <span className="tree-dot" aria-hidden />
                  Voice &amp; Tone
                </NavLink>
                <NavLink to="/usage" className={treeClass} title="Usage & Cost">
                  <span className="tree-dot" aria-hidden />
                  Usage &amp; Cost
                </NavLink>
              </div>
            ) : null}
          </div>

          <div className={`side-group${blogActive ? " active-group" : ""}`}>
            <button
              type="button"
              className={`side-link side-parent${blogActive ? " active" : ""}`}
              aria-expanded={blogOpen}
              title="Blog content"
              onClick={() => {
                if (collapsed) {
                  navigate("/library");
                  return;
                }
                setBlogOpen((value) => !value);
              }}
            >
              <NavIcon name="drafts" />
              <span className="side-link-text">Blog content</span>
              <span className={`side-chevron${blogOpen ? " open" : ""}`} aria-hidden>
                ▾
              </span>
            </button>

            {blogOpen || collapsed ? (
              <div className="side-tree" role="group" aria-label="Blog content">
                <NavLink to="/library" className={treeClass} title="All Blogs">
                  <span className="tree-dot" aria-hidden />
                  All Blogs
                </NavLink>
              </div>
            ) : null}
          </div>

        </nav>

        <div className="side-profile-card">
          <span className="side-profile-avatar" aria-hidden>
            DB
          </span>
          <span className="side-profile-meta">
            <strong>Demo User</strong>
            <em>NIM EDITOR</em>
          </span>
          <span className="side-profile-status" aria-label="Online" />
        </div>
      </aside>

      <div className="main">
        <button
          className="menu-btn menu-btn-float"
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="primary-nav"
          onClick={() => setMobileOpen((value) => !value)}
        >
          Menu
        </button>

        <div
          id="content"
          className={onBlog || onEmail ? "page page-flush" : "page"}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function treeClass({ isActive }: { isActive: boolean }) {
  return isActive ? "side-tree-link active" : "side-tree-link";
}

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: "M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z",
    clients:
      "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM4 20a8 8 0 0 1 16 0",
    calendar:
      "M7 3v2M17 3v2M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
    drafts:
      "M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm7 0v5h5",
    library: "M4 4h5v16H4V4zm7 0h9v16h-9V4z",
    settings:
      "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm9 3.5-.8 2.2 1.5 1.9-1.8 1.8-2.1-1.1L15.6 18l-1.2 2.2H9.6L8.4 18l-2.2 1.1-1.8-1.8 1.5-1.9L5 12l.9-2.2-1.5-1.9 1.8-1.8 2.1 1.1L9.6 5l1.2-2.2h3.4L15.4 5l2.2-1.1 1.8 1.8-1.5 1.9L19 12z",
  };
  return (
    <svg className="nav-ico" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d={paths[name] ?? paths.home}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
