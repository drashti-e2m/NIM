export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** Relative label like “2 days ago” / “just now”. */
export function relativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(iso);
}

/** Strip tags so HTML draft fields still count as readable words. */
export function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(text: string): number {
  const trimmed = stripHtml(text);
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value.trim());
}

/** Plain text used for draft / review word counts - keep both pages on this. */
export function articlePlainText(parts: {
  title?: string;
  lede?: string;
  sections?: Array<{ heading: string; body: string }>;
  body?: string;
  closing?: string;
  cta?: string;
}): string {
  const chunks: string[] = [];
  const push = (value?: string) => {
    const next = stripHtml(value ?? "");
    if (next) chunks.push(next);
  };
  push(parts.title);
  push(parts.lede);
  if (parts.sections && parts.sections.length > 0) {
    for (const section of parts.sections) {
      push(section.heading);
      push(section.body);
    }
  } else {
    push(parts.body);
  }
  push(parts.closing);
  push(parts.cta);
  return chunks.join("\n\n");
}

/** Actual article word count — same basis as Review (lede + sections + closing). */
export function blogContentWordCount(blog: {
  title?: string;
  lede?: string;
  body?: string;
  closing?: string;
  sections?: Array<{ order: number; heading: string; body: string }>;
  approvedOutline?: { cta?: string } | null;
  targetWords?: number;
}): number {
  const sorted = blog.sections?.length
    ? [...blog.sections].sort((a, b) => a.order - b.order)
    : undefined;
  const count = wordCount(
    articlePlainText({
      title: blog.title,
      lede: blog.lede,
      sections: sorted,
      body: blog.body,
      closing: blog.closing,
      cta: blog.approvedOutline?.cta,
    }),
  );
  return count > 0 ? count : blog.targetWords || 0;
}

export function excerpt(text: string, max = 140): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max).trimEnd()}…`;
}
