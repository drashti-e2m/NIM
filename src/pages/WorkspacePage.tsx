import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useClients } from "../context/ClientsContext";
import {
  countFiles,
  drivePath,
  getDriveItem,
  listChildren,
  parentFolderName,
  searchDrive,
  removeDriveFile,
  uploadDriveFile,
} from "../services/drive";
import { useDrafts } from "../context/DraftsContext";
import { useBlogs } from "../context/BlogsContext";
import { useTones } from "../context/TonesContext";
import { usePageTitle } from "../usePageTitle";
import { formatDate, relativeTime, wordCount } from "../format";
import { statusLabel } from "../labels";
import type { DraftStatus, DriveItem, DriveKind } from "../types";
import { DemoBadge, EmptyState, FileGlyph, SearchField } from "../components/ui";
import { FilePreviewBody } from "../components/FilePreviewBody";
import { DropdownSelect } from "../components/DropdownSelect";
import { STUDIO_SYNC_EVENT } from "../services/sharedStore";

const kindLabels: Record<DriveKind, string> = {
  folder: "Folder",
  doc: "Document",
  sheet: "Spreadsheet",
  pdf: "PDF",
  image: "Image",
};

type WorkspaceTab = "drafts" | "files";
type ContentType = "blog" | "email" | "draft";

type WorkspaceItem = {
  id: string;
  type: ContentType;
  title: string;
  body: string;
  status: DraftStatus;
  updatedAt: string;
  href: string;
  toneLabel: string;
  words: number;
};

type DraftSort = "newest" | "oldest" | "title";

