// src/app/features/recruitment/candidates/candidates.component.ts
import { Component, signal, inject, effect } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { environment } from "../../../../environments/environment";
import { CandidateModalComponent } from "./candidate-modal.component";
import { FormsModule } from "@angular/forms";

interface Candidate {
  id: string;
  name: string;
  phoneNumber: string;
  status: string;
  email?: string;
  address?: string;
  insuranceNumber?: string;
  driverLicense?: string;
  documents?: Record<string, unknown>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  documentsCount: number;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

interface CandidateResponse {
  data: Candidate[];
  pagination: PaginationInfo;
}

@Component({
  selector: "app-candidates",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CandidateModalComponent,
  ],
  templateUrl: "./candidates.component.html",
})
export class CandidatesComponent {
  candidates = signal<Candidate[]>([]);
  pagination = signal<PaginationInfo | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  showAddModal = signal(false);
  showSendSmsModal = signal(false);
  showCandidateModal = signal(false);
  showProfileOverlay = signal(false);
  overlayVisible = signal(false);

  selectedCandidate = signal<Candidate | null>(null);
  sendingSms = signal(false);
  selectedCandidateForModal = signal<Candidate | null>(null);
  selectedCandidateForProfile = signal<Candidate | null>(null);

  // Search and filter properties
  searchTerm = "";
  selectedStatus = "";
  currentPage = 0;
  pageSize = 10;

  // Status options for dropdown
  statusOptions = [
    "LEAD",
    "SMS_SENT",
    "FORM_COMPLETED",
    "DOCUMENTS_UPLOADED",
    "BACKGROUND_CHECK",
    "APPROVED",
    "REJECTED",
  ];

  statusLabels: Record<string, { label: string; color: string }> = {
    LEAD: { label: "New Lead", color: "bg-blue-100 text-blue-800" },
    SMS_SENT: { label: "SMS Sent", color: "bg-yellow-100 text-yellow-800" },
    FORM_COMPLETED: {
      label: "Form Completed",
      color: "bg-green-100 text-green-800",
    },
    DOCUMENTS_UPLOADED: {
      label: "Docs Uploaded",
      color: "bg-indigo-100 text-indigo-800",
    },
    BACKGROUND_CHECK: {
      label: "Background Check",
      color: "bg-purple-100 text-purple-800",
    },
    APPROVED: { label: "Approved", color: "bg-green-100 text-green-800" },
    REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800" },
  };

  // Helper for template
  Math = Math;

  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  readonly candidateForm: FormGroup = this.fb.group({
    name: ["", [Validators.required]],
    phoneNumber: [
      "",
      [Validators.required, Validators.pattern(/^\+?[1-9]\d{1,14}$/)],
    ],
  });

  // Effect to load candidates on component initialization
  private readonly loadCandidatesEffect = effect(() => {
    this.loadCandidates();
  });

  loadCandidates(): void {
    this.loading.set(true);
    this.error.set(null);

    // Build query parameters
    const params: Record<string, string | number> = {
      page: this.currentPage,
      pageSize: this.pageSize,
    };

    if (this.selectedStatus) {
      params["status"] = this.selectedStatus;
    }

    if (this.searchTerm) {
      params["search"] = this.searchTerm;
    }

    console.log("Fetching candidates with params:", params);

    this.http
      .get<CandidateResponse>(`${environment.apiUrl}/recruitment/candidates`, {
        params,
      })
      .subscribe({
        next: (response) => {
          // Important: Ensure we're updating the signals correctly with the response data
          this.candidates.set(response.data);
          this.pagination.set(response.pagination);
          this.loading.set(false);
        },
        error: (err) => {
          console.error("Failed to load candidates", err);
          this.error.set(
            "Failed to load candidates: " +
              (err.error?.message || err.message || "Unknown error")
          );
          this.loading.set(false);
          this.candidates.set([]);
        },
      });
  }

  applyFilters(): void {
    this.currentPage = 0; // Reset to first page when filters change
    this.loadCandidates();
  }

