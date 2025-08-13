import { Component, inject, signal, computed, effect } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { Router, ActivatedRoute } from "@angular/router";
import { toSignal } from "@angular/core/rxjs-interop";

import {
  CandidatesService,
  type Candidate,
  type UpdateCandidateDto,
  type CandidateDocuments,
} from "./candidates.service";
import { DocumentViewerModalComponent } from "./document-viewer-modal.component";

@Component({
  selector: "app-candidate-detail",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DocumentViewerModalComponent],
  templateUrl: "./candidate-detail.component.html",
})
export class CandidateDetailComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly candidatesService = inject(CandidatesService);
  private readonly fb = inject(FormBuilder);

  // Signals
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isEditing = signal(false);
  readonly candidate = signal<Candidate | null>(null);

  // Document viewer modal state
  readonly isModalOpen = signal(false);
  readonly modalDocumentUrl = signal<string | null>(null);
  readonly modalDocumentTitle = signal<string>("");

  // Computed image URLs for reliable loading
  readonly insuranceImageUrl = computed(() => {
    const candidate = this.candidate();
    return candidate?.insuranceNumberImage
      ? this.formatImageSrc(candidate.insuranceNumberImage)
      : null;
  });

  readonly driverLicenseImageUrl = computed(() => {
    const candidate = this.candidate();
    return candidate?.driverLicenseImage
      ? this.formatImageSrc(candidate.driverLicenseImage)
      : null;
  });

  readonly addressProofImageUrl = computed(() => {
    const candidate = this.candidate();
    return candidate?.addressProofImage
      ? this.formatImageSrc(candidate.addressProofImage)
      : null;
  });

  readonly medicalCertificateImageUrl = computed(() => {
    const candidate = this.candidate();
    return candidate?.medicalCertificate
      ? this.formatImageSrc(candidate.medicalCertificate)
      : null;
  });

  readonly trainingCertificateImageUrl = computed(() => {
    const candidate = this.candidate();
    return candidate?.trainingCertificate
      ? this.formatImageSrc(candidate.trainingCertificate)
      : null;
  });

  // Form
  readonly candidateForm: FormGroup;

  // Status configuration
  readonly statusOptions = [
    "LEAD",
    "SMS_SENT",
    "FORM_COMPLETED",
    "DOCUMENTS_UPLOADED",
    "BACKGROUND_CHECK",
    "APPROVED",
    "CLASSROOM_SCHEDULED",
    "CLASSROOM_COMPLETED",
    "RIDE_ALONG_SCHEDULED",
    "RIDE_ALONG_COMPLETED",
    "ACTIVE_DRIVER",
    "REJECTED",
  ];

  readonly statusLabels: Record<string, { label: string; color: string }> = {
    LEAD: { label: "New Lead", color: "bg-blue-100 text-blue-800" },
    SMS_SENT: { label: "SMS Sent", color: "bg-yellow-100 text-yellow-800" },
    FORM_COMPLETED: {
      label: "Form Completed",
      color: "bg-green-100 text-green-800",
    },
    DOCUMENTS_UPLOADED: {
      label: "Documents Uploaded",
      color: "bg-indigo-100 text-indigo-800",
    },
    BACKGROUND_CHECK: {
      label: "Background Check",
      color: "bg-purple-100 text-purple-800",
    },
    APPROVED: { label: "Approved", color: "bg-green-100 text-green-800" },
    CLASSROOM_SCHEDULED: {
      label: "Classroom Scheduled",
      color: "bg-orange-100 text-orange-800",
    },
    CLASSROOM_COMPLETED: {
      label: "Classroom Completed",
      color: "bg-green-100 text-green-800",
    },
    RIDE_ALONG_SCHEDULED: {
      label: "Ride Along Scheduled",
      color: "bg-orange-100 text-orange-800",
    },
    RIDE_ALONG_COMPLETED: {
      label: "Ride Along Completed",
      color: "bg-green-100 text-green-800",
    },
    ACTIVE_DRIVER: {
      label: "Active Driver",
      color: "bg-green-100 text-green-800",
    },
    REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800" },
  };

  constructor() {
    this.candidateForm = this.fb.group({
      // Basic information
      name: ["", [Validators.required]],
      phoneNumber: [
        "",
        [Validators.required, Validators.pattern(/^\+?[1-9]\d{1,14}$/)],
      ],
      email: ["", [Validators.email]],
      source: [""],
      address: [""],
      notes: [""],
      status: ["", [Validators.required]],

      // Driver license and insurance
      insuranceNumber: [""],
      insuranceNumberImage: [""],
      driverLicense: [""],
      driverLicenseImage: [""],
      addressProofImage: [""],

      // Driver-specific fields
      driverId: [""],
      tlcLicense: [""],
      tlcLicenseExpiry: [""],
      vehicleId: [""],
      routeId: [""],
      signUpDate: [""],
      startWorkingDate: [""],
      lastWorkingDate: [""],
      isActive: [false],
      onboardingCompleted: [false],
      backgroundCheckStatus: [""],
      backgroundCheckDate: [""],

      // Emergency contact
      emergencyContactName: [""],
      emergencyContactPhone: ["", [Validators.pattern(/^\+?[1-9]\d{1,14}$/)]],

      // Financial information
      payRate: [0, [Validators.min(0)]],
      payType: [""],

      // Additional documents
      medicalCertificate: [""],
      medicalCertificateExpiry: [""],
      drugTestResult: [""],
      drugTestDate: [""],
      trainingCertificate: [""],
      trainingCompletionDate: [""],
    });

    // Load candidate data when route params change
    const routeParams = toSignal(this.route.params);

    effect(() => {
      const params = routeParams();
      const candidateId = params?.["id"];
      if (candidateId) {
        this.loadCandidate(candidateId);
      }
    });
  }

  private loadCandidate(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.candidatesService.getCandidateById(id).subscribe({
      next: (candidate) => {
        this.candidate.set(candidate);
        this.candidateForm.patchValue(candidate);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || "Failed to load candidate");
        this.loading.set(false);
      },
    });
  }

  startEditing(): void {
    this.isEditing.set(true);
  }

  cancelEditing(): void {
    this.isEditing.set(false);
    if (this.candidate()) {
      this.candidateForm.patchValue(this.candidate()!);
    }
    this.error.set(null);
  }

  saveChanges(): void {
    if (this.candidateForm.invalid || !this.candidate()) return;

    this.loading.set(true);
    this.error.set(null);

    const updateData: UpdateCandidateDto = {
      ...this.candidateForm.value,
    };

    this.candidatesService
      .updateCandidate(this.candidate()!.id, updateData)
      .subscribe({
        next: (updatedCandidate) => {
          this.candidate.set(updatedCandidate);
          this.isEditing.set(false);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.error?.message || "Failed to update candidate");
          this.loading.set(false);
        },
      });
  }

  async onFileSelected(event: Event, field: string): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const base64 = await this.convertToBase64(file);
      this.candidateForm.patchValue({ [field]: base64 });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      this.error.set("Failed to process the image");
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

  goBack(): void {
    this.router.navigate(["/candidates"]);
  }

  getStatusLabel(status?: string): string {
    return this.statusLabels[status || ""]?.label || status || "";
  }

  getStatusColor(status?: string): string {
    return (
      this.statusLabels[status || ""]?.color || "bg-gray-100 text-gray-800"
    );
  }

  // Document viewer methods
  openDocumentModal(documentUrl: string, title: string): void {
    if (!documentUrl || documentUrl === "") {
      console.error("⚠️ No document URL provided for:", title);
      return;
    }

    this.modalDocumentUrl.set(documentUrl);
    this.modalDocumentTitle.set(title);
    this.isModalOpen.set(true);
  }

  closeDocumentModal(): void {
    this.isModalOpen.set(false);
    this.modalDocumentUrl.set(null);
    this.modalDocumentTitle.set("");
  }

  // Helper methods for data formatting
  formatCurrency(amount?: number): string {
    if (!amount) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }

  formatDate(dateString?: string): string {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  }

  formatDateTime(dateString?: string): string {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  }

  formatPercentage(value?: number): string {
    if (value === undefined || value === null) return "N/A";
    return `${Math.round(value)}%`;
  }

  formatRating(rating?: number): string {
    if (!rating) return "N/A";
    return `${rating.toFixed(1)}/5.0`;
  }

  // Helper method to format base64 data as data URL for image display
  formatImageSrc(base64Data?: string): string | null {
    if (!base64Data) {
      return null;
    }

    // If it already has data URL prefix, return as is
    if (base64Data.startsWith("data:")) {
      return base64Data;
    }

    // If it's raw base64, add the data URL prefix
    // Default to image/jpeg, but you could detect the format if needed
    return `data:image/jpeg;base64,${base64Data}`;
  }

  getBadgeColor(isActive?: boolean): string {
    return isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
  }

  getBadgeText(isActive?: boolean): string {
    return isActive ? "Active" : "Inactive";
  }

  getBackgroundCheckColor(status?: string): string {
    if (!status) return "bg-gray-100 text-gray-800";

    switch (status.toUpperCase()) {
      case "PASSED":
      case "APPROVED":
        return "bg-green-100 text-green-800";
      case "FAILED":
      case "REJECTED":
        return "bg-red-100 text-red-800";
      case "PENDING":
      case "IN_PROGRESS":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  // Pay type options
  readonly payTypeOptions = [
    { value: "HOURLY", label: "Hourly" },
    { value: "DAILY", label: "Daily" },
    { value: "WEEKLY", label: "Weekly" },
    { value: "MONTHLY", label: "Monthly" },
  ];

  // Background check status options
  readonly backgroundCheckOptions = [
    "PENDING",
    "IN_PROGRESS",
    "PASSED",
    "FAILED",
    "APPROVED",
    "REJECTED",
  ];

  // Drug test result options
  readonly drugTestOptions = ["PENDING", "PASSED", "FAILED", "SCHEDULED"];

  // Document processing methods
  getDocumentEntries(
    documents?: CandidateDocuments
  ): { key: string; value: string }[] {
    if (!documents || typeof documents !== "object") return [];

    return Object.entries(documents)
      .filter(([key, value]) => {
        // Exclude additionalData field as it's not an image document
        return key !== "additionalData" && value && typeof value === "string";
      })
      .map(([key, value]) => ({ key, value: value as string }));
  }

  formatDocumentName(key: string): string {
    // Convert camelCase/snake_case to readable format
    const formatted = key
      .replace(/([A-Z])/g, " $1") // Add space before uppercase letters
      .replace(/_/g, " ") // Replace underscores with spaces
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
      .join(" ");

    // Handle common document type mappings
    const mappings: Record<string, string> = {
      "Passport Image": "Passport",
      "Driver License Image": "Driver License",
      "Insurance Number Image": "Insurance Card",
      "Address Proof Image": "Address Proof",
      "Medical Certificate": "Medical Certificate",
      "Training Certificate": "Training Certificate",
      "Tlc License Image": "TLC License",
      "Social Security Image": "Social Security Card",
      "Birth Certificate Image": "Birth Certificate",
      "Vehicle Registration Image": "Vehicle Registration",
      "Vehicle Insurance Image": "Vehicle Insurance",
    };

    return mappings[formatted] || formatted;
  }

  // Helper method to safely open document modal with formatted URL
  openDocumentModalSafe(documentData: string, title: string): void {
    const formattedUrl = this.formatImageSrc(documentData);
    if (formattedUrl) {
      this.openDocumentModal(formattedUrl, title);
    } else {
      console.warn("No valid document URL for:", title);
    }
  }
}
