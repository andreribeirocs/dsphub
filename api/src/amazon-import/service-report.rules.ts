/**
 * Business rules derived from a parsed Service Details Report.
 *
 * Two DIFFERENT groupings live here, and confusing them is the easiest way to
 * get this wrong:
 *
 *   - WORKED HOURS group by (date + delivery associate). Amazon repeats the
 *     same sign-in/sign-off on every row belonging to that person that day, so
 *     summing per row multiplies one shift by the number of routes touched.
 *     A real case: Salvyn Kisitu swept three routes on 2025-02-24 with one
 *     15:10 -> 18:16 shift. Per row that reads as 9 hours; it was 3.
 *
 *   - PAYMENT groups by ROW. Each row is a separate piece of work, and a row
 *     without distance is a helper on someone else's route, which moves money
 *     between two drivers rather than creating one payment.
 */

import type { ServiceReportRow } from "./service-report.parser";

/** How the worked hours for a shift were arrived at */
export type HoursSource =
  /** Amazon recorded both sign-in and sign-off: this is the real figure */
  | "recorded"
  /** Signed in but never signed off; the planned duration was added to sign-in */
  | "estimated_from_planned"
  /** No sign-in at all: nothing to anchor an estimate to */
  | "missing";

export interface DriverShift {
  readonly date: string;
  /** Amazon's spelling of the name; matching to a Driver happens elsewhere */
  readonly deliveryAssociate: string;
  readonly logIn: Date | null;
  readonly logOut: Date | null;
  /** Null only when `source` is "missing" */
  readonly workedMinutes: number | null;
  readonly source: HoursSource;
  /** Every row of the report belonging to this shift */
  readonly rows: readonly ServiceReportRow[];
}

/** Fallback when a driver signs in and never signs off */
const DEFAULT_SHIFT_MINUTES = 9 * 60;

/**
 * One shift per (date, associate).
 *
 * When sign-off is missing we add the row's own planned duration to the
 * sign-in - which is the "sign-in + 9 hours" rule, just taking the 9 from the
 * report instead of hard-coding it, since some routes are planned at 9h15.
 * The result is marked `estimated_from_planned` so no screen can present it as
 * a measured fact, and so the onsite manager can be shown exactly which days
 * still need a human decision.
 */
export function buildShifts(
  rows: readonly ServiceReportRow[]
): DriverShift[] {
  const groups = new Map<string, ServiceReportRow[]>();

  for (const row of rows) {
    // Rows with no associate (Training Day) carry no shift: Amazon does not
    // say who was there, so they are attributed from the recruitment side.
    if (!row.deliveryAssociate) continue;
    const key = `${row.date}\u0000${row.deliveryAssociate}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const shifts: DriverShift[] = [];

  for (const bucket of groups.values()) {
    const first = bucket[0];
    const logIn = bucket.find((r) => r.logIn)?.logIn ?? null;
    const logOut = bucket.find((r) => r.logOut)?.logOut ?? null;

    let workedMinutes: number | null = null;
    let source: HoursSource = "missing";

    if (logIn && logOut) {
      workedMinutes = Math.round((logOut.getTime() - logIn.getTime()) / 60000);
      source = "recorded";
    } else if (logIn) {
      const planned =
        bucket.find((r) => r.plannedDurationMinutes !== null)
          ?.plannedDurationMinutes ?? DEFAULT_SHIFT_MINUTES;
      workedMinutes = planned;
      source = "estimated_from_planned";
    }

    shifts.push({
      date: first.date,
      deliveryAssociate: first.deliveryAssociate,
      logIn,
      logOut,
      workedMinutes,
      source,
      rows: bucket,
    });
  }

  return shifts.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.deliveryAssociate.localeCompare(b.deliveryAssociate)
  );
}

export interface RouteAssignment {
  readonly date: string;
  readonly route: string;
  readonly serviceType: string;
  /** The driver the route belongs to: the one carrying the mileage */
  readonly primary: ServiceReportRow | null;
  /**
   * Drivers who worked this route without carrying its mileage. In the
   * operation these are helpers or sweepers: the help is charged to the
   * primary driver and paid to the helper, so each of these implies a
   * transfer between two drivers rather than a standalone payment.
   */
  readonly helpers: readonly ServiceReportRow[];
  /**
   * True when the shape is not the expected "one primary + N helpers" - for
   * example two rows both carrying mileage, or helpers with no primary at all.
   * These are never guessed at; they are surfaced for a human.
   */
  readonly irregular: boolean;
}

/**
 * Splits each (date, route) into its primary driver and its helpers.
 *
 * The rule, confirmed against a real report with no exceptions: on a route
 * worked by more than one person, exactly one row carries the distance
 * columns and the others are blank. The blank ones are the help.
 */
export function buildRouteAssignments(
  rows: readonly ServiceReportRow[]
): RouteAssignment[] {
  const groups = new Map<string, ServiceReportRow[]>();

  for (const row of rows) {
    const key = `${row.date}\u0000${row.route}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const assignments: RouteAssignment[] = [];

  for (const bucket of groups.values()) {
    const withDistance = bucket.filter((r) => r.distancePlanned !== null);
    const withoutDistance = bucket.filter((r) => r.distancePlanned === null);

    // A single row with no distance is not a helper - there is nobody to help.
    // It is a service Amazon pays flat, such as a Training Day.
    const singleFlatRow = bucket.length === 1 && withDistance.length === 0;

    assignments.push({
      date: bucket[0].date,
      route: bucket[0].route,
      serviceType: bucket[0].serviceType,
      primary: withDistance[0] ?? (singleFlatRow ? bucket[0] : null),
      helpers: singleFlatRow ? [] : withoutDistance,
      irregular: withDistance.length > 1 || (!singleFlatRow && withDistance.length === 0),
    });
  }

  return assignments.sort(
    (a, b) => a.date.localeCompare(b.date) || a.route.localeCompare(b.route)
  );
}

/**
 * Rows Amazon paid without naming anyone - in practice the Training Day, which
 * is the recruitment module's classroom. They are returned per date with a
 * count, because that is the only way they can be reconciled: the recruitment
 * records say how many people sat in the classroom that day, and this says how
 * many Amazon paid for. A shortfall is money owed to the company.
 */
export function unattributedByDate(
  rows: readonly ServiceReportRow[]
): { date: string; serviceType: string; count: number }[] {
  const counts = new Map<string, { date: string; serviceType: string; count: number }>();

  for (const row of rows) {
    if (row.deliveryAssociate) continue;
    const key = `${row.date}\u0000${row.serviceType}`;
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { date: row.date, serviceType: row.serviceType, count: 1 });
  }

  return [...counts.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.serviceType.localeCompare(b.serviceType)
  );
}

/** Every distinct service type in the file, with how often it appears. */
export function serviceTypeUsage(
  rows: readonly ServiceReportRow[]
): { serviceType: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.serviceType, (counts.get(row.serviceType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([serviceType, count]) => ({ serviceType, count }))
    .sort((a, b) => b.count - a.count || a.serviceType.localeCompare(b.serviceType));
}
