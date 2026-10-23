import type { BlogPost } from "../types";
import type { ActivityItem } from "../types";
import { isCalendarStub } from "./blogCalendarSync";
import { statusLabel } from "../labels";

export type WizardStepId =
  | "topic"
  | "keywords"
  | "research"
  | "outline"
  | "blog";

/** Which Generate wizard step to open so the user can continue. */
export function resumeStepForBlog(blog: BlogPost): WizardStepId {
  if (
    (blog.sections && blog.sections.length > 0) ||
    (blog.body && blog.body.trim().length > 200)
  ) {
    return "blog";
  }
  if (blog.approvedOutline || blog.outline?.trim()) return "outline";
  if (blog.research?.trim()) return "research";
  if (blog.primaryKeyword?.trim() || (blog.keywords?.length ?? 0) > 0) {
    return "keywords";
  }
  return "topic";
}

function isInProgressBlog(blog: BlogPost): boolean {
  if (blog.status === "approved" || blog.status === "in_review") return false;
  if (blog.articlePhase === "approved" || blog.articlePhase === "in_review") {
    return false;
  }
  const step = resumeStepForBlog(blog);
  return step !== "blog" || blog.articlePhase === "outline" || blog.articlePhase === "outline_approved";
}

/**
 * Status shown on Activity: Pin created / Pin moved / Draft / In Review /
 * Approved / in-progress wizard labels.
 */
export function activityStatusForBlog(
  blog: BlogPost,
  latestEvent?: ActivityItem | null,
): string {
  // Public status is always driven by blog.status so Calendar / Library /
  // Workspace / Review stay in sync.
  if (blog.status === "approved") return "Approved";
  if (blog.status === "in_review") return "In Review";

  const step = resumeStepForBlog(blog);
  const stub = isCalendarStub(blog) && step === "topic" && !blog.research?.trim();

  if (stub) {
    const eventAction = latestEvent?.action ?? "";
    if (eventAction.startsWith("Pin moved")) return "Pin moved";
    return "Pin created";
  }

  if (isInProgressBlog(blog)) {
    if (step === "outline") return "Outline in progress";
    if (step === "research") return "Research in progress";
    if (step === "keywords") return "Keywords in progress";
    if (step === "topic") return "Draft in progress";
  }

  const eventAction = latestEvent?.action ?? "";
  if (eventAction.startsWith("Pin moved")) return "Pin moved";

  return statusLabel(blog.status);
}

/** Deep link to resume writing or open review. */
export function resumeHrefForBlog(blog: BlogPost): string {
  const clientId = blog.clientId;
  if (
    blog.status === "approved" ||
    blog.status === "in_review" ||
    blog.articlePhase === "approved" ||
    blog.articlePhase === "in_review"
  ) {
    return `/clients/${clientId}/blog/${blog.id}`;
  }
  const step = resumeStepForBlog(blog);
  return `/clients/${clientId}/generate?article=${blog.id}&step=${step}`;
}

export function resumeHrefForActivity(
  item: ActivityItem,
  liveBlog: BlogPost | undefined,
): string | null {
  if (!item.clientId || !item.blogId) return null;
  if (
    item.action === "Pin deleted" ||
    item.action === "Deleted article" ||
    !liveBlog
  ) {
    return `/clients/${item.clientId}?tab=drafts`;
  }
  return resumeHrefForBlog(liveBlog);
}
