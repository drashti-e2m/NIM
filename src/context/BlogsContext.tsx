import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ApprovedOutline,
  ArticleSectionContent,
  ArticleVersion,
  BlogPost,
  BlogPostInput,
  DraftStatus,
} from "../types";
import {
  readBlogs,
  readRemovedBlogIds,
  writeBlogs,
  writeRemovedBlogIds,
} from "../services/storage";
import { STUDIO_SYNC_EVENT } from "../services/sharedStore";
import {
  logBlogCreated,
  logBlogDeleted,
  logBlogUpdated,
  seedActivityFromBlogs,
} from "../services/activityLog";
import { sectionsToBody } from "../services/blogGenerate";
import { withCalendarSeeds } from "../data/calendarSeed";
import { localDateKey } from "../services/calendar";

type BlogPatch = Partial<
  Omit<BlogPost, "id" | "createdAt" | "updatedAt">
>;

interface BlogsApi {
  blogs: BlogPost[];
  getBlog: (id: string) => BlogPost | undefined;
  addBlog: (input: BlogPostInput) => BlogPost;
  /** Insert or replace by stable id. */
  upsertBlog: (blog: BlogPost) => BlogPost;
  updateBlog: (id: string, patch: BlogPatch, options?: { snapshot?: boolean; snapshotLabel?: string }) => BlogPost | undefined;
  saveArticleContent: (input: {
    id: string;
    title: string;
    body: string;
    sections?: ArticleSectionContent[];
    seoTitle?: string;
    seoMeta?: string;
    status?: DraftStatus;
    expectedToken?: number;
    snapshot?: boolean;
    snapshotLabel?: string;
    markReviewOutdated?: boolean;
  }) => BlogPost | undefined;
  approveOutlineForArticle: (
    id: string,
    outline: ApprovedOutline,
  ) => BlogPost | undefined;
  deleteBlog: (id: string) => boolean;
  blogsForClient: (clientId: string) => BlogPost[];
}

const BlogsContext = createContext<BlogsApi | null>(null);

function snapshotFrom(blog: BlogPost, label: string): ArticleVersion {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    label,
    title: blog.title,
    body: blog.body,
    sections: blog.sections ?? [],
    seoTitle: blog.seoTitle,
    seoMeta: blog.seoMeta,
  };
}

