import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useClients } from "../context/ClientsContext";
import { useBlogs } from "../context/BlogsContext";
import { usePageTitle } from "../usePageTitle";
import {
  blogContentWordCount,
  formatDate,
  looksLikeHtml,
  stripHtml,
} from "../format";
import { sectionsToBody } from "../services/blogGenerate";
import { getDriveItem } from "../services/drive";
import type { DraftStatus } from "../types";
import { EmptyState, StatusBadge } from "../components/ui";
import { blogStatusPatch } from "../services/blogStatus";

function paragraphsFromBody(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((part) => part.replace(/^•\s*/gm, "").trim())
    .filter(Boolean);
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

function RichHtml({
  html,
  className,
  as: Tag = "div",
}: {
  html: string;
  className?: string;
  as?: "div" | "h2" | "p" | "section";
}) {
  if (!html.trim()) return null;
  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}

function BodyBlock({
  html,
  className,
  lead,
}: {
  html: string;
  className?: string;
  lead?: boolean;
}) {
  if (!html.trim()) return null;
  if (looksLikeHtml(html)) {
    return (
      <RichHtml
        html={html}
        className={[className, lead ? "blog-post-lede-lead-html" : ""]
          .filter(Boolean)
          .join(" ")}
      />
    );
  }
  const paras = paragraphsFromBody(html);
  if (paras.length === 0) return null;
  return (
    <div className={className}>
      {paras.map((para, index) => (
        <p
          key={`${para.slice(0, 32)}-${index}`}
          className={lead && index === 0 ? "blog-post-lede-lead" : undefined}
        >
          {para}
        </p>
      ))}
    </div>
  );
}

export function BlogReaderPage() {
  const { clientId = "", blogId = "" } = useParams();
  const navigate = useNavigate();
  const { getClient, setLastClientId } = useClients();
  const { getBlog, updateBlog, deleteBlog } = useBlogs();
  const client = getClient(clientId);
  const blog = getBlog(blogId);
  const matched = blog && blog.clientId === clientId ? blog : undefined;
  usePageTitle(matched ? `Review · ${matched.title}` : "Review");

  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (clientId) setLastClientId(clientId);
  }, [clientId, setLastClientId]);

  useEffect(() => {
    if (!matched) return;
    if (
      (matched.articlePhase === "draft" ||
        matched.articlePhase === "review_outdated") &&
      matched.status === "draft"
    ) {
      updateBlog(matched.id, blogStatusPatch("in_review"));
    }
    // Intentionally only when opening this article id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched?.id]);

  const displayBody = useMemo(() => {
    if (!matched) return "";
    if (matched.sections?.length) {
      return [
        matched.lede?.trim() || "",
        sectionsToBody(matched.sections),
        matched.closing?.trim() || "",
        matched.approvedOutline?.cta?.trim() || "",
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    return matched.body;
  }, [matched]);

  const words = useMemo(
    () => (matched ? blogContentWordCount(matched) : 0),
    [matched],
  );

  const readMinutes = Math.max(1, Math.round(words / 220));

  if (!client || !matched) {
    return (
      <EmptyState
        title="Article not found"
        body="Return to the client workspace and open a saved article. Review never generates a new draft."
        action={
          <Link className="btn btn-primary" to={client ? `/clients/${client.id}` : "/clients"}>
            Back
          </Link>
        }
      />
    );
  }

  const activeClient = client;
  const activeBlog = matched;
  const sections =
    activeBlog.sections?.length > 0
      ? [...activeBlog.sections].sort((a, b) => a.order - b.order)
      : null;
  const lede = activeBlog.lede?.trim() || "";
  const closing = activeBlog.closing?.trim() || "";
  const cta = activeBlog.approvedOutline?.cta?.trim() || "";
  const coverItem = activeBlog.featuredImageId
    ? getDriveItem(activeBlog.featuredImageId)
    : undefined;
  const coverSrc =
    coverItem?.kind === "image" && coverItem.body?.startsWith("data:image")
      ? coverItem.body
      : undefined;

  function setStatus(status: DraftStatus) {
    updateBlog(activeBlog.id, blogStatusPatch(status));
  }

  function handleDelete() {
    const ok = window.confirm(
      `Delete “${activeBlog.title}”? This cannot be undone.`,
    );
    if (!ok) return;
    deleteBlog(activeBlog.id);
    navigate(`/clients/${activeClient.id}?tab=drafts`, { replace: true });
  }

  function exportExact() {
    const plain = stripHtml(displayBody);
    const blob = new Blob([plain], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeBlog.title.replace(/\s+/g, "-").toLowerCase() || "article"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Exported the same text shown in review.");
  }

  return (
    <div className="blog-review">
      <div className="blog-review-bar">
        <div className="blog-review-bar-copy">
          <span className="blog-review-kicker">Review</span>
        </div>
        <div className="article-toolbar-actions">
          <Link
            className="btn btn-secondary btn-sm review-action-btn"
            to={`/clients/${activeClient.id}/generate?article=${activeBlog.id}&step=blog`}
          >
            Edit
          </Link>
          <button
            type="button"
            className="btn btn-secondary btn-sm review-action-btn"
            onClick={exportExact}
          >
            Export
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm review-action-btn"
            onClick={handleDelete}
          >
            Delete
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm review-action-btn"
            onClick={() => setStatus("approved")}
          >
            Approve
          </button>
        </div>
      </div>

      {notice ? <p className="drive-upload-msg blog-review-notice">{notice}</p> : null}

      <div className="blog-review-stage">
        <article className="blog-post" id="article-top">
          <header className="blog-post-masthead">
            <p className="blog-post-eyebrow">{activeClient.name}</p>
            <h1 className="blog-post-title">{activeBlog.title}</h1>
            <div className="blog-post-byline">
              <span>{formatDate(activeBlog.updatedAt)}</span>
              <span aria-hidden>·</span>
              <span>
                {words.toLocaleString()} words · {readMinutes} min read
              </span>
              <StatusBadge status={activeBlog.status} />
            </div>
          </header>

          {coverSrc ? (
            <figure className="blog-post-cover">
              <img src={coverSrc} alt={coverItem?.name || "Cover image"} />
              {coverItem?.name ? (
                <figcaption>{coverItem.name}</figcaption>
              ) : null}
            </figure>
          ) : null}

          <BodyBlock html={lede} className="blog-post-lede" lead />

          <div className="blog-post-body">
            {sections ? (
              sections.map((section) => (
                <section key={section.sectionId} className="blog-post-section">
                  {looksLikeHtml(section.heading) ? (
                    <RichHtml html={section.heading} className="blog-post-h2" as="h2" />
                  ) : (
                    <h2>{section.heading}</h2>
                  )}
                  <BodyBlock html={section.body} />
                </section>
              ))
            ) : (
              <BodyBlock html={displayBody} />
            )}
          </div>

          {(closing || cta) && (
            <footer className="blog-post-footer">
              <BodyBlock html={closing} />
              {cta ? (
                <div className="blog-post-cta">
                  <span className="blog-post-cta-label">Next step</span>
                  {looksLikeHtml(cta) ? (
                    <RichHtml html={cta} />
                  ) : (
                    <span>{stripHtml(cta)}</span>
                  )}
                </div>
              ) : null}
            </footer>
          )}
        </article>
      </div>
    </div>
  );
}
