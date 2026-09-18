import { CandidateStatus, Prisma } from "@prisma/client";

export const WORKFLOW_STAGES = [
  "contact",
  "documents",
  "background",
  "classroom",
  "ride-along",
  "archived",
] as const;
export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];
export const DOCUMENT_KEYS = [
  "driverLicenseImage",
  "insuranceImage",
  "addressProofImage",
  "passportImage",
  "rightToWorkImage",
] as const;
export type DocumentKey = (typeof DOCUMENT_KEYS)[number];
export type ReviewDecision = "pending" | "approved" | "rejected";
export interface ReviewEntry {
  status: ReviewDecision;
  reason: string;
  reviewedAt: string;
  reviewedBy: string;
}
export interface RecruitmentReview {
  documentReviews: Partial<Record<DocumentKey, ReviewEntry>>;
  documentsStatus: ReviewDecision;
  background?: ReviewEntry;
}

export function documentObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function recruitmentReview(value: unknown): RecruitmentReview {
  const raw = documentObject(documentObject(value)._recruitment);
  return {
    documentReviews: documentObject(
      raw.documentReviews
    ) as RecruitmentReview["documentReviews"],
    documentsStatus: (raw.documentsStatus as ReviewDecision) || "pending",
    ...(raw.background ? { background: raw.background as ReviewEntry } : {}),
  };
}

export function documentValue(
  documents: Record<string, unknown>,
  key: DocumentKey
): string | null {
  const value =
    documents[key] ??
    (key === "insuranceImage" ? documents.insuranceNumberImage : undefined);
  return typeof value === "string" && value.trim() ? value : null;
}

export function documentsReady(value: unknown): boolean {
  const documents = documentObject(value);
  const review = recruitmentReview(value);
  // Three required application documents, plus every optional document supplied.
  return DOCUMENT_KEYS.every((key, index) => {
    const present = !!documentValue(documents, key);
    return index < 3 || present
      ? present && review.documentReviews[key]?.status === "approved"
      : true;
  });
}

export function documentFlags(value: unknown): string[] {
  return Object.entries(recruitmentReview(value).documentReviews)
    .filter(([, review]) => review?.status === "rejected")
    .map(([key]) => key);
}

export function workflowWhere(
  stage: WorkflowStage,
  bucket = "all"
): Prisma.CandidateWhereInput {
  const statuses = (values: CandidateStatus[]): Prisma.CandidateWhereInput => ({
    status: { in: values },
  });
  const afterClassroom: CandidateStatus[] = [
    "CLASSROOM_COMPLETED",
    "RIDE_ALONG_SCHEDULED",
    "RIDE_ALONG_COMPLETED",
    "ACTIVE_DRIVER",
  ];
  const afterBackground: CandidateStatus[] = [
    "APPROVED",
    "CLASSROOM_SCHEDULED",
    ...afterClassroom,
  ];
  switch (stage) {
    case "contact":
      return statuses(
        bucket === "pending"
          ? ["LEAD"]
          : bucket === "sent"
            ? ["SMS_SENT"]
            : ["LEAD", "SMS_SENT"]
      );
    case "documents": {
      const where = statuses(["FORM_COMPLETED", "DOCUMENTS_UPLOADED"]);
      if (bucket === "rejected")
        where.documents = {
          path: ["_recruitment", "documentsStatus"],
          equals: "rejected",
        };
      return where;
    }
    case "background":
      if (bucket === "pending") return statuses(["BACKGROUND_CHECK"]);
      if (bucket === "passed") return statuses(afterBackground);
      if (bucket === "rejected")
        return {
          documents: {
            path: ["_recruitment", "background", "status"],
            equals: "rejected",
          },
        };
      return {
        OR: [
          statuses(["BACKGROUND_CHECK", ...afterBackground]),
          {
            documents: {
              path: ["_recruitment", "background", "status"],
              equals: "rejected",
            },
          },
        ],
      };
    case "classroom":
      return statuses(
        bucket === "ready"
          ? ["APPROVED"]
          : bucket === "scheduled"
            ? ["CLASSROOM_SCHEDULED"]
            : bucket === "completed"
              ? afterClassroom
              : ["APPROVED", "CLASSROOM_SCHEDULED", ...afterClassroom]
      );
    case "ride-along":
      if (bucket === "scheduled")
        return {
          status: { in: ["RIDE_ALONG_SCHEDULED", "ACTIVE_DRIVER"] },
          rideAlongDate: { not: null },
        };
      return statuses(
        bucket === "ready"
          ? ["CLASSROOM_COMPLETED", "RIDE_ALONG_COMPLETED"]
          : [
              "CLASSROOM_COMPLETED",
              "RIDE_ALONG_SCHEDULED",
              "RIDE_ALONG_COMPLETED",
            ]
      );
    case "archived":
      return statuses(["ACTIVE_DRIVER"]);
  }
}
