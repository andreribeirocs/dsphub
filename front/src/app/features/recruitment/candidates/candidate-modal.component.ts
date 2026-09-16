import {
  Component,
  input,
  output,
  inject,
  ChangeDetectionStrategy,
  effect,
} from "@angular/core";
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

interface Candidate {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  status: string;
  address?: string;
  insuranceNumber?: string;
  insuranceNumberImage?: string;
  driverLicense?: string;
  driverLicenseImage?: string;
  addressProofImage?: string;
  documents?: Record<string, unknown>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  documentsCount: number;
}

@Component({
  selector: "app-candidate-modal",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./candidate-modal.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandidateModalComponent {
  readonly show = input(false);
  readonly candidate = input<Candidate | null>(null);
  readonly closeModal = output<void>();
  readonly saved = output<Candidate>();
  readonly deleted = output<string>();

  isEditing = false;
  loading = false;
  error: string | null = null;
  deleting = false;

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

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly candidateForm: FormGroup = this.fb.group({
    name: ["", [Validators.required]],
    phoneNumber: [
      "",
      [Validators.required, Validators.pattern(/^\+?[1-9]\d{1,14}$/)],
    ],
    email: ["", [Validators.email]],
    address: [""],
    insuranceNumber: [""],
    insuranceNumberImage: [""],
    driverLicense: [""],
    driverLicenseImage: [""],
    addressProofImage: [""],
    notes: [""],
    status: ["", [Validators.required]],
  });

  // Effect to handle candidate changes
  private readonly candidateEffect = effect(() => {
    const candidate = this.candidate();
    if (candidate) {
      this.candidateForm.patchValue(candidate);
      this.isEditing = false;
    }
  });

  startEditing(): void {
    this.isEditing = true;
  }

  navigateToDetail(): void {
    const candidate = this.candidate();
    if (candidate) {
      this.router.navigate(["/candidates", candidate.id]);
      this.onClose();
    }
  }

  onClose(): void {
    this.closeModal.emit();
    this.isEditing = false;
    this.error = null;
  }

  async onFileSelected(event: Event, field: string): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const base64 = await this.convertToBase64(file);
      this.candidateForm.patchValue({ [field]: base64 });
    } catch {
      this.error = "Failed to process the image";
    }
  }

  private convertToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }

  onDelete(): void {
    const candidate = this.candidate();
    if (!candidate) return;

    if (confirm("Are you sure you want to delete this candidate?")) {
      this.deleting = true;
      this.error = null;

      this.http
        .delete(`${environment.apiUrl}/recruitment/candidates/${candidate.id}`)
        .subscribe({
          next: () => {
            this.deleting = false;
            this.deleted.emit(candidate.id);
            this.onClose();
          },
          error: (err) => {
            this.deleting = false;
            this.error = err.error?.message || "Failed to delete candidate";
          },
        });
    }
  }

  onSubmit(): void {
    const candidate = this.candidate();
    if (this.candidateForm.invalid || !candidate) return;

    this.loading = true;
    this.error = null;

    const updatedCandidate = {
      ...candidate,
      ...this.candidateForm.value,
    };

    this.http
      .patch<Candidate>(
        `${environment.apiUrl}/recruitment/candidates/${candidate.id}`,
        updatedCandidate
      )
      .subscribe({
        next: (response) => {
          this.loading = false;
          this.isEditing = false;
          this.saved.emit(response);
          this.onClose();
        },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.message || "Failed to update candidate";
        },
      });
  }

  getStatusLabel(status: string): string {
    return this.statusLabels[status]?.label || status;
  }

  getStatusColor(status: string): string {
    return this.statusLabels[status]?.color || "bg-gray-100 text-gray-800";
  }
}
