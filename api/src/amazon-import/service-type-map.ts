/**
 * Maps the service-type labels Amazon writes in its reports onto the codes the
 * system pays by (the `RouteType` values, which are also the `code` column of
 * the per-DSP `ServiceType` table - that shared code is the bridge between the
 * two worlds).
 *
 * The rule that matters here: an unrecognised label is NEVER dropped and never
 * guessed into the nearest match. It is returned as unmapped so the onsite
 * manager can either map it or create the service type. Amazon adds labels
 * without warning, and a silently discarded line is a route that was worked,
 * paid for, and never made it into anyone's pay.
 */

/** Amazon's exact label -> the code the system pays by */
const AMAZON_LABEL_TO_CODE: Readonly<Record<string, string>> = {
  "standard parcel medium van": "STANDARD_PARCEL_MEDIUM_VAN",
  "standard parcel - low emission vehicle (large)":
    "STANDARD_PARCEL_LOW_EMISSION_VEHICLE_LARGE",
  "standard parcel": "STANDARD_PARCEL",
  "standard parcel ride along (ironhide) - medium van":
    "STANDARD_PARCEL_RIDE_ALONG_IRONHIDE_MEDIUM_VAN",
  "standard parcel ride along (mentee ironhide) - medium van":
    "STANDARD_PARCEL_RIDE_ALONG_MENTEE_IRONHIDE_MEDIUM_VAN",
  "standard parcel with helper": "STANDARD_PARCEL_WITH_HELPER",
  "training day": "TRAINING_DAY",
  "same day": "SAME_DAY",
  "nursery route": "NURSERY_ROUTE",
  "nursery route level 1": "NURSERY_ROUTE_LEVEL_1",
  "nursery route level 2": "NURSERY_ROUTE_LEVEL_2",
  "nursery route level 3": "NURSERY_ROUTE_LEVEL_3",
  "nursery route level 4": "NURSERY_ROUTE_LEVEL_4",
  // Amazon writes the vehicle variant as a suffix; the level is what is paid
  "nursery route level 1 - low emissions vehicle": "NURSERY_ROUTE_LEVEL_1",
  "nursery route level 2 - low emissions vehicle": "NURSERY_ROUTE_LEVEL_2",
  "nursery route level 3 - low emissions vehicle": "NURSERY_ROUTE_LEVEL_3",
  "ordt extra large cargo van": "ORDT_EXTRA_LARGE_CARGO_VAN",
  "full route": "FULL_ROUTE",
};

/**
 * Codes the operation uses that Amazon never writes, because they describe how
 * the DSP splits the work internally rather than what Amazon is buying:
 *
 * - SWEEPER / HELPER / RESCUE_*: someone working another driver's route. Amazon
 *   shows these as an extra row with no mileage, not as a named service type.
 * - HALF_ROUTE: two drivers sharing one route, each paid half. Amazon still
 *   pays the route as one line.
 *
 * HALF_ROUTE is NOT in the RouteType enum today. It is listed here because the
 * operation needs it, and it is the clearest argument for finishing the move
 * from the enum to the ServiceType table: adding it must not require a deploy.
 */
export const INTERNAL_ONLY_CODES = [
  "SWEEPER",
  "HELPER",
  "HELPER_FLEET",
  "RESCUE_2",
  "RESCUE_6",
  "HALF_ROUTE",
  "LEAD_DRIVER",
  "OSM_RATE",
  "OSM_COVER",
  "EXTRAS",
] as const;

/** Lower-cases and collapses whitespace so spacing changes do not break a match */
function normalise(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The code for an Amazon label, or null when the label is not known */
export function codeForAmazonLabel(label: string): string | null {
  return AMAZON_LABEL_TO_CODE[normalise(label)] ?? null;
}

export interface LabelMappingReport {
  /** Amazon label -> system code, for everything that matched */
  readonly mapped: ReadonlyMap<string, string>;
  /**
   * Labels present in the file that nothing maps to, with how many rows each
   * one covers. These block a clean import: every one is paid work that would
   * otherwise vanish.
   */
  readonly unmapped: readonly { label: string; rows: number }[];
}

/** Checks a whole report's labels in one pass, before anything is written. */
export function mapLabels(
  labels: readonly string[]
): LabelMappingReport {
  const mapped = new Map<string, string>();
  // Counted per row, not per distinct label, so the message can say how much
  // work is at stake rather than only naming the label.
  const unmappedRows = new Map<string, number>();

  for (const label of labels) {
    const code = codeForAmazonLabel(label);
    if (code) {
      mapped.set(label, code);
    } else {
      unmappedRows.set(label, (unmappedRows.get(label) ?? 0) + 1);
    }
  }

  return {
    mapped,
    unmapped: [...unmappedRows.entries()]
      .map(([label, rows]) => ({ label, rows }))
      .sort((a, b) => b.rows - a.rows || a.label.localeCompare(b.label)),
  };
}
