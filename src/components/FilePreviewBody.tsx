import type { DriveKind } from "../types";

type Block =
  | { type: "text"; lines: string[] }
  | { type: "table"; rows: string[][] };

export function FilePreviewBody({
  kind,
  body,
}: {
  kind: DriveKind;
  body?: string;
}) {
  if (!body?.trim()) {
    return <div className="preview-body muted">No preview content.</div>;
  }

  if (kind === "sheet") {
    return <div className="preview-body preview-sheet">{renderBlocks(parseBlocks(body))}</div>;
  }

  if (kind === "image" && body.startsWith("data:image")) {
    return (
      <div className="preview-body preview-image">
        <img src={body} alt="Drive image preview" />
      </div>
    );
  }

  return <div className="preview-body">{body}</div>;
}

function renderBlocks(blocks: Block[]) {
  return blocks.map((block, index) => {
    if (block.type === "text") {
      return (
        <div key={`text-${index}`} className="sheet-prose">
          {block.lines.join("\n")}
        </div>
      );
    }
    const [header, ...rest] = block.rows;
    return (
      <div key={`table-${index}`} className="sheet-table-wrap">
        <table className="sheet-table">
          {header ? (
            <thead>
              <tr>
                {header.map((cell, cellIndex) => (
                  <th key={cellIndex}>{cell}</th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {rest.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  });
}

function parseBlocks(body: string): Block[] {
  const lines = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const blocks: Block[] = [];
  let textBuffer: string[] = [];
  let tableBuffer: string[][] = [];

  function flushText() {
    const kept = trimBlankEdges(textBuffer);
    if (kept.length > 0) blocks.push({ type: "text", lines: kept });
    textBuffer = [];
  }

  function flushTable() {
    if (tableBuffer.length >= 2) {
      const width = Math.max(...tableBuffer.map((row) => row.length));
      blocks.push({
        type: "table",
        rows: tableBuffer.map((row) => {
          const next = [...row];
          while (next.length < width) next.push("");
          return next;
        }),
      });
    } else {
      for (const row of tableBuffer) textBuffer.push(row.join("  "));
    }
    tableBuffer = [];
  }

  for (const line of lines) {
    const cells = splitRow(line);
    if (cells && cells.length >= 2) {
      if (textBuffer.length > 0 && tableBuffer.length === 0) flushText();
      tableBuffer.push(cells);
      continue;
    }
    if (tableBuffer.length > 0) flushTable();
    textBuffer.push(line);
  }

  if (tableBuffer.length > 0) flushTable();
  flushText();
  return blocks;
}

function splitRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.includes("|")) {
    const cells = trimmed
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell, index, arr) => !(cell === "" && (index === 0 || index === arr.length - 1)));
    if (cells.length >= 2 && !cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
      return cells;
    }
    return null;
  }

  if (trimmed.includes("\t")) {
    const cells = trimmed.split("\t").map((cell) => cell.trim());
    return cells.length >= 2 ? cells : null;
  }

  const spaced = trimmed.split(/\s{2,}/).map((cell) => cell.trim());
  if (spaced.length >= 2) return spaced;
  return null;
}

function trimBlankEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start += 1;
  while (end > start && lines[end - 1].trim() === "") end -= 1;
  return lines.slice(start, end);
}
