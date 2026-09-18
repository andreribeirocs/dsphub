/**
 * Parser for Amazon's "Service Details Report" CSV, exactly as it is downloaded
 * from the Amazon portal. Nothing is cleaned up by hand before it gets here.
 *
 * Quirks this file has to survive (all observed in a real report):
 * - a UTF-8 BOM before the header row
 * - `Delivery Associate` EMPTY on Training Day rows (Amazon pays the training
 *   day without saying who trained)
 * - distance columns EMPTY on helper rows (see service-report.rules.ts)
 * - `Log in` and/or `Log out` empty when the driver never signed off
 * - route codes that do not follow the CA_Annn shape (e.g. `1BFU0C1RXK`)
 * - several dates in one file, despite the file name naming a single day
 *
 * Parsing NEVER throws on a bad row: a report that is 99% good must still be
 * importable. Rows that cannot be read land in `problems` with their line
 * number so a human can look at exactly those.
 */

/** One row of the report, with the raw strings already turned into values */
export interface ServiceReportRow {
  /** 1-based line number in the source file, for error messages */
  readonly line: number;
  /** Date the route was completed (YYYY-MM-DD, as Amazon writes it) */
  readonly date: string;
  /** e.g. "Portsmouth (DPO1) - Amazon Logistics (PO9 2NG)" */
  readonly station: string;
  /** DSP short code, e.g. "TRIU" */
  readonly dspShortCode: string;
  /** Free-text driver name. EMPTY on Training Day rows. */
  readonly deliveryAssociate: string;
  /** Route code, e.g. "CA_A177" */
  readonly route: string;
  /** Amazon's service type label, e.g. "Standard Parcel Medium Van" */
  readonly serviceType: string;
  /** Planned duration in minutes, from "9 hr 15 min". Null when absent. */
  readonly plannedDurationMinutes: number | null;
  /** Actual sign-in. Null when the driver never signed in. */
  readonly logIn: Date | null;
  /** Actual sign-off. Null when the driver never signed off. */
  readonly logOut: Date | null;
  /** Planned distance. NULL MEANS HELPER ROW - do not default it to 0. */
  readonly distancePlanned: number | null;
  readonly distanceAllowance: number | null;
  readonly distanceUnit: string;
  readonly deliveriesPerformed: number | null;
  readonly deliveriesReturned: number | null;
  /** Amazon excluded this row from its own metrics */
  readonly excluded: boolean;
}

export interface ParseProblem {
  readonly line: number;
  readonly reason: string;
  /** The raw line, so the person can see what Amazon actually sent */
  readonly raw: string;
}

export interface ParsedServiceReport {
  readonly rows: readonly ServiceReportRow[];
  readonly problems: readonly ParseProblem[];
  /** Distinct dates present, ascending. A file often spans several days. */
  readonly dates: readonly string[];
  /** Distinct stations present. More than one means a multi-depot report. */
  readonly stations: readonly string[];
}

const EXPECTED_HEADER = [
  "Date",
  "Station",
  "DSP short code",
  "Delivery Associate",
  "Route",
  "Service Type",
  "Planned Duration",
  "Log in",
  "Log out",
  "Total Distance Planned",
  "Total Distance Allowance",
  "Distance unit",
  "Deliveries performed",
  "Deliveries returned",
  "Excluded?",
] as const;

/** Splits one CSV line, honouring double quotes (station names contain commas) */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      out.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  out.push(field);
  return out;
}

/** "9 hr 15 min" -> 555; "9 hr" -> 540; "" -> null */
export function parsePlannedDuration(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const hours = /(\d+)\s*hr/.exec(text);
  const minutes = /(\d+)\s*min/.exec(text);
  if (!hours && !minutes) return null;
  return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
}

/**
 * An empty numeric cell is NOT zero. On helper rows Amazon leaves the distance
 * blank, and a helper who drove 0 miles is a different statement from a helper
 * whose mileage was never recorded - the whole helper rule depends on telling
 * those apart.
 */
function parseOptionalNumber(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalDate(value: string): Date | null {
  const text = value.trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** True when the header matches what we know, so a changed export is caught */
export function headerMatches(headerLine: string): boolean {
  const fields = splitCsvLine(headerLine.replace(/^﻿/, "")).map((f) =>
    f.trim()
  );
  return (
    fields.length === EXPECTED_HEADER.length &&
    EXPECTED_HEADER.every((expected, i) => fields[i] === expected)
  );
}

export function parseServiceReport(content: string): ParsedServiceReport {
  const lines = content.replace(/^﻿/, "").split(/\r?\n/);
  const rows: ServiceReportRow[] = [];
  const problems: ParseProblem[] = [];

  if (lines.length === 0 || !lines[0].trim()) {
    return { rows: [], problems: [], dates: [], stations: [] };
  }

  if (!headerMatches(lines[0])) {
    problems.push({
      line: 1,
      reason:
        "Header does not match the expected Service Details Report columns. " +
        "Amazon may have changed the export - check before trusting this import.",
      raw: lines[0],
    });
  }

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;

    const f = splitCsvLine(raw);
    if (f.length !== EXPECTED_HEADER.length) {
      problems.push({
        line: i + 1,
        reason: `Expected ${EXPECTED_HEADER.length} columns, found ${f.length}`,
        raw,
      });
      continue;
    }

    const date = f[0].trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      problems.push({ line: i + 1, reason: `Unreadable date "${f[0]}"`, raw });
      continue;
    }

    const route = f[4].trim();
    if (!route) {
      problems.push({ line: i + 1, reason: "Row has no route code", raw });
      continue;
    }

    rows.push({
      line: i + 1,
      date,
      station: f[1].trim(),
      dspShortCode: f[2].trim(),
      // Kept exactly as Amazon wrote it: matching to a driver happens later,
      // and normalising here would hide the inconsistent casing we rely on
      // seeing ("Kieran moonan").
      deliveryAssociate: f[3].trim(),
      route,
      serviceType: f[5].trim(),
      plannedDurationMinutes: parsePlannedDuration(f[6]),
      logIn: parseOptionalDate(f[7]),
      logOut: parseOptionalDate(f[8]),
      distancePlanned: parseOptionalNumber(f[9]),
      distanceAllowance: parseOptionalNumber(f[10]),
      distanceUnit: f[11].trim(),
      deliveriesPerformed: parseOptionalNumber(f[12]),
      deliveriesReturned: parseOptionalNumber(f[13]),
      excluded: f[14].trim().toLowerCase() === "yes",
    });
  }

  return {
    rows,
    problems,
    dates: [...new Set(rows.map((r) => r.date))].sort(),
    stations: [...new Set(rows.map((r) => r.station))].sort(),
  };
}
