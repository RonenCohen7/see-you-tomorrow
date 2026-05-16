/** UTF‑8 BOM + RFC‑style escaping for spreadsheets. */
export function escapeCsvCell(value: string): string {
  if (/[,"\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function stringifyCsv(headers: readonly string[], rows: ReadonlyArray<Record<string, string>>): string {
  const bom = "\uFEFF";
  const line = (cells: readonly string[]) => cells.map((c) => escapeCsvCell(c ?? "")).join(",");
  const out = [line(headers)];
  for (const row of rows) {
    out.push(line(headers.map((h) => String(row[h] ?? ""))));
  }
  return bom + out.join("\r\n");
}

export function downloadTextFile(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, headers: readonly string[], rows: ReadonlyArray<Record<string, string>>): void {
  downloadTextFile(filename, "text/csv;charset=utf-8", stringifyCsv(headers, rows));
}
