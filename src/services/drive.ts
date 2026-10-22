import { driveItems } from "../data/files";
import type { DriveItem, DriveKind } from "../types";
import {
  readDriveUploads,
  readRemovedDriveIds,
  writeDriveUploads,
  writeRemovedDriveIds,
} from "./storage";

function allDriveItems(): DriveItem[] {
  const removed = new Set(readRemovedDriveIds());
  return [...driveItems, ...readDriveUploads()].filter(
    (item) => !removed.has(item.id),
  );
}

export function listChildren(
  clientId: string,
  parentId: string | null,
): DriveItem[] {
  return allDriveItems()
    .filter((item) => item.clientId === clientId && item.parentId === parentId)
    .sort(sortItems);
}

export function getDriveItem(id: string): DriveItem | undefined {
  return allDriveItems().find((item) => item.id === id);
}

export function searchDrive(clientId: string, query: string): DriveItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return allDriveItems()
    .filter((item) => item.clientId === clientId)
    .filter((item) => {
      const haystack = `${item.name} ${item.body ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    })
    .sort(sortItems);
}

export function drivePath(itemId: string): DriveItem[] {
  const path: DriveItem[] = [];
  let current = getDriveItem(itemId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? getDriveItem(current.parentId) : undefined;
  }
  return path;
}

export function countFiles(clientId: string): number {
  return allDriveItems().filter(
    (item) => item.clientId === clientId && item.kind !== "folder",
  ).length;
}

/** All non-folder Drive files for a client (root + nested). */
export function listClientFiles(clientId: string): DriveItem[] {
  return allDriveItems()
    .filter((item) => item.clientId === clientId && item.kind !== "folder")
    .sort(sortItems);
}

export function parentFolderName(item: DriveItem): string | null {
  if (!item.parentId) return null;
  return getDriveItem(item.parentId)?.name ?? null;
}

export async function uploadDriveFile(input: {
  file: File;
  clientId: string;
  parentId: string | null;
}): Promise<DriveItem> {
  const kind = kindFromName(input.file.name);
  const body = await readFileBody(input.file, kind);
  const today = new Date().toISOString().slice(0, 10);
  const item: DriveItem = {
    id: `upload-${crypto.randomUUID()}`,
    clientId: input.clientId,
    parentId: input.parentId,
    name: input.file.name,
    kind,
    updatedAt: today,
    detail:
      kind === "sheet"
        ? "Uploaded sheet"
        : kind === "pdf"
          ? "Uploaded PDF"
          : kind === "image"
            ? "Uploaded image"
            : "Uploaded file",
    body,
  };
  const next = [...readDriveUploads(), item];
  writeDriveUploads(next);
  return item;
}

/** Remove an uploaded file, or hide a seed file for this browser. */
export function removeDriveFile(id: string): boolean {
  const uploads = readDriveUploads();
  if (uploads.some((item) => item.id === id)) {
    writeDriveUploads(uploads.filter((item) => item.id !== id));
    return true;
  }
  if (!driveItems.some((item) => item.id === id)) return false;
  const removed = new Set(readRemovedDriveIds());
  if (removed.has(id)) return true;
  removed.add(id);
  writeRemovedDriveIds([...removed]);
  return true;
}

function kindFromName(name: string): DriveKind {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (
    lower.endsWith(".csv") ||
    lower.endsWith(".tsv") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".sheet")
  ) {
    return "sheet";
  }
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".avif") ||
    lower.endsWith(".svg")
  ) {
    return "image";
  }
  if (lower.endsWith("/") || lower.endsWith(".folder")) return "folder";
  return "doc";
}

async function readFileBody(file: File, kind: DriveKind): Promise<string> {
  const lower = file.name.toLowerCase();
  if (kind === "image" || file.type.startsWith("image/")) {
    return compressImageToDataUrl(file);
  }

  const textLike =
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".tsv") ||
    lower.endsWith(".json") ||
    file.type.startsWith("text/");

  if (textLike) {
    const text = await file.text();
    if (lower.endsWith(".csv") || lower.endsWith(".tsv")) {
      return csvToSheetBody(text, lower.endsWith(".tsv") ? "\t" : ",");
    }
    return text.trim() || `${file.name}\n\n(Empty file)`;
  }

  return [
    file.name,
    "",
    "Uploaded to this client Drive.",
    `Type: ${file.type || kind}`,
    `Size: ${formatBytes(file.size)}`,
    "",
    kind === "sheet"
      ? "Binary spreadsheet preview is not available in this demo. Re-upload as CSV to see a table."
      : "Binary preview is not available in this demo. The file is saved locally in the browser you are using now (not on a server).",
  ].join("\n");
}

/** Store images as compressed data URLs so they can preview in-blog. */
async function compressImageToDataUrl(file: File): Promise<string> {
  const rawUrl = await readAsDataUrl(file);
  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    return rawUrl;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return rawUrl;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return rawUrl;
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function isDriveImage(item: DriveItem): boolean {
  return item.kind === "image" && Boolean(item.body?.startsWith("data:image"));
}

export function listClientImages(clientId: string): DriveItem[] {
  return listClientFiles(clientId).filter((item) => item.kind === "image");
}

function csvToSheetBody(text: string, delimiter: string): string {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return "Uploaded spreadsheet\n\n(Empty)";
  const rows = lines.map((line) => splitCsvLine(line, delimiter));
  return ["Uploaded spreadsheet", "", ...rows.map((row) => row.join(" | "))].join(
    "\n",
  );
}

function splitCsvLine(line: string, delimiter: string): string[] {
  if (delimiter === "\t") return line.split("\t").map((cell) => cell.trim());
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function sortItems(a: DriveItem, b: DriveItem): number {
  if (a.kind === "folder" && b.kind !== "folder") return -1;
  if (b.kind === "folder" && a.kind !== "folder") return 1;
  const uploadedA = a.id.startsWith("upload-");
  const uploadedB = b.id.startsWith("upload-");
  if (uploadedA !== uploadedB) return uploadedA ? 1 : -1;
  const rank = strategyRank(a.name) - strategyRank(b.name);
  if (rank !== 0) return rank;
  return a.name.localeCompare(b.name);
}

/** Match the demo client folder order. */
function strategyRank(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("presentation")) return 0;
  if (n.includes("playbook") || n.includes("networking")) return 1;
  if (n.includes("cadence") || n.includes("blog topics")) return 2;
  if (n.includes("associations") || n.includes("events_strategy")) return 3;
  if (n.includes("email") && n.includes("nurture")) return 4;
  if (n.includes("implementation")) return 5;
  if (n.includes("tracker")) return 6;
  return 50;
}
