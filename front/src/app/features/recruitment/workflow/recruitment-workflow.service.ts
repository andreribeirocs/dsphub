import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../../environments/environment";
import {
  Candidate,
  ConvertToDriverRequest,
  ConvertToDriverResponse,
} from "../candidates/candidates.service";

export type WorkflowStage =
  | "leads"
  | "contact"
  | "documents"
  | "background"
  | "classroom"
  | "ride-along"
  | "archived";
export type ContactChannel = "whatsapp" | "email" | "preferred";
export type DocumentKey =
  | "driverLicenseImage"
  | "insuranceImage"
  | "addressProofImage"
  | "passportImage"
  | "rightToWorkImage";
export interface ReviewEntry {
  status: "pending" | "approved" | "rejected";
  reason: string;
  reviewedAt: string;
  reviewedBy: string;
}
export interface CandidateReview {
  documentReviews: Partial<Record<DocumentKey, ReviewEntry>>;
  documentsStatus: string;
  background?: ReviewEntry;
}
export interface WorkflowCandidate {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string;
  status: string;
  source: string | null;
  classroomDate: string | null;
  rideAlongDate: string | null;
  userId: string | null;
  formCompleted: boolean | null;
  documentFlags: string[];
  contactPreference: "whatsapp" | "email" | null;
  review: CandidateReview;
}
export interface WorkflowSummary {
  stages: Record<Exclude<WorkflowStage, "leads">, number>;
  statistics: {
    leads: number;
    forms: number;
    inProgress: number;
    completed: number;
  };
  channels: { whatsapp: boolean; email: boolean };
}
export interface WorkflowPage {
  data: WorkflowCandidate[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}
export interface ImportLead {
  name: string;
  phoneNumber: string;
  email?: string;
}
export interface ImportResult {
  imported: number;
  results: {
    row: number;
    name: string;
    status: "imported" | "duplicate" | "invalid";
    message?: string;
  }[];
}
export interface ContactResult {
  sent: number;
  results: { id: string; success: boolean; channel: string; message: string }[];
}
export const DOCUMENT_LABELS: Record<DocumentKey, string> = {
  driverLicenseImage: "Driving licence",
  insuranceImage: "National Insurance",
  addressProofImage: "Proof of address",
  passportImage: "Passport / visa",
  rightToWorkImage: "Right to work",
};

@Injectable({ providedIn: "root" })
export class RecruitmentWorkflowService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/recruitment/workflow`;
  summary() {
    return this.http.get<WorkflowSummary>(`${this.url}/summary`);
  }
  list(
    stage: Exclude<WorkflowStage, "leads">,
    bucket: string,
    page: number,
    search: string
  ) {
    return this.http.get<WorkflowPage>(`${this.url}/candidates`, {
      params: { stage, bucket, page, pageSize: 25, search },
    });
  }
  importLeads(source: string, leads: ImportLead[]) {
    return this.http.post<ImportResult>(`${this.url}/import`, {
      source,
      leads,
    });
  }
  contact(candidateIds: string[], channel: ContactChannel) {
    return this.http.post<ContactResult>(`${this.url}/contact`, {
      candidateIds,
      channel,
    });
  }
  reviewDocument(
    id: string,
    document: DocumentKey,
    decision: "approved" | "rejected",
    reason: string
  ) {
    return this.http.patch<Candidate>(`${this.url}/${id}/documents`, {
      document,
      decision,
      reason,
    });
  }
  replaceDocument(id: string, document: DocumentKey, image: string) {
    return this.http.patch<Candidate>(`${this.url}/${id}/documents/replace`, {
      document,
      image,
    });
  }
  reviewBackground(
    id: string,
    decision: "pending" | "approved" | "rejected",
    reason: string
  ) {
    return this.http.patch<Candidate>(`${this.url}/${id}/background`, {
      decision,
      reason,
    });
  }
  scheduleClassroom(id: string, date: string) {
    return this.http.post<Candidate>(`${this.url}/${id}/classroom`, { date });
  }
  completeClassroom(id: string) {
    return this.http.post<Candidate>(
      `${this.url}/${id}/classroom/complete`,
      {}
    );
  }
  scheduleRideAlong(
    id: string,
    body: ConvertToDriverRequest & { rideAlongDate: string }
  ) {
    return this.http.post<ConvertToDriverResponse>(
      `${this.url}/${id}/ride-along`,
      body
    );
  }
}
