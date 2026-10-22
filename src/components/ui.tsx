import type { ReactNode } from "react";
import type { DraftStatus, DriveKind } from "../types";

export function DemoBadge({ children }: { children: ReactNode }) {
  return <span className="badge badge-demo">{children}</span>;
}

export function StatusBadge({ status }: { status: DraftStatus }) {
  const label =
    status === "in_review" ? "In Review" : status === "approved" ? "Approved" : "Draft";
  return <span className={`badge status status-${status}`}>{label}</span>;
}

export function SearchField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search">
      <span className="sr-only">{label}</span>
      <SearchIcon />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      />
    </label>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function FileGlyph({ kind }: { kind: DriveKind }) {
  if (kind === "folder") return <FolderIcon />;
  if (kind === "sheet") return <SheetIcon />;
  if (kind === "pdf") return <PdfIcon />;
  if (kind === "image") return <ImageIcon />;
  return <DocIcon />;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16.5 20 20.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon icon-folder">
      <path
        d="M3.5 7.5h6l1.6-2H20.5v13h-17v-11z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon icon-doc">
      <path
        d="M7 3.5h7l4 4V20.5H7v-17z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3.8V8h4.2M9 12h6M9 15.5h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SheetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon icon-sheet">
      <rect x="4" y="3.5" width="16" height="17" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 9h16M4 14h16M10 9v11.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon icon-pdf">
      <path
        d="M7 3.5h7l4 4V20.5H7v-17z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.2 16.8v-4.2h1.5a1.4 1.4 0 0 1 0 2.8H9.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon icon-image">
      <rect
        x="3.5"
        y="5"
        width="17"
        height="14"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path
        d="M5.5 16.5 9.2 12.8l2.4 2.3 3-3.4 3.9 4.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
