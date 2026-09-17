/**
 * Small CSV export helper (no dependencies).
 * Values are quoted when needed and a BOM is added so Excel opens UTF-8 correctly.
 * Cells starting with = + - @ are prefixed with ' to avoid formula injection.
 */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

const escapeCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  let text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCell(column.header)).join(",");
  const lines = rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(","));
  return [header, ...lines].join("\r\n");
}

export function downloadCsv<T>(
  filename: string,
  rows: readonly T[],
  columns: readonly CsvColumn<T>[]
): void {
  const blob = new Blob(["﻿" + toCsv(rows, columns)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** yyyy-mm-dd for file names */
export const today = (): string => new Date().toISOString().slice(0, 10);
