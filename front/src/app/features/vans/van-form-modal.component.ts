import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { AlertService } from "../../shared/services/alert.service";
import { VansService } from "./vans.service";
import {
  Contract,
  CreateVanRequest,
  Depot,
  Van,
  VanCondition,
  VanStatus,
} from "./vans.model";
import { apiErrorMessage } from "../../shared/utils/api-error";

export const VAN_STATUS_OPTIONS: ReadonlyArray<{ value: VanStatus; label: string }> = [
  { value: "AVAILABLE", label: "Available" },
  { value: "BOOKED", label: "Booked" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "TBC", label: "TBC" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "OUT_OF_SERVICE", label: "Out of Service" },
];

export const VAN_CONDITION_OPTIONS: ReadonlyArray<{ value: VanCondition; label: string }> = [
  { value: "EXCELLENT", label: "Excellent" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
  { value: "NEEDS_ATTENTION", label: "Needs Attention" },
];

type VanFormControl = keyof VanFormModalComponent["form"]["controls"];

/** ISO date/datetime -> yyyy-mm-dd for <input type="date"> */
const toDateInput = (value?: string | null): string => (value ? value.slice(0, 10) : "");

@Component({
  selector: "app-van-form-modal",
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 bg-gray-600/50 overflow-y-auto h-full w-full z-50"
      (click)="onBackdropClick($event)"
    >
      <div
        class="relative top-10 mx-auto mb-10 p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white"
        role="dialog"
        aria-modal="true"
        aria-labelledby="van-form-title"
      >
        <div class="flex items-center justify-between mb-6">
          <h3 id="van-form-title" class="text-lg font-medium text-gray-900">
            {{ isEdit() ? "Edit Van " + (van()?.vanNumber ?? "") : "Add Van" }}
          </h3>
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

        @if (error()) {
          <div class="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
            <p class="text-sm font-medium text-red-800 whitespace-pre-line">{{ error() }}</p>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-6">
          <!-- Identification -->
          <div>
            <h4 class="text-sm font-semibold text-gray-900 mb-3">Vehicle</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label for="vanNumber" class="block text-sm font-medium text-gray-700 mb-1">Van number *</label>
                <input id="vanNumber" type="text" formControlName="vanNumber" placeholder="03" [class]="inputClass('vanNumber')" />
                @if (showError('vanNumber')) {
                  <p class="mt-1 text-sm text-red-600">Van number is required</p>
                }
              </div>
              <div>
                <label for="registration" class="block text-sm font-medium text-gray-700 mb-1">Registration *</label>
                <input id="registration" type="text" formControlName="registration" placeholder="KN70JYR" [class]="inputClass('registration')" />
                @if (showError('registration')) {
                  <p class="mt-1 text-sm text-red-600">Registration is required</p>
                }
              </div>
              <div>
                <label for="depotId" class="block text-sm font-medium text-gray-700 mb-1">
                  Depot {{ depots().length > 0 ? "*" : "" }}
                </label>
                <select id="depotId" formControlName="depotId" [class]="inputClass('depotId')">
                  <option value="">{{ depots().length > 0 ? "Select a depot" : "No depots configured" }}</option>
                  @for (depot of depots(); track depot.id) {
                    <option [value]="depot.id">{{ depot.code }} - {{ depot.name }}</option>
                  }
                </select>
                @if (showError('depotId')) {
                  <p class="mt-1 text-sm text-red-600">Depot is required</p>
                }
              </div>
              <div>
                <label for="make" class="block text-sm font-medium text-gray-700 mb-1">Make *</label>
                <input id="make" type="text" formControlName="make" placeholder="Mercedes" list="van-makes" [class]="inputClass('make')" />
                <datalist id="van-makes">
                  <option value="Ford"></option>
                  <option value="Mercedes"></option>
                  <option value="Peugeot"></option>
                </datalist>
                @if (showError('make')) {
                  <p class="mt-1 text-sm text-red-600">Make is required</p>
                }
              </div>
              <div>
                <label for="model" class="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                <input id="model" type="text" formControlName="model" placeholder="eSPRINTER L2 20" [class]="inputClass('model')" />
                @if (showError('model')) {
                  <p class="mt-1 text-sm text-red-600">Model is required</p>
                }
              </div>
              <div>
                <label for="year" class="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input id="year" type="number" formControlName="year" placeholder="2022" [class]="inputClass('year')" />
                @if (showError('year')) {
                  <p class="mt-1 text-sm text-red-600">Enter a valid year</p>
                }
              </div>
              <div>
                <label for="vin" class="block text-sm font-medium text-gray-700 mb-1">VIN</label>
                <input id="vin" type="text" formControlName="vin" [class]="inputClass('vin')" />
              </div>
              <div>
                <label for="engineNumber" class="block text-sm font-medium text-gray-700 mb-1">Engine number</label>
                <input id="engineNumber" type="text" formControlName="engineNumber" [class]="inputClass('engineNumber')" />
              </div>
              <div>
                <label for="fuelType" class="block text-sm font-medium text-gray-700 mb-1">Fuel type</label>
                <input id="fuelType" type="text" formControlName="fuelType" placeholder="Electric" list="van-fuel-types" [class]="inputClass('fuelType')" />
                <datalist id="van-fuel-types">
                  <option value="Diesel"></option>
                  <option value="Electric"></option>
                  <option value="Hybrid"></option>
                  <option value="Petrol"></option>
                </datalist>
              </div>
              <div>
                <label for="capacity" class="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                <input id="capacity" type="text" formControlName="capacity" placeholder="L2 20" [class]="inputClass('capacity')" />
              </div>
              <div>
                <label for="mileage" class="block text-sm font-medium text-gray-700 mb-1">Mileage</label>
                <input id="mileage" type="number" min="0" step="1" formControlName="mileage" [class]="inputClass('mileage')" />
                @if (showError('mileage')) {
                  <p class="mt-1 text-sm text-red-600">Mileage must be a whole number of 0 or more</p>
                }
              </div>
              <div>
                <label for="assignedDriver" class="block text-sm font-medium text-gray-700 mb-1">Assigned driver</label>
                <input id="assignedDriver" type="text" formControlName="assignedDriver" [class]="inputClass('assignedDriver')" />
              </div>
            </div>
          </div>

          <!-- Status & contract -->
          <div>
            <h4 class="text-sm font-semibold text-gray-900 mb-3">Status & contract</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label for="status" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select id="status" formControlName="status" [class]="inputClass('status')">
                  @for (option of statusOptions; track option.value) {
                    <option [value]="option.value">{{ option.label }}</option>
                  }
                </select>
              </div>
              <div>
                <label for="condition" class="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                <select id="condition" formControlName="condition" [class]="inputClass('condition')">
                  @for (option of conditionOptions; track option.value) {
                    <option [value]="option.value">{{ option.label }}</option>
                  }
                </select>
              </div>
              <div>
                <label for="contractId" class="block text-sm font-medium text-gray-700 mb-1">Contract</label>
                <select id="contractId" formControlName="contractId" [class]="inputClass('contractId')">
                  <option value="">Unassigned</option>
                  @for (contract of contracts(); track contract.id) {
                    <option [value]="contract.id">{{ contract.name }} ({{ contract.hireName }})</option>
                  }
                </select>
              </div>
              <div>
                <label for="monthlyRental" class="block text-sm font-medium text-gray-700 mb-1">Monthly rental (£)</label>
                <input id="monthlyRental" type="number" min="0" step="0.01" formControlName="monthlyRental" placeholder="399.00" [class]="inputClass('monthlyRental')" />
                @if (showError('monthlyRental')) {
                  <p class="mt-1 text-sm text-red-600">Enter a valid amount</p>
                }
              </div>
            </div>
          </div>

          <!-- Dates -->
          <div>
            <h4 class="text-sm font-semibold text-gray-900 mb-3">MOT & service</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label for="motExpiry" class="block text-sm font-medium text-gray-700 mb-1">MOT expiry</label>
                <input id="motExpiry" type="date" formControlName="motExpiry" [class]="inputClass('motExpiry')" />
              </div>
              <div>
                <label for="lastService" class="block text-sm font-medium text-gray-700 mb-1">Last service</label>
                <input id="lastService" type="date" formControlName="lastService" [class]="inputClass('lastService')" />
              </div>
              <div>
                <label for="nextService" class="block text-sm font-medium text-gray-700 mb-1">Next service</label>
                <input id="nextService" type="date" formControlName="nextService" [class]="inputClass('nextService')" />
              </div>
              <div class="md:col-span-3">
                <label class="inline-flex items-center text-sm text-gray-700">
                  <input type="checkbox" formControlName="motReminder" class="h-4 w-4 text-blue-600 border-gray-300 rounded mr-2" />
                  MOT reminder enabled
                </label>
              </div>
            </div>
          </div>

          <div>
            <label for="comments" class="block text-sm font-medium text-gray-700 mb-1">Comments</label>
            <textarea id="comments" rows="3" formControlName="comments" [class]="inputClass('comments')"></textarea>
          </div>

          @if (isEdit()) {
            <p class="text-xs text-gray-500">
              Clearing VIN, engine number, fuel type, capacity, driver, rental or dates does not remove the stored value.
            </p>
          }

          <div class="flex justify-end space-x-3 pt-2">
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
              @if (saving()) { Saving... } @else { {{ isEdit() ? "Save changes" : "Create van" }} }
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class VanFormModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly vansService = inject(VansService);
  private readonly alertService = inject(AlertService);

  /** Van to edit; null creates a new van */
  readonly van = input<Van | null>(null);
  readonly depots = input<readonly Depot[]>([]);
  readonly contracts = input<readonly Contract[]>([]);

  readonly close = output<void>();
  readonly saved = output<Van>();

  readonly isEdit = computed(() => this.van() !== null);
  readonly saving = signal(false);
  readonly error = signal("");

  readonly statusOptions = VAN_STATUS_OPTIONS;
  readonly conditionOptions = VAN_CONDITION_OPTIONS;

  readonly form = this.fb.nonNullable.group({
    vanNumber: ["", [Validators.required, Validators.maxLength(20)]],
    registration: ["", [Validators.required, Validators.maxLength(20)]],
    make: ["", [Validators.required]],
    model: ["", [Validators.required]],
    year: this.fb.control<number | null>(null, [Validators.min(1950), Validators.max(2100)]),
    depotId: [""],
    status: this.fb.nonNullable.control<VanStatus>("AVAILABLE"),
    condition: this.fb.nonNullable.control<VanCondition>("GOOD"),
    contractId: [""],
    monthlyRental: this.fb.control<number | null>(null, [Validators.min(0)]),
    motExpiry: [""],
    motReminder: [true],
    vin: [""],
    engineNumber: [""],
    fuelType: [""],
    capacity: [""],
    mileage: this.fb.control<number | null>(null, [Validators.min(0), Validators.pattern(/^\d+$/)]),
    assignedDriver: [""],
    lastService: [""],
    nextService: [""],
    comments: [""],
  });

  ngOnInit(): void {
    if (this.depots().length > 0) {
      this.form.controls.depotId.addValidators(Validators.required);
    }

    const van = this.van();
    if (van) {
      const rental = van.monthlyRental === null || van.monthlyRental === undefined ? null : Number(van.monthlyRental);
      this.form.patchValue({
        vanNumber: van.vanNumber,
        registration: van.registration,
        make: van.make,
        model: van.model,
        year: van.year ?? null,
        depotId: van.depotId ?? "",
        status: van.status,
        condition: van.condition,
        contractId: van.contractId ?? "",
        monthlyRental: rental !== null && Number.isFinite(rental) ? rental : null,
        motExpiry: toDateInput(van.motExpiry),
        motReminder: van.motReminder ?? true,
        vin: van.vin ?? "",
        engineNumber: van.engineNumber ?? "",
        fuelType: van.fuelType ?? "",
        capacity: van.capacity ?? "",
        mileage: van.mileage ?? null,
        assignedDriver: van.assignedDriver ?? "",
        lastService: toDateInput(van.lastService),
        nextService: toDateInput(van.nextService),
        comments: van.comments ?? "",
      });
    }
    this.form.controls.depotId.updateValueAndValidity();
  }

  inputClass(control: VanFormControl): string {
    const base =
      "w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm";
    return this.showError(control) ? `${base} border-red-300` : `${base} border-gray-300`;
  }

  showError(control: VanFormControl): boolean {
    const c = this.form.controls[control];
    return c.invalid && c.touched;
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
    if (this.saving()) {
      return;
    }

    const v = this.form.getRawValue();
    const text = (value: string): string | undefined => value.trim() || undefined;
    const editing = this.van();

    const payload: CreateVanRequest = {
      vanNumber: v.vanNumber.trim(),
      registration: v.registration.trim().toUpperCase(),
      make: v.make.trim(),
      model: v.model.trim(),
      status: v.status,
      condition: v.condition,
      motReminder: v.motReminder,
      // On update null clears year/mileage; on create just omit them
      year: v.year !== null ? Math.trunc(v.year) : editing ? null : undefined,
      mileage: v.mileage !== null ? Math.trunc(v.mileage) : editing ? null : undefined,
      // On update "" disconnects depot/contract
      depotId: v.depotId || (editing ? "" : undefined),
      contractId: v.contractId || (editing ? "" : undefined),
      monthlyRental: v.monthlyRental !== null ? Number(v.monthlyRental).toFixed(2) : undefined,
      motExpiry: v.motExpiry || undefined,
      lastService: v.lastService || undefined,
      nextService: v.nextService || undefined,
      vin: text(v.vin),
      engineNumber: text(v.engineNumber),
      fuelType: text(v.fuelType),
      capacity: text(v.capacity),
      assignedDriver: text(v.assignedDriver),
      comments: editing ? v.comments.trim() : text(v.comments),
    };

    // Drop undefined keys so the strict API validation only sees real fields
    const body = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    ) as unknown as CreateVanRequest;

    this.saving.set(true);
    this.error.set("");

    const request$ = editing
      ? this.vansService.updateVan(editing.id, body)
      : this.vansService.createVan(body);

    request$.subscribe({
      next: (van) => {
        this.saving.set(false);
        this.alertService.showSuccess(
          editing ? "Van updated" : "Van created",
          `${van.vanNumber} - ${van.registration}`
        );
        this.saved.emit(van);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const message = apiErrorMessage(err, editing ? "Failed to update van" : "Failed to create van");
        this.error.set(message);
        this.alertService.showError(editing ? "Failed to update van" : "Failed to create van", message);
      },
    });
  }
}
