import { Component, OnInit, signal, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import {
  CandidateRegistrationService,
  TokenValidationResponse,
  CompleteRegistrationRequest,
} from "../../../core/services/candidate-registration.service";

@Component({
  selector: "app-candidate-registration",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./candidate-registration.component.html",
  styleUrls: ["./candidate-registration.component.scss"],
})
export class CandidateRegistrationComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private candidateService = inject(CandidateRegistrationService);

  // Signals for reactive state management
  isLoading = signal(false);
  isSubmitting = signal(false);
  error = signal<string>("");
  success = signal<string>("");
  candidateInfo = signal<TokenValidationResponse | null>(null);
  currentStep = signal(1);
  totalSteps = signal(4);

  // Form and file handling
  registrationForm!: FormGroup;
  uploadedFiles = signal<
    Record<string, { file: File; preview: string; base64: string }>
  >({});

  readonly requiredDocuments = [
    { key: "driverLicenseImage", label: "Driver License", required: true },
    {
      key: "insuranceImage",
      label: "National Insurance Document",
      required: true,
    },
    { key: "addressProofImage", label: "Address Proof", required: true },
    { key: "passportImage", label: "Passport/ID Document", required: false },
    {
      key: "rightToWorkImage",
      label: "Right to Work Document",
      required: false,
    },
  ];

  readonly emergencyContactRelationships = [
    "Parent",
    "Spouse",
    "Partner",
    "Sibling",
    "Child",
    "Friend",
    "Other",
  ];

  ngOnInit(): void {
    this.initializeForm();
    this.validateTokenFromRoute();
  }

  private initializeForm(): void {
    this.registrationForm = this.formBuilder.group({
      // Personal Information
      email: ["", [Validators.email]],
      dateOfBirth: ["", [Validators.required]],

      // Address Information
      address: ["", [Validators.required, Validators.minLength(10)]],
      postalCode: [
        "",
        [
          Validators.required,
          Validators.pattern(/^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i),
        ],
      ],

      // Documents
      insuranceNumber: [
        "",
        [
          Validators.required,
          Validators.pattern(
            /^[A-CEGHJ-PR-TW-Z]{1}[A-CEGHJ-NPR-TW-Z]{1}[0-9]{6}[A-D]{1}$/i
          ),
        ],
      ],
      driverLicense: ["", [Validators.required]],
      driverLicenseExpiry: ["", [Validators.required]],

      // Emergency Contact
      emergencyContactName: ["", [Validators.required]],
      emergencyContactPhone: [
        "",
        [Validators.required, Validators.pattern(/^\+?[1-9]\d{1,14}$/)],
      ],
      emergencyContactRelationship: ["", [Validators.required]],

      // Additional Information
      comments: [""],
    });
  }

  private validateTokenFromRoute(): void {
    const token = this.route.snapshot.paramMap.get("token");
    if (!token) {
      this.error.set("Invalid registration link. Please contact support.");
      return;
    }

    this.isLoading.set(true);
    this.candidateService.validateToken(token).subscribe({
      next: (response) => {
        this.candidateInfo.set(response);
        this.isLoading.set(false);

        // If registration is already completed, show success message
        if (response.alreadyCompleted) {
          this.success.set(
            "Your registration has already been completed successfully!"
          );
        }
      },
      error: (error) => {
        this.error.set(
          error.error?.message || "Invalid or expired registration link."
        );
        this.isLoading.set(false);
      },
    });
  }

  onFileSelected(event: Event, documentKey: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      this.error.set("Please select an image file.");
      return;
    }

    // Validate file size (10MB limit - increased for better quality)
    if (file.size > 10 * 1024 * 1024) {
      this.error.set("File size must be less than 10MB.");
      return;
    }

    this.compressAndProcessImage(file, documentKey);
  }

  private compressAndProcessImage(file: File, documentKey: string): void {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions (max 1920x1080 for good quality but smaller size)
      const maxWidth = 1920;
      const maxHeight = 1080;
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);

      // Convert to base64 with compression (0.8 quality for good balance)
      const compressedBase64 = canvas.toDataURL("image/jpeg", 0.8);
      const preview = compressedBase64;

      this.uploadedFiles.update((files) => ({
        ...files,
        [documentKey]: {
          file,
          preview,
          base64: compressedBase64.split(",")[1],
        },
      }));

      this.error.set("");
    };

    img.onerror = () => {
      this.error.set("Failed to process image. Please try another file.");
    };

    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  }

  removeFile(documentKey: string): void {
    this.uploadedFiles.update((files) => {
      const newFiles = { ...files };
      delete newFiles[documentKey];
      return newFiles;
    });
  }

  nextStep(): void {
    if (this.currentStep() < this.totalSteps()) {
      this.currentStep.update((step) => step + 1);
    }
  }

  previousStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update((step) => step - 1);
    }
  }

  isStepValid(step: number): boolean {
    switch (step) {
      case 1: // Personal Information
        return this.registrationForm.get("dateOfBirth")?.valid ?? false;
      case 2: // Address Information
        return (
          (this.registrationForm.get("address")?.valid ?? false) &&
          (this.registrationForm.get("postalCode")?.valid ?? false)
        );
      case 3: // Documents & Emergency Contact
        return (
          (this.registrationForm.get("insuranceNumber")?.valid ?? false) &&
          (this.registrationForm.get("driverLicense")?.valid ?? false) &&
          (this.registrationForm.get("driverLicenseExpiry")?.valid ?? false) &&
          (this.registrationForm.get("emergencyContactName")?.valid ?? false) &&
          (this.registrationForm.get("emergencyContactPhone")?.valid ??
            false) &&
          (this.registrationForm.get("emergencyContactRelationship")?.valid ??
            false)
        );
      case 4: {
        // File Uploads
        const requiredFiles = this.requiredDocuments.filter(
          (doc) => doc.required
        );
        return requiredFiles.every((doc) => this.uploadedFiles()[doc.key]);
      }
      default:
        return false;
    }
  }

  onSubmit(): void {
    // Check if registration is already completed
    if (this.candidateInfo()?.alreadyCompleted) {
      this.error.set("Registration has already been completed.");
      return;
    }

    if (!this.registrationForm.valid) {
      this.markFormGroupTouched();
      return;
    }

    const requiredFiles = this.requiredDocuments.filter((doc) => doc.required);
    const hasAllRequiredFiles = requiredFiles.every(
      (doc) => this.uploadedFiles()[doc.key]
    );

    if (!hasAllRequiredFiles) {
      this.error.set("Please upload all required documents.");
      return;
    }

    const token = this.route.snapshot.paramMap.get("token");
    if (!token) {
      this.error.set("Invalid registration token.");
      return;
    }

    this.isSubmitting.set(true);
    this.error.set("");

    const formData = this.registrationForm.value;
    const files = this.uploadedFiles();

    const registrationData: CompleteRegistrationRequest = {
      token,
      email: formData.email || undefined,
      dateOfBirth: formData.dateOfBirth,
      address: formData.address,
      postalCode: formData.postalCode,
      insuranceNumber: formData.insuranceNumber,
      driverLicense: formData.driverLicense,
      driverLicenseExpiry: formData.driverLicenseExpiry,
      emergencyContactName: formData.emergencyContactName,
      emergencyContactPhone: formData.emergencyContactPhone,
      emergencyContactRelationship: formData.emergencyContactRelationship,
      driverLicenseImage: files["driverLicenseImage"]?.base64 || "",
      insuranceImage: files["insuranceImage"]?.base64 || "",
      addressProofImage: files["addressProofImage"]?.base64 || "",
      passportImage: files["passportImage"]?.base64,
      rightToWorkImage: files["rightToWorkImage"]?.base64,
      comments: formData.comments || undefined,
    };

    this.candidateService.completeRegistration(registrationData).subscribe({
      next: (response) => {
        this.success.set(response.message);
        this.isSubmitting.set(false);
        // Optionally redirect to a success page
        setTimeout(() => {
          this.router.navigate(["/registration-success"]);
        }, 3000);
      },
      error: (error) => {
        this.error.set(
          error.error?.message || "Registration failed. Please try again."
        );
        this.isSubmitting.set(false);
      },
    });
  }

  private markFormGroupTouched(): void {
    Object.keys(this.registrationForm.controls).forEach((key) => {
      const control = this.registrationForm.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const control = this.registrationForm.get(fieldName);
    if (control?.errors && control.touched) {
      if (control.errors["required"])
        return `${this.getFieldLabel(fieldName)} is required.`;
      if (control.errors["email"]) return "Please enter a valid email address.";
      if (control.errors["pattern"])
        return `Please enter a valid ${this.getFieldLabel(fieldName)}.`;
      if (control.errors["minlength"])
        return `${this.getFieldLabel(fieldName)} is too short.`;
    }
    return "";
  }

  private getFieldLabel(fieldName: string): string {
    const labels: Record<string, string> = {
      email: "Email",
      dateOfBirth: "Date of Birth",
      address: "Address",
      postalCode: "Postal Code",
      insuranceNumber: "National Insurance Number",
      driverLicense: "Driver License Number",
      driverLicenseExpiry: "Driver License Expiry",
      emergencyContactName: "Emergency Contact Name",
      emergencyContactPhone: "Emergency Contact Phone",
      emergencyContactRelationship: "Relationship",
    };
    return labels[fieldName] || fieldName;
  }

  getProgressPercentage(): number {
    return Math.round((this.currentStep() / this.totalSteps()) * 100);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