  goToPage(page: number): void {
    if (
      page < 0 ||
      (this.pagination() && page >= this.pagination()!.pageCount)
    ) {
      return;
    }
    this.currentPage = page;
    this.loadCandidates();
  }

  getPaginationArray(): number[] {
    if (!this.pagination()) return [];

    const pageCount = this.pagination()!.pageCount;
    const currentPage = this.pagination()!.page;

    // Show up to 5 page buttons
    if (pageCount <= 5) {
      return Array.from({ length: pageCount }, (_, i) => i);
    }

    // Otherwise show a window of pages around current page
    let start = Math.max(0, currentPage - 2);
    const end = Math.min(pageCount - 1, start + 4);

    // Adjust start if we're near the end
    if (end - start < 4 && start > 0) {
      start = Math.max(0, end - 4);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  public openAddModal(): void {
    this.candidateForm.reset();
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
    this.error.set(null);
  }

  submitCandidate(): void {
    if (this.candidateForm.invalid) return;

    const candidate = this.candidateForm.value;

    this.http
      .post(`${environment.apiUrl}/recruitment/candidates`, candidate)
      .subscribe({
        next: () => {
          this.closeAddModal();
          this.loadCandidates();
        },
        error: (err) => {
          console.error("Failed to add candidate", err);
          this.error.set(err.error?.message || "Failed to add candidate");
        },
      });
  }

  openSendSmsModal(candidate: Candidate): void {
    this.selectedCandidate.set(candidate);
    this.showSendSmsModal.set(true);
  }

  closeSendSmsModal(): void {
    this.showSendSmsModal.set(false);
    this.selectedCandidate.set(null);
    this.error.set(null);
  }

  sendSms(): void {
    const candidate = this.selectedCandidate();
    if (!candidate) return;

    this.sendingSms.set(true);

    this.http
      .post(`${environment.apiUrl}/recruitment/send-sms`, {
        candidateId: candidate.id,
      })
      .subscribe({
        next: () => {
          this.sendingSms.set(false);
          this.closeSendSmsModal();
          this.loadCandidates();
        },
        error: (err) => {
          this.sendingSms.set(false);
          console.error("Failed to send WhatsApp message", err);
          this.error.set(
            err.error?.message || "Failed to send WhatsApp message"
          );
        },
      });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  openCandidateModal(candidate: Candidate): void {
    this.selectedCandidateForModal.set(candidate);
    this.showCandidateModal.set(true);
  }

  closeCandidateModal(): void {
    this.showCandidateModal.set(false);
    this.selectedCandidateForModal.set(null);
  }

  onCandidateSaved(updatedCandidate: Candidate): void {
    const index = this.candidates().findIndex(
      (c) => c.id === updatedCandidate.id
    );
    if (index !== -1) {
      const updatedCandidates = [...this.candidates()];
      updatedCandidates[index] = updatedCandidate;
      this.candidates.set(updatedCandidates);
    }
  }

  onCandidateDeleted(candidateId: string): void {
    const updatedCandidates = this.candidates().filter(
      (c) => c.id !== candidateId
    );
    this.candidates.set(updatedCandidates);
  }

  openProfileOverlay(candidate: Candidate): void {
    this.selectedCandidateForProfile.set(candidate);
    this.showProfileOverlay.set(true);
    // Trigger animation after DOM is updated
    setTimeout(() => {
      this.overlayVisible.set(true);
    }, 10);
  }

  closeProfileOverlay(): void {
    // Start closing animation
    this.overlayVisible.set(false);
    // Hide overlay after animation completes
    setTimeout(() => {
      this.showProfileOverlay.set(false);
      this.selectedCandidateForProfile.set(null);
    }, 300);
  }

  getInitials(name: string): string {
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase())
      .join("")
      .substring(0, 2);
  }

  viewCandidateDetails(candidate: Candidate): void {
    this.router.navigate(["/candidates", candidate.id]);
  }
}
