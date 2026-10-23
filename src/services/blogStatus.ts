import type { ArticlePhase, DraftStatus } from "../types";

/** Keep articlePhase aligned whenever status changes (global consistency). */
export function articlePhaseForStatus(status: DraftStatus): ArticlePhase {
  if (status === "approved") return "approved";
  if (status === "in_review") return "in_review";
  return "draft";
}

export function blogStatusPatch(status: DraftStatus): {
  status: DraftStatus;
  articlePhase: ArticlePhase;
} {
  return {
    status,
    articlePhase: articlePhaseForStatus(status),
  };
}
