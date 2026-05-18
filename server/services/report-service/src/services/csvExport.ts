/** UTF‑8 BOM + CSV lines for spreadsheets (RFC-style quoting). */

function escapeCell(value: string): string {
  if (/[,"\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function dailyStatusToCsvBuffer(rows: { fullName: string; workDate: string }[]): Buffer {
  const headers = ["full_name", "work_date"];
  const lines = [headers.map(escapeCell).join(",")];
  for (const r of rows) {
    lines.push([escapeCell(r.fullName), escapeCell(r.workDate)].join(","));
  }
  return Buffer.from(`\uFEFF${lines.join("\r\n")}`, "utf8");
}

export function parkingToCsvBuffer(
  rows: {
    spotLabel: string;
    locationName: string;
    ownerName: string;
    assigneeName: string;
    workDate: string;
    hoursText: string;
  }[]
): Buffer {
  const headers = ["spot", "location", "owner", "assignee", "work_date", "hours"];
  const lines = [headers.map(escapeCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        escapeCell(r.spotLabel),
        escapeCell(r.locationName),
        escapeCell(r.ownerName),
        escapeCell(r.assigneeName),
        escapeCell(r.workDate),
        escapeCell(r.hoursText),
      ].join(",")
    );
  }
  return Buffer.from(`\uFEFF${lines.join("\r\n")}`, "utf8");
}
