import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  inject,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  FormGroup,
  FormArray,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { OrganizationsService } from "./organizations.service";
import type {
  Organization,
  CreateOrganizationDto,
  UpdateOrganizationDto,
  Depot,
} from "./organizations.model";

@Component({
  selector: "app-organization-form",
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./organization-form.component.html",
  styleUrls: ["./organization-form.component.scss"],
})
export class OrganizationFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly organizationsService = inject(OrganizationsService);

  @Input() organization: Organization | null = null;
  @Output() cancel = new EventEmitter<void>();
  @Output() success = new EventEmitter<void>();

  readonly form: FormGroup;
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly logoPreview = signal<string | null>(null);

  constructor() {
    this.form = this.fb.group({
      name: ["", [Validators.required]],
      slug: ["", [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
      address: [""],
      city: [""],
      postcode: [""],
      country: ["United Kingdom"],
      phone: [""],
      email: ["", [Validators.email]],
      website: [""],
      taxId: [""],
      registrationNumber: [""],
      vatNumber: [""],
      companyRegNumber: [""],
      logoBase64: [""],
      bankName: [""],
      bankAccountNumber: [""],
      bankSortCode: [""],
      iban: [""],
      swiftCode: [""],
      termsAndConditions: [""],
      footerText: [""],
      invoicePrefix: ["INV"],
      invoiceFooter: [""],
      depots: this.fb.array([]),
      isActive: [true],
    });
  }

  ngOnInit(): void {
    if (this.organization) {
      this.populateForm();
    } else {
      // Add one empty depot by default for new organizations
      this.addDepot();
    }
  }

  get depots(): FormArray {
    return this.form.get("depots") as FormArray;
  }

  populateForm(): void {
    if (!this.organization) return;

    this.form.patchValue({
      name: this.organization.name,
      slug: this.organization.slug,
      address: this.organization.address,
      city: this.organization.city,
      postcode: this.organization.postcode,
      country: this.organization.country,
      phone: this.organization.phone,
      email: this.organization.email,
      website: this.organization.website,
      taxId: this.organization.taxId,
      registrationNumber: this.organization.registrationNumber,
      vatNumber: this.organization.vatNumber,
      companyRegNumber: this.organization.companyRegNumber,
      logoBase64: this.organization.logoBase64,
      bankName: this.organization.bankName,
      bankAccountNumber: this.organization.bankAccountNumber,
      bankSortCode: this.organization.bankSortCode,
      iban: this.organization.iban,
      swiftCode: this.organization.swiftCode,
      termsAndConditions: this.organization.termsAndConditions,
      footerText: this.organization.footerText,
      invoicePrefix: this.organization.invoicePrefix,
      invoiceFooter: this.organization.invoiceFooter,
      isActive: this.organization.isActive,
    });

    if (this.organization.logoBase64) {
      this.logoPreview.set(
        `data:image/png;base64,${this.organization.logoBase64}`
      );
    }

    // Populate depots
    if (this.organization.depots && Array.isArray(this.organization.depots)) {
      this.organization.depots.forEach((depot: Depot) => {
        this.addDepot(depot);
      });
    }
  }

  addDepot(depot?: Depot): void {
    const depotGroup = this.fb.group({
      name: [depot?.name || "", [Validators.required]],
      address: [depot?.address || "", [Validators.required]],
    });
    this.depots.push(depotGroup);
  }

  removeDepot(index: number): void {
    this.depots.removeAt(index);
  }

  onLogoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      this.error.set("Logo file size must be less than 2MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      this.error.set("Please select a valid image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      this.form.patchValue({ logoBase64: base64 });
      this.logoPreview.set(reader.result as string);
      this.error.set(null);
    };
    reader.readAsDataURL(file);
  }

  removeLogo(): void {
    this.form.patchValue({ logoBase64: "" });
    this.logoPreview.set(null);
  }

  generateSlug(): void {
    const name = this.form.get("name")?.value;
    if (name) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      this.form.patchValue({ slug });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set("Please fill in all required fields correctly");
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const formValue = this.form.value;
    const dto: CreateOrganizationDto | UpdateOrganizationDto = {
      ...formValue,
      depots: formValue.depots.length > 0 ? formValue.depots : undefined,
    };

    const request = this.organization
      ? this.organizationsService.update(this.organization.id, dto)
      : this.organizationsService.create(dto as CreateOrganizationDto);

    request.subscribe({
      next: () => {
        this.submitting.set(false);
        this.success.emit();
      },
      error: (err) => {
        console.error("Failed to save organization:", err);
        this.error.set(
          err.error?.message || "Failed to save organization. Please try again."
        );
        this.submitting.set(false);
      },
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
