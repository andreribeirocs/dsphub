import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from "@angular/forms";
import { AlertService } from "../../shared/services/alert.service";
import { DriverService } from "./drivers.service";
import {
  DRIVER_STATUSES,
  Depot,
  Driver,
  DriverStatus,
  UpdateDriverRequest,
  apiErrorMessage,
} from "./drivers.model";

type DateField = "licenseExpiry" | "passportExpiry" | "rtwExpiry" | "nextCheck";
type TextField =
  | "name"
  | "phone"
  | "email"
  | "address"
  | "homeDepotId"
  | "transporterId"
  | "citizenship"
  | "contractType"
  | "licenseNumber";

const DATE_FIELDS: readonly DateField[] = ["licenseExpiry", "passportExpiry", "rtwExpiry", "nextCheck"];
const TEXT_FIELDS: readonly TextField[] = [
  "name",
  "phone",
  "email",
  "address",
  "homeDepotId",
  "transporterId",
  "citizenship",
  "contractType",
  "licenseNumber",
];

const toDateInput = (value: string | null | undefined): string => (value ? value.slice(0, 10) : "");

@Component({
  selector: "app-driver-edit-modal",
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 bg-gray-600/50 overflow-y-auto h-full w-full z-50 p-4"
      (click)="onBackdropClick($event)"
    >
      <div
        class="relative top-10 mx-auto p-6 border w-full max-w-3xl shadow-lg rounded-md bg-white"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-lg font-medium text-gray-900">Edit driver</h3>
          <button
            type="button"
            (click)="close.emit()"
            class="text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="Close"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p class="text-sm text-gray-500 mb-6">{{ driver().name }} · only changed fields are saved</p>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-6">
          <!-- Identity & contact -->
          <fieldset>
            <legend class="text-sm font-semibold text-gray-900 mb-3">Contact</legend>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="d-name" class="block text-sm font-medium text-gray-700 mb-1">Full name *</label>
                <input id="d-name" type="text" formControlName="name" [class]="inputClass('name')" />
                @if (invalid('name')) {
                  <p class="mt-1 text-sm text-red-600">Name must have 2 to 120 characters</p>
                }
              </div>
              <div>
                <label for="d-phone" class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input id="d-phone" type="tel" formControlName="phone" [class]="inputClass('phone')" />
                @if (invalid('phone')) {
                  <p class="mt-1 text-sm text-red-600">Phone must have 6 to 20 characters</p>
                }
              </div>
              <div>
                <label for="d-email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input id="d-email" type="email" formControlName="email" [class]="inputClass('email')" />
                @if (invalid('email')) {
                  <p class="mt-1 text-sm text-red-600">Enter a valid email address</p>
                }
              </div>
              <div>
                <label for="d-citizenship" class="block text-sm font-medium text-gray-700 mb-1">Citizenship</label>
                <input
                  id="d-citizenship"
                  type="text"
                  formControlName="citizenship"
                  [class]="inputClass('citizenship')"
                />
              </div>
              <div class="md:col-span-2">
                <label for="d-address" class="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input id="d-address" type="text" formControlName="address" [class]="inputClass('address')" />
                @if (invalid('address')) {
                  <p class="mt-1 text-sm text-red-600">Address cannot exceed 250 characters</p>
                }
              </div>
            </div>
          </fieldset>

          <!-- Employment -->
          <fieldset>
            <legend class="text-sm font-semibold text-gray-900 mb-3">Employment</legend>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="d-status" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select id="d-status" formControlName="status" [class]="inputClass('status')">
                  @for (status of statuses; track status) {
                    <option [value]="status">{{ status }}</option>
                  }
                </select>
              </div>
              <div>
                <label for="d-depot" class="block text-sm font-medium text-gray-700 mb-1">Home depot</label>
                <select id="d-depot" formControlName="homeDepotId" [class]="inputClass('homeDepotId')">
                  @if (!driver().homeDepotId) {
                    <option value="">No home depot</option>
                  }
                  @for (depot of depotOptions(); track depot.id) {
                    <option [value]="depot.id">{{ depot.code }} · {{ depot.name }}</option>
                  }
                </select>
              </div>
              <div>
                <label for="d-transporter" class="block text-sm font-medium text-gray-700 mb-1">
                  Amazon Transporter ID
                </label>
                <input
                  id="d-transporter"
                  type="text"
                  formControlName="transporterId"
                  [class]="inputClass('transporterId')"
                />
              </div>
              <div>
                <label for="d-contract" class="block text-sm font-medium text-gray-700 mb-1">Contract type</label>
                <input
                  id="d-contract"
                  type="text"
                  formControlName="contractType"
                  [class]="inputClass('contractType')"
                />
              </div>
            </div>
          </fieldset>

          <!-- Compliance -->
          <fieldset>
            <legend class="text-sm font-semibold text-gray-900 mb-3">Licence &amp; compliance</legend>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="d-license" class="block text-sm font-medium text-gray-700 mb-1">Licence number</label>
                <input
                  id="d-license"
                  type="text"
                  formControlName="licenseNumber"
                  [class]="inputClass('licenseNumber')"
                />
              </div>
              <div>
                <label for="d-license-expiry" class="block text-sm font-medium text-gray-700 mb-1">
                  Licence expiry
                </label>
                <input
                  id="d-license-expiry"
                  type="date"
                  formControlName="licenseExpiry"
                  [class]="inputClass('licenseExpiry')"
                />
              </div>
              <div>
                <label for="d-passport-expiry" class="block text-sm font-medium text-gray-700 mb-1">
                  Passport / visa expiry
                </label>
                <input
                  id="d-passport-expiry"
                  type="date"
                  formControlName="passportExpiry"
                  [class]="inputClass('passportExpiry')"
                />
              </div>
              <div>
                <label for="d-rtw-expiry" class="block text-sm font-medium text-gray-700 mb-1">
                  Right to work expiry
                </label>
                <input id="d-rtw-expiry" type="date" formControlName="rtwExpiry" [class]="inputClass('rtwExpiry')" />
              </div>
              <div>
                <label for="d-next-check" class="block text-sm font-medium text-gray-700 mb-1">
                  Next DVLA check
                </label>
                <input id="d-next-check" type="date" formControlName="nextCheck" [class]="inputClass('nextCheck')" />
              </div>
              <div>
                <label for="d-points" class="block text-sm font-medium text-gray-700 mb-1">Licence points</label>
                <input
                  id="d-points"
                  type="number"
                  min="0"
                  max="12"
                  step="1"
                  formControlName="points"
                  [class]="inputClass('points')"
                />
                @if (invalid('points')) {
                  <p class="mt-1 text-sm text-red-600">Points must be a whole number from 0 to 12</p>
                }
              </div>
              <div class="md:col-span-2 flex items-center gap-2">
                <input
                  id="d-endorsements"
                  type="checkbox"
                  formControlName="hasEndorsements"
                  class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label for="d-endorsements" class="text-sm text-gray-700">Has endorsements on licence</label>
              </div>
            </div>
            @if (form.invalid && form.touched) {
              <p class="mt-3 text-sm text-red-600">
                Dates that are already set cannot be cleared, and text fields have maximum lengths.
              </p>
            }
          </fieldset>

          <div class="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              (click)="close.emit()"
              [disabled]="saving()"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              [disabled]="saving()"
              class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ saving() ? "Saving..." : "Save changes" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class DriverEditModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly driverService = inject(DriverService);
  private readonly alertService = inject(AlertService);

  readonly driver = input.required<Driver>();
  readonly depots = input<Depot[]>([]);

  readonly close = output<void>();
  readonly saved = output<Driver>();

  readonly saving = signal(false);
  readonly depotOptions = signal<Depot[]>([]);
  readonly statuses = DRIVER_STATUSES;

  readonly form = this.fb.nonNullable.group({
    name: ["", [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    phone: ["", [Validators.minLength(6), Validators.maxLength(20)]],
    email: ["", [Validators.email]],
    address: ["", [Validators.maxLength(250)]],
    status: ["ACTIVE" as DriverStatus],
    homeDepotId: [""],
    transporterId: ["", [Validators.maxLength(40)]],
    citizenship: ["", [Validators.maxLength(60)]],
    contractType: ["", [Validators.maxLength(60)]],
    licenseNumber: ["", [Validators.maxLength(40)]],
    licenseExpiry: [""],
    passportExpiry: [""],
    rtwExpiry: [""],
    nextCheck: [""],
    points: [0, [Validators.required, Validators.min(0), Validators.max(12), Validators.pattern(/^\d+$/)]],
    hasEndorsements: [false],
  });

  private initial = this.form.getRawValue();

  ngOnInit(): void {
    const driver = this.driver();

    // Keep the current depot selectable even if it is not in the visible list
    const depots = this.depots();
    const current = driver.homeDepot;
    this.depotOptions.set(
      current && !depots.some((depot) => depot.id === current.id)
        ? [{ ...current, isActive: false }, ...depots]
        : depots
    );

    this.form.reset({
      name: driver.name ?? "",
      phone: driver.phone ?? "",
      email: driver.email ?? "",
      address: driver.address ?? "",
      status: driver.status,
      homeDepotId: driver.homeDepotId ?? "",
      transporterId: driver.transporterId ?? "",
      citizenship: driver.citizenship ?? "",
      contractType: driver.contractType ?? "",
      licenseNumber: driver.licenseNumber ?? "",
      licenseExpiry: toDateInput(driver.licenseExpiry),
      passportExpiry: toDateInput(driver.passportExpiry),
      rtwExpiry: toDateInput(driver.rtwExpiry),
      nextCheck: toDateInput(driver.nextCheck),
      points: driver.points ?? 0,
      hasEndorsements: driver.hasEndorsements ?? false,
    });

    // The API cannot clear a date or an existing text value that has a minimum length
    for (const field of DATE_FIELDS) {
      if (this.form.controls[field].value) {
        this.form.controls[field].addValidators(Validators.required as ValidatorFn);
      }
    }
    if (this.form.controls.phone.value) {
      this.form.controls.phone.addValidators(Validators.required as ValidatorFn);
    }
    if (this.form.controls.email.value) {
      this.form.controls.email.addValidators(Validators.required as ValidatorFn);
    }
    this.form.updateValueAndValidity();

    this.initial = this.form.getRawValue();
  }

  invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  inputClass(field: keyof typeof this.form.controls): string {
    const base =
      "w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm";
    return `${base} ${this.invalid(field) ? "border-red-300" : "border-gray-300"}`;
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget && !this.saving()) {
      this.close.emit();
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const body = this.buildChanges();
    if (Object.keys(body).length === 0) {
      this.alertService.showInfo("No changes to save");
      this.close.emit();
      return;
    }

    this.saving.set(true);
    this.driverService.updateDriver(this.driver().id, body).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.alertService.showSuccess("Driver updated", updated.name);
        this.saved.emit(updated);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.alertService.showError("Could not update driver", apiErrorMessage(err, "Please try again."));
      },
    });
  }

  private buildChanges(): UpdateDriverRequest {
    const value = this.form.getRawValue();
    const initial = this.initial;
    const body: UpdateDriverRequest = {};

    for (const field of TEXT_FIELDS) {
      const next = value[field].trim();
      if (next !== initial[field].trim() && !(field === "homeDepotId" && next === "")) {
        body[field] = next;
      }
    }
    for (const field of DATE_FIELDS) {
      if (value[field] && value[field] !== initial[field]) {
        body[field] = value[field];
      }
    }
    if (value.status !== initial.status) {
      body.status = value.status;
    }
    const points = Number(value.points);
    if (points !== Number(initial.points)) {
      body.points = points;
    }
    if (value.hasEndorsements !== initial.hasEndorsements) {
      body.hasEndorsements = value.hasEndorsements;
    }
    return body;
  }
}