export function BlogsProvider({ children }: { children: ReactNode }) {
  const [blogs, setBlogs] = useState<BlogPost[]>(() =>
    withCalendarSeeds(readBlogs()),
  );

  useEffect(() => {
    writeBlogs(blogs);
  }, [blogs]);

  useEffect(() => {
    seedActivityFromBlogs(blogs);
    // Only seed once from the initial blog list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onSync = () => setBlogs(withCalendarSeeds(readBlogs()));
    window.addEventListener(STUDIO_SYNC_EVENT, onSync);
    return () => window.removeEventListener(STUDIO_SYNC_EVENT, onSync);
  }, []);

  // Re-anchor calendar seeds when the local date rolls over (Due today moves daily).
  useEffect(() => {
    let dayKey = localDateKey();
    function refreshIfDayChanged() {
      const next = localDateKey();
      if (next === dayKey) return;
      dayKey = next;
      setBlogs((current) => withCalendarSeeds(current));
    }
    const intervalId = window.setInterval(refreshIfDayChanged, 60_000);
    window.addEventListener("focus", refreshIfDayChanged);
    document.addEventListener("visibilitychange", refreshIfDayChanged);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshIfDayChanged);
      document.removeEventListener("visibilitychange", refreshIfDayChanged);
    };
  }, []);

  const api = useMemo<BlogsApi>(
    () => ({
      blogs,
      getBlog(id) {
        return blogs.find((blog) => blog.id === id);
      },
      blogsForClient(clientId) {
        return blogs.filter((blog) => blog.clientId === clientId);
      },
      addBlog(input) {
        const now = new Date().toISOString();
        const blog: BlogPost = {
          ...input,
          targetAudience: input.targetAudience || "B2B buyers",
          primaryKeyword: input.primaryKeyword || input.keywords[0] || "",
          secondaryKeywords:
            input.secondaryKeywords ?? input.keywords.slice(1),
          approvedOutline: input.approvedOutline ?? null,
          sections: input.sections ?? [],
          lede: input.lede ?? "",
          closing: input.closing ?? "",
          versions: input.versions ?? [],
          articlePhase: input.articlePhase ?? "outline",
          generationToken: input.generationToken ?? 0,
          outlineDirtyAfterDraft: input.outlineDirtyAfterDraft ?? false,
          calendarDate: input.calendarDate ?? now,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        };
        setBlogs((current) => [blog, ...current]);
        logBlogCreated(blog);
        return blog;
      },
      upsertBlog(blog) {
        const now = new Date().toISOString();
        const next: BlogPost = {
          ...blog,
          updatedAt: now,
        };
        setBlogs((current) => {
          const exists = current.some((item) => item.id === blog.id);
          if (exists) {
            const prev = current.find((item) => item.id === blog.id);
            const merged = { ...next, createdAt: prev?.createdAt ?? next.createdAt };
            if (prev) logBlogUpdated(prev, merged);
            return current.map((item) =>
              item.id === blog.id ? merged : item,
            );
          }
          const created = { ...next, createdAt: blog.createdAt || now };
          logBlogCreated(created);
          return [created, ...current];
        });
        return next;
      },
      updateBlog(id, patch, options) {
        let updated: BlogPost | undefined;
        let previous: BlogPost | undefined;
        let nextList: BlogPost[] = [];
        setBlogs((current) => {
          nextList = current.map((blog) => {
            if (blog.id !== id) return blog;
            previous = blog;
            const next: BlogPost = {
              ...blog,
              ...patch,
              updatedAt: new Date().toISOString(),
              generationToken:
                typeof patch.generationToken === "number"
                  ? patch.generationToken
                  : blog.generationToken + (options?.snapshot ? 1 : 0),
            };
            if (options?.snapshot) {
              next.versions = [
                snapshotFrom(blog, options.snapshotLabel ?? "Autosave"),
                ...(blog.versions ?? []),
              ].slice(0, 20);
            }
            updated = next;
            return next;
          });
          // Persist immediately so Review (and reloads) see the latest draft.
          writeBlogs(nextList);
          return nextList;
        });
        if (previous && updated) {
          logBlogUpdated(previous, updated, options);
        }
        return updated;
      },
      saveArticleContent(input) {
        let updated: BlogPost | undefined;
        let previous: BlogPost | undefined;
        setBlogs((current) =>
          current.map((blog) => {
            if (blog.id !== input.id) return blog;
            if (
              typeof input.expectedToken === "number" &&
              input.expectedToken < blog.generationToken
            ) {
              // Stale write - keep newer article
              updated = blog;
              return blog;
            }
            previous = blog;
            const sections =
              input.sections ??
              blog.sections ??
              [];
            const body =
              input.body ||
              (sections.length ? sectionsToBody(sections) : blog.body);
            const next: BlogPost = {
              ...blog,
              title: input.title.trim() || blog.title,
              body,
              sections,
              seoTitle: input.seoTitle ?? blog.seoTitle,
              seoMeta: input.seoMeta ?? blog.seoMeta,
              status: input.status ?? blog.status,
              updatedAt: new Date().toISOString(),
              generationToken: blog.generationToken + 1,
              articlePhase: input.markReviewOutdated
                ? "review_outdated"
                : blog.articlePhase === "outline" ||
                    blog.articlePhase === "outline_approved"
                  ? "draft"
                  : blog.articlePhase === "in_review" ||
                      blog.articlePhase === "approved"
                    ? "review_outdated"
                    : blog.articlePhase,
            };
            if (input.snapshot !== false) {
              next.versions = [
                snapshotFrom(blog, input.snapshotLabel ?? "Saved draft"),
                ...(blog.versions ?? []),
              ].slice(0, 20);
            }
            updated = next;
            return next;
          }),
        );
        if (previous && updated && updated !== previous) {
          logBlogUpdated(previous, updated, {
            snapshot: input.snapshot !== false,
            snapshotLabel: input.snapshotLabel ?? "Saved draft",
          });
        }
        return updated;
      },
      approveOutlineForArticle(id, outline) {
        let updated: BlogPost | undefined;
        let previous: BlogPost | undefined;
        setBlogs((current) =>
          current.map((blog) => {
            if (blog.id !== id) return blog;
            previous = blog;
            const hadDraft = Boolean(blog.body?.trim() || blog.sections?.length);
            const approved: ApprovedOutline = {
              ...outline,
              approved: true,
              approvedAt: new Date().toISOString(),
            };
            updated = {
              ...blog,
              title: approved.title || blog.title,
              approvedOutline: approved,
              outline: [
                `Outline - ${approved.title}`,
                `Introduction: ${approved.introductionPurpose}`,
                "",
                ...approved.sections.flatMap((section, index) => [
                  `${index + 1}. ${section.heading}`,
                  ...section.keyPoints.map((point) => `   - ${point}`),
                  "",
                ]),
                `Conclusion: ${approved.conclusionPurpose}`,
                `CTA: ${approved.cta}`,
              ].join("\n"),
              articlePhase: "outline_approved",
              outlineDirtyAfterDraft: hadDraft,
              updatedAt: new Date().toISOString(),
              generationToken: blog.generationToken + 1,
            };
            return updated;
          }),
        );
        if (previous && updated) {
          logBlogUpdated(previous, updated);
        }
        return updated;
      },
      deleteBlog(id) {
        const existing = blogs.find((blog) => blog.id === id);
        if (!existing) return false;
        setBlogs((current) => current.filter((blog) => blog.id !== id));
        const removed = new Set(readRemovedBlogIds());
        removed.add(id);
        writeRemovedBlogIds([...removed]);
        logBlogDeleted(existing);
        return true;
      },
    }),
    [blogs],
  );

  return <BlogsContext.Provider value={api}>{children}</BlogsContext.Provider>;
}

export function useBlogs(): BlogsApi {
  const value = useContext(BlogsContext);
  if (!value) throw new Error("useBlogs must be used within BlogsProvider");
  return value;
}