export function WorkspacePage() {
  const { clientId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const { getClient, setLastClientId } = useClients();
  const client = getClient(clientId);

  useEffect(() => {
    if (clientId) setLastClientId(clientId);
  }, [clientId, setLastClientId]);
  usePageTitle(client ? client.name : "Client");

  const { drafts, updateDraft, deleteDraft } = useDrafts();
  const { blogs, updateBlog, deleteBlog } = useBlogs();
  const { getTone } = useTones();

  const tab: WorkspaceTab =
    params.get("tab") === "drafts" ? "drafts" : "files";
  const draftQuery = params.get("dq") ?? "";
  const statusFilter = params.get("status") ?? "all";
  const draftSort = (params.get("dsort") as DraftSort | null) ?? "newest";

  const [folderId, setFolderId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fileQuery, setFileQuery] = useState("");
  const [driveTick, setDriveTick] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFolderId(null);
    setSelectedId(null);
    setFileQuery("");
    setUploadMessage(null);
  }, [clientId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onSync = () => setDriveTick((n) => n + 1);
    window.addEventListener(STUDIO_SYNC_EVENT, onSync);
    return () => window.removeEventListener(STUDIO_SYNC_EVENT, onSync);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedId]);

  const clientItems = useMemo<WorkspaceItem[]>(() => {
    const preferredTone =
      getTone(client?.preferredToneId ?? "")?.name ??
      getTone("authoritative-plain")?.name ??
      "Authoritative & Plain-Spoken";

    const blogItems: WorkspaceItem[] = blogs
      .filter((blog) => blog.clientId === clientId)
      .map((blog) => {
        const tone =
          getTone(blog.toneId)?.name?.trim() ||
          blog.toneName?.trim() ||
          preferredTone;
        const bodyWords = wordCount(blog.body);
        return {
          id: `blog-${blog.id}`,
          type: "blog" as const,
          title: blog.title,
          body: blog.body,
          status: blog.status,
          updatedAt: blog.updatedAt,
          href: `/clients/${blog.clientId}/blog/${blog.id}`,
          toneLabel: tone,
          words: bodyWords > 0 ? bodyWords : blog.targetWords || 0,
        };
      });
    const draftItems: WorkspaceItem[] = drafts
      .filter((draft) => draft.clientId === clientId)
      .map((draft) => ({
        id: `draft-${draft.id}`,
        type: "draft" as const,
        title: draft.title,
        body: draft.body,
        status: draft.status,
        updatedAt: draft.updatedAt,
        href: `/library/${draft.id}`,
        toneLabel: preferredTone,
        words: wordCount(draft.body),
      }));
    return [...blogItems, ...draftItems];
  }, [blogs, drafts, clientId, client?.preferredToneId, getTone]);

  const statusCounts = useMemo(() => {
    let draft = 0;
    let inReview = 0;
    let approved = 0;
    for (const item of clientItems) {
      if (item.status === "draft") draft += 1;
      else if (item.status === "in_review") inReview += 1;
      else if (item.status === "approved") approved += 1;
    }
    return { draft, inReview, approved };
  }, [clientItems]);

  const visibleDrafts = useMemo(() => {
    const needle = draftQuery.trim().toLowerCase();
    const filtered = clientItems.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!needle) return true;
      return `${item.title} ${item.body}`.toLowerCase().includes(needle);
    });
    const sorted = [...filtered];
    if (draftSort === "oldest") {
      sorted.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    } else if (draftSort === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return sorted;
  }, [clientItems, draftQuery, statusFilter, draftSort]);

  const fileCount = useMemo(
    () => (clientId ? countFiles(clientId) : 0),
    [clientId, driveTick],
  );

  const searching = fileQuery.trim().length > 0;
  const fileItems = useMemo(() => {
    if (!client) return [];
    return searching
      ? searchDrive(client.id, fileQuery)
      : listChildren(client.id, folderId);
  }, [client, searching, fileQuery, folderId, driveTick]);

  const folder = folderId ? getDriveItem(folderId) : undefined;
  const crumbs =
    folder && folder.clientId === clientId ? drivePath(folder.id) : [];
  const selected = selectedId ? getDriveItem(selectedId) : undefined;
  const preview =
    selected && selected.clientId === clientId && selected.kind !== "folder"
      ? selected
      : undefined;

  function setTab(next: WorkspaceTab) {
    const nextParams = new URLSearchParams(params);
    if (next === "files") nextParams.delete("tab");
    else nextParams.set("tab", next);
    setParams(nextParams, { replace: true });
  }

  function setDraftParam(key: string, value: string) {
    const nextParams = new URLSearchParams(params);
    const clearDefault =
      !value ||
      (key === "status" && value === "all") ||
      (key === "dsort" && value === "newest") ||
      (key === "dq" && value === "");
    if (clearDefault) nextParams.delete(key);
    else nextParams.set(key, value);
    setParams(nextParams, { replace: true });
  }


  function setItemStatus(item: WorkspaceItem, next: DraftStatus) {
    if (item.type === "blog") {
      updateBlog(item.id.replace(/^blog-/, ""), { status: next });
      return;
    }
    updateDraft(item.id.replace(/^draft-/, ""), { status: next });
  }

  function handleDeleteItem(item: WorkspaceItem) {
    const ok = window.confirm(
      `Delete “${item.title}”? This cannot be undone.`,
    );
    if (!ok) return;
    if (item.type === "blog") {
      deleteBlog(item.id.replace(/^blog-/, ""));
      return;
    }
    deleteDraft(item.id.replace(/^draft-/, ""));
  }

  function openItem(item: DriveItem) {
    if (item.kind === "folder") {
      setFolderId(item.id);
      setFileQuery("");
      setSelectedId(null);
      return;
    }
    setSelectedId(item.id);
  }

  async function handleUpload(fileList: FileList | null) {
    if (!client || !fileList || fileList.length === 0) return;
    setUploading(true);
    setUploadMessage(null);
    try {
      let lastId: string | null = null;
      for (const file of Array.from(fileList)) {
        const saved = await uploadDriveFile({
          file,
          clientId: client.id,
          parentId: searching ? null : folderId,
        });
        lastId = saved.id;
      }
      setDriveTick((tick) => tick + 1);
      if (lastId) setSelectedId(lastId);
      setUploadMessage(
        fileList.length === 1
          ? `Saved “${fileList[0].name}” to Drive.`
          : `Saved ${fileList.length} files to Drive.`,
      );
    } catch {
      setUploadMessage("Upload failed. Try another file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleRemoveFile() {
    const target = preview && preview.kind !== "folder" ? preview : null;
    if (!target) {
      setUploadMessage("Select a file first, then remove it.");
      return;
    }
    const ok = window.confirm(`Remove “${target.name}” from this client’s files?`);
    if (!ok) return;
    const removed = removeDriveFile(target.id);
    if (!removed) {
      setUploadMessage("Could not remove that file.");
      return;
    }
    setSelectedId(null);
    setDriveTick((tick) => tick + 1);
    setUploadMessage(`Removed “${target.name}”.`);
  }

  if (!client) {
    return (
      <EmptyState
        title="Client not found"
        body="Return to the hub and choose a client workspace."
        action={
          <Link className="btn btn-primary" to="/clients">
            Back to Client Hub
          </Link>
        }
      />
    );
  }

  const typeLabel: Record<ContentType, string> = {
    blog: "Blog",
    email: "Email",
    draft: "Draft",
  };

  const websiteHref = client.website.startsWith("http")
    ? client.website
    : `https://${client.website}`;

  return (
    <div className="workspace">
      <Link className="workspace-back" to="/clients">
        ← Back to Client Hub
      </Link>

      <header className="workspace-hero">
        <div className="workspace-identity">
          <span
            className="workspace-mark"
            style={{ background: client.color }}
            aria-hidden
          >
            {client.initials}
          </span>
          <div className="workspace-identity-copy">
            <p className="workspace-kicker">Client workspace</p>
            <h1>{client.name}</h1>
            <a
              className="workspace-site-link"
              href={websiteHref}
              target="_blank"
              rel="noreferrer"
            >
              {client.website}
              <span aria-hidden> ↗</span>
            </a>
          </div>
        </div>
        <div className="workspace-actions">
          <Link
            className="btn btn-primary"
            to={`/clients/${client.id}/generate`}
          >
            <span aria-hidden>✧</span>
            Generate Blog
          </Link>
          <Link
            className="btn btn-secondary"
            to={`/clients/${client.id}/email`}
          >
            <span aria-hidden>✉</span>
            Generate Email
          </Link>
        </div>
      </header>

      <section className="workspace-status-bar" aria-label="Status summary">
        <div className="workspace-stat">
          <i className="stat-dot draft" aria-hidden />
          <strong>{statusCounts.draft}</strong>
          <span>Draft</span>
        </div>
        <div className="workspace-stat">
          <i className="stat-dot review" aria-hidden />
          <strong>{statusCounts.inReview}</strong>
          <span>In Review</span>
        </div>
        <div className="workspace-stat">
          <i className="stat-dot published" aria-hidden />
          <strong>{statusCounts.approved}</strong>
          <span>Approved</span>
        </div>
      </section>

      <div className="workspace-tabs" role="tablist" aria-label="Workspace">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "files"}
          className={tab === "files" ? "workspace-tab active" : "workspace-tab"}
          onClick={() => setTab("files")}
        >
          Files {fileCount}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "drafts"}
          className={tab === "drafts" ? "workspace-tab active" : "workspace-tab"}
          onClick={() => setTab("drafts")}
        >
          Drafts {clientItems.length}
        </button>
      </div>

      {tab === "drafts" ? (
        <section className="workspace-panel" aria-label="Client drafts">
          <div className="workspace-panel-head">
            <div className="workspace-panel-title">
              <h2>Client drafts</h2>
            </div>
            <div className="workspace-panel-tools drafts-tools">
              <SearchField
                label="Search drafts"
                value={draftQuery}
                onChange={(value) => setDraftParam("dq", value)}
                placeholder="Search drafts"
              />
              <DropdownSelect
                className="field field-inline drafts-tool-select drafts-sort-select"
                label="Sort"
                labelHidden
                triggerLabel="Sort"
                leading={
                  <svg
                    className="drafts-tool-icon"
                    viewBox="0 0 24 24"
                    width={16}
                    height={16}
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M8 5v14M8 5l-3 3M8 5l3 3M16 19V5M16 19l-3-3M16 19l3-3"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
                value={draftSort}
                options={[
                  { value: "newest", label: "Newest first" },
                  { value: "oldest", label: "Oldest first" },
                  { value: "title", label: "Title A–Z" },
                ]}
                onChange={(next) => setDraftParam("dsort", next)}
              />
              <DropdownSelect
                className="field field-inline drafts-tool-select drafts-filter-select"
                label="Filter"
                labelHidden
                triggerLabel="Filter"
                leading={
                  <svg
                    className="drafts-tool-icon"
                    viewBox="0 0 24 24"
                    width={16}
                    height={16}
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M4 5.5h16l-5.8 6.7c-.3.35-.45.55-.45.9v4.4L10.25 19V13.1c0-.35-.15-.55-.45-.9L4 5.5Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </svg>
                }
                value={statusFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "draft", label: "Draft" },
                  { value: "in_review", label: "In Review" },
                  { value: "approved", label: "Approved" },
                ]}
                onChange={(next) => setDraftParam("status", next)}
              />
            </div>
          </div>

          {visibleDrafts.length === 0 ? (
            <EmptyState
              title="No drafts yet"
              body="Generate a blog for this client, or clear filters to see existing work."
              action={
                <Link
                  className="btn btn-primary"
                  to={`/clients/${client.id}/generate`}
                >
                  Generate Blog
                </Link>
              }
            />
          ) : (
            <ul className="draft-list workspace-draft-list">
              {visibleDrafts.map((item) => (
                <li key={item.id} className="draft-row workspace-draft-row">
                  <div className="draft-main">
                    <Link to={item.href} className="draft-title-link">
                      <strong className="draft-title">{item.title}</strong>
                    </Link>
                    <span className="draft-voice muted">
                      {item.toneLabel}
                      {item.words > 0
                        ? ` | ${item.words.toLocaleString()} words`
                        : ""}
                    </span>
                    <span className="draft-meta">
                      <span className={`type-pill type-${item.type}`}>
                        {typeLabel[item.type]}
                      </span>
                      <span className="muted">
                        Updated {relativeTime(item.updatedAt)}
                      </span>
                    </span>
                  </div>
                  <div className="workspace-draft-actions">
                    <DropdownSelect
                      className="field field-inline status-edit workspace-status-edit"
                      label="Status"
                      labelHidden
                      value={item.status}
                      selectClassName={`status-select status-${item.status}`}
                      options={[
                        { value: "draft", label: `• ${statusLabel("draft")}` },
                        {
                          value: "in_review",
                          label: `• ${statusLabel("in_review")}`,
                        },
                        {
                          value: "approved",
                          label: `• ${statusLabel("approved")}`,
                        },
                      ]}
                      onChange={(next) =>
                        setItemStatus(item, next as DraftStatus)
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-ghost workspace-draft-delete"
                      aria-label={`Delete ${item.title}`}
                      title="Delete"
                      onClick={() => handleDeleteItem(item)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="workspace-panel" aria-label="Client files">
          <div className="workspace-panel-head">
            <div className="workspace-panel-title">
              <h2>Client files</h2>
              <DemoBadge>Simulated Drive</DemoBadge>
            </div>
            <div className="workspace-panel-tools">
              <SearchField
                label="Search files"
                value={fileQuery}
                onChange={setFileQuery}
                placeholder="Search files and folders"
              />
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                multiple
                accept=".pdf,.doc,.docx,.txt,.md,.csv,.tsv,.xlsx,.xls,.sheet,text/*,image/*"
                onChange={(event) => void handleUpload(event.target.files)}
              />
              <button
                type="button"
                className="btn btn-primary"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <span aria-hidden>↑</span>
                {uploading ? "Saving…" : "Upload file"}
              </button>
            </div>
          </div>

          <nav className="drive-crumbs" aria-label="Folders">
            <button
              type="button"
              onClick={() => {
                setFolderId(null);
                setFileQuery("");
              }}
              disabled={!folderId && !searching}
            >
              All files
            </button>
            {searching ? <span>Search results</span> : null}
            {!searching
              ? crumbs.map((crumb) => (
                  <button
                    key={crumb.id}
                    type="button"
                    onClick={() => setFolderId(crumb.id)}
                  >
                    {crumb.name}
                  </button>
                ))
              : null}
          </nav>

          {uploadMessage ? (
            <p className="drive-upload-msg">{uploadMessage}</p>
          ) : null}

          <div className={preview ? "file-layout has-preview" : "file-layout"}>
            {fileItems.length === 0 ? (
              <EmptyState
                title="Nothing matches"
                body="Try another file name, upload a file, or clear the search to see this client’s Drive."
              />
            ) : (
              <ul className="file-grid file-grid-workspace">
                {fileItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={
                        preview?.id === item.id
                          ? "file-tile selected"
                          : "file-tile"
                      }
                      onClick={() => openItem(item)}
                    >
                      <span className="file-tile-top">
                        <FileGlyph kind={item.kind} />
                        <span className="file-tile-menu" aria-hidden>
                          ⋮
                        </span>
                      </span>
                      <span className="file-name">{item.name}</span>
                      <span className="file-meta">
                        {kindLabels[item.kind]}
                        {item.detail ? ` · ${item.detail}` : ""}
                        {searching && parentFolderName(item)
                          ? ` · ${parentFolderName(item)}`
                          : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {preview ? (
              <article
                ref={previewRef}
                className="preview"
                aria-label="File preview"
              >
                <div className="preview-head">
                  <DemoBadge>Simulated file</DemoBadge>
                  <div className="preview-head-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleRemoveFile}
                    >
                      Remove file
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setSelectedId(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
                <p className="eyebrow">{kindLabels[preview.kind]}</p>
                <h2>{preview.name}</h2>
                <p className="muted">
                  Updated {formatDate(preview.updatedAt)}
                  {preview.detail ? ` · ${preview.detail}` : ""} · {client.name}
                </p>
                <FilePreviewBody kind={preview.kind} body={preview.body} />
              </article>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
