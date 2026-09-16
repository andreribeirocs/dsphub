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

  // Form
  readonly candidateForm: FormGroup;

  readonly citizenshipOptions = [
    "British",
    "Irish",
    "EU National",
    "Non-EU (Right to Work)",
    "Other",
  ];

  readonly slaOptions = ["Standard", "Premium", "Corporate", "Government"];

  readonly accountOptions = ["Individual", "Corporate", "Agency", "Government"];

  // Status configuration
  readonly statusConfig: Record<string, { label: string; color: string }> = {
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

  readonly statusOptions = Object.keys(this.statusConfig);

  constructor() {
    this.candidateForm = this.fb.group({
      // Basic information (core candidate data)
      name: ["", [Validators.required]],
      phoneNumber: [
        "",
        [Validators.required, Validators.pattern(/^\+?[1-9]\d{1,14}$/)],
      ],
      email: ["", [Validators.email]],
      source: [""],
      address: ["", [Validators.required]],
      postalCode: ["", [Validators.required]],
      notes: [""],
      status: ["", [Validators.required]],

      // Personal Information (from registration)
      dateOfBirth: ["", [Validators.required]],
      age: [""], // calculated, read-only
      citizenship: [""],
      documentNumber: [""],

      // Document Information (from registration)
      insuranceNumber: ["", [Validators.required]],
      driverLicense: ["", [Validators.required]],
      driverLicenseExpiry: ["", [Validators.required]], // mapped from licenceExpiry

      // Optional Expiry Dates (from registration)
      passportVisaExpiry: [""],
      rtwExpiry: [""],

      // DVLA Information (from registration)
      points: [0, [Validators.min(0), Validators.max(50)]],
      nextDVLA: [""],

      // Agreement Information (from registration)
      sla: [""],
      account: [""],

      // Emergency Contact (from registration)
      emergencyContactName: ["", [Validators.required]],
      emergencyContactPhone: ["", [Validators.required]],
      emergencyContactRelationship: ["", [Validators.required]],

      // System Fields (read-only)
      lastCheck: [""],
      formCompleted: [""],

      // Document Images (from registration)
      insuranceNumberImage: [""],
      driverLicenseImage: [""],
      addressProofImage: [""],
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
        this.loadCandidateIntoForm();
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

  // UI State Management
  setEditing(editing: boolean): void {
    this.isEditing.set(editing);
    if (!editing) {
      // Reset form when canceling
      this.loadCandidateIntoForm();
    }
  }

  saving = computed(() => this.loading());

  // Data mapping method to handle field name differences
  private loadCandidateIntoForm(): void {
    const candidate = this.candidate();
    if (!candidate) return;

    // Map backend field names to form control names
    const formData = {
      // Basic information
      name: candidate.name || "",
      phoneNumber: candidate.phoneNumber || "",
      email: candidate.email || "",
      source: candidate.source || "",
      address: candidate.address || "",
      postalCode: candidate.postalCode || "",
      notes: candidate.notes || "",
      status: candidate.status || "",

      // Personal Information
      dateOfBirth: candidate.dateOfBirth || "",
      age: candidate.age || "",
      citizenship: candidate.citizenship || "",
      documentNumber: candidate.documentNumber || "",

      // Document Information
      insuranceNumber: candidate.insuranceNumber || "",
      driverLicense: candidate.driverLicense || "",
      // Map licenceExpiry from backend to driverLicenseExpiry in form
      driverLicenseExpiry: candidate.licenceExpiry || "",

      // Expiry Dates
      passportVisaExpiry: candidate.passportVisaExpiry || "",
      rtwExpiry: candidate.rtwExpiry || "",

      // DVLA Information
      points: candidate.points || 0,
      nextDVLA: candidate.nextDVLA || "",

      // Agreement Information
      sla: candidate.sla || "",
      account: candidate.account || "",

      // Emergency Contact - extract from documents.additionalData if stored there
      emergencyContactName:
        candidate.emergencyContactName ||
        (candidate.documents as any)?.additionalData?.emergencyContact?.name ||
        "",
      emergencyContactPhone:
        candidate.emergencyContactPhone ||
        (candidate.documents as any)?.additionalData?.emergencyContact?.phone ||
        "",
      emergencyContactRelationship:
        (candidate.documents as any)?.additionalData?.emergencyContact
          ?.relationship || "",

      // System Fields
      lastCheck: candidate.lastCheck || "",
      formCompleted: candidate.formCompleted || false,

      // Document Images
      insuranceNumberImage: candidate.insuranceNumberImage || "",
      driverLicenseImage: candidate.driverLicenseImage || "",
      addressProofImage: candidate.addressProofImage || "",
    };

    this.candidateForm.patchValue(formData);
  }

  saveChanges(): void {
    if (this.candidateForm.invalid || !this.candidate()) return;

    this.loading.set(true);
    this.error.set(null);

    const formValue = this.candidateForm.value;

    // Map form field names back to backend field names
    const updateData: UpdateCandidateDto = {
      // Basic information
      name: formValue.name,
      phoneNumber: formValue.phoneNumber,
      email: formValue.email,
      source: formValue.source,
      address: formValue.address,
      postalCode: formValue.postalCode,
      notes: formValue.notes,
      status: formValue.status,

      // Personal Information
      dateOfBirth: formValue.dateOfBirth,
      age: formValue.age,
      citizenship: formValue.citizenship,
      documentNumber: formValue.documentNumber,

      // Document Information
      insuranceNumber: formValue.insuranceNumber,
      driverLicense: formValue.driverLicense,
      // Map driverLicenseExpiry from form back to licenceExpiry for backend
      licenceExpiry: formValue.driverLicenseExpiry,

      // Expiry Dates
      passportVisaExpiry: formValue.passportVisaExpiry,
      rtwExpiry: formValue.rtwExpiry,

      // DVLA Information
      points: formValue.points,
      nextDVLA: formValue.nextDVLA,

      // Agreement Information
      sla: formValue.sla,
      account: formValue.account,

      // Emergency Contact
      emergencyContactName: formValue.emergencyContactName,
      emergencyContactPhone: formValue.emergencyContactPhone,
      emergencyContactRelationship: formValue.emergencyContactRelationship,

      // System Fields
      lastCheck: formValue.lastCheck,
      formCompleted: formValue.formCompleted,

      // Document Images
      insuranceNumberImage: formValue.insuranceNumberImage,
      driverLicenseImage: formValue.driverLicenseImage,
      addressProofImage: formValue.addressProofImage,
    };

    this.candidatesService
      .updateCandidate(this.candidate()!.id, updateData)
      .subscribe({
        next: (updatedCandidate) => {
          this.candidate.set(updatedCandidate);
          this.loadCandidateIntoForm(); // Reload form with updated data
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
    return this.statusConfig[status || ""]?.label || status || "";
  }

  getStatusColor(status?: string): string {
    return (
      this.statusConfig[status || ""]?.color || "bg-gray-100 text-gray-800"
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
