/**
 * Recognising someone who has worked here before.
 *
 * The National Insurance number is the anchor: it never changes, while the
 * email is new at every onboarding and the transporter ID only appears on
 * activation. So the NIN is the one thing that can tie a new candidate to the
 * person who left eighteen months ago.
 *
 * This module only ever SUGGESTS. It never links two records on its own.
 * A mistyped NIN that auto-merged would fuse two people's payment and document
 * history, and in an Amazon compliance audit that is a worse failure than
 * missing the match - so a human confirms, every time.
 */

/** Strips spacing and case: "qq 12 34 56 a" and "QQ123456A" are one number. */
export function normaliseNin(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.replace(/[\s-]/g, "").toUpperCase();
  return compact || null;
}

/**
 * UK National Insurance shape: two letters, six digits, a final A-D.
 * Some prefixes are never issued (D, F, I, Q, U, V first; O second; and the
 * pairs BG, GB, KN, NK, NT, TN, ZZ), and rejecting those catches typos early.
 *
 * Seeded and test data often uses the reserved QQ prefix on purpose, so this
 * is exposed as a separate check rather than a hard gate: a number that fails
 * it is flagged, not refused.
 */
export function isPlausibleNin(value: string): boolean {
  const nin = normaliseNin(value);
  if (!nin) return false;
  if (!/^[A-Z]{2}\d{6}[A-D]$/.test(nin)) return false;
  const [first, second] = nin;
  if ("DFIQUV".includes(first)) return false;
  if ("DFIQUVO".includes(second)) return false;
  return !["BG", "GB", "KN", "NK", "NT", "TN", "ZZ"].includes(nin.slice(0, 2));
}

/** The minimum a past engagement has to expose for a hiring decision */
export interface PriorStint {
  readonly startDate: Date;
  readonly endDate: Date | null;
  readonly exitReason: string | null;
  readonly exitNotes: string | null;
  readonly transporterId: string | null;
}

export interface KnownDriver {
  readonly id: string;
  readonly name: string;
  readonly insuranceNumber: string | null;
  readonly status: string;
  readonly stints: readonly PriorStint[];
}

export interface ReturningDriverMatch {
  readonly driverId: string;
  /** The name on the existing record, which may be spelled differently */
  readonly knownAs: string;
  /** How sure the system is. Never "certain": a person always confirms. */
  readonly confidence: "nin_exact" | "nin_exact_name_differs";
  /** Why this was raised, in words a recruiter can act on */
  readonly reason: string;
  readonly priorStints: readonly PriorStint[];
  /** True when the person is currently active - this is a duplicate, not a return */
  readonly currentlyActive: boolean;
}

/** Loose name comparison, only used to describe a match, never to make one */
function sameishName(a: string, b: string): boolean {
  const key = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(" ");
  return key(a) === key(b);
}

/**
 * Looks for someone already on file with this candidate's NIN.
 *
 * Returns every match rather than picking one: two drivers sharing a NIN is
 * itself a data problem the recruiter needs to see, not something to resolve
 * by choosing the first row.
 */
export function findReturningDriver(
  candidate: { name: string; insuranceNumber: string | null },
  drivers: readonly KnownDriver[]
): ReturningDriverMatch[] {
  const nin = normaliseNin(candidate.insuranceNumber);
  if (!nin) return [];

  return drivers
    .filter((d) => normaliseNin(d.insuranceNumber) === nin)
    .map((d) => {
      const nameMatches = sameishName(d.name, candidate.name);
      const active = d.status.toUpperCase() === "ACTIVE";
      const last = [...d.stints].sort(
        (a, b) => b.startDate.getTime() - a.startDate.getTime()
      )[0];

      let reason: string;
      if (active) {
        reason =
          `${d.name} is already an active driver with this National Insurance ` +
          `number. This is more likely a duplicate application than a return.`;
      } else if (last?.endDate) {
        const left = last.endDate.toISOString().slice(0, 10);
        reason =
          `${d.name} worked here before and left on ${left}` +
          (last.exitReason ? ` (${last.exitReason.toLowerCase().replace(/_/g, " ")})` : "") +
          `. Same National Insurance number.`;
      } else {
        reason = `${d.name} is on file with this National Insurance number.`;
      }

      if (!nameMatches) {
        reason +=
          ` Note the name differs from the application ("${candidate.name}") - ` +
          `confirm it is the same person before linking.`;
      }

      return {
        driverId: d.id,
        knownAs: d.name,
        confidence: nameMatches ? "nin_exact" : "nin_exact_name_differs",
        reason,
        priorStints: [...d.stints].sort(
          (a, b) => b.startDate.getTime() - a.startDate.getTime()
        ),
        currentlyActive: active,
      } as const;
    });
}
