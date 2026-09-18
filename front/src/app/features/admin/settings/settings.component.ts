import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { OrganizationsService } from "../../organizations/organizations.service";
import type {
  DepotRecord,
  OperatingModel,
  Organization,
  UpdateOrganizationDto,
} from "../../organizations/organizations.model";
import { AlertService } from "../../../shared/services/alert.service";
import {
  ServiceTypesService,
  type ServiceTypeRecord,
} from "./service-types.service";

const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof HttpErrorResponse) {
    const message: unknown = error.error?.message;
    if (Array.isArray(message) && message.length > 0) return message.join(". ");
    if (typeof message === "string" && message) return message;
  }
  return fallback;
};

const INPUT =
  "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

@Component({
  selector: "app-settings",
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">DSP Settings</h1>
        <p class="text-gray-600 mt-1">
          Company details, invoicing, operating model and depots of this DSP
        </p>
      </div>

      @if (loading()) {
        <div class="flex justify-center py-16">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      } @else if (loadError()) {
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p class="text-sm text-red-600 mb-3">{{ loadError() }}</p>
          <button
            class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            (click)="loadOrganization()"
          >
            Retry
          </button>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="saveSettings()" class="space-y-6">
          <!-- Company details -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-1">Company Details</h2>
            <p class="text-sm text-gray-500 mb-4">
              Name, address, phone, company registration and VAT numbers are printed on driver invoices.
            </p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="s-name" class="block text-sm font-medium text-gray-700 mb-2">Company name *</label>
                <input id="s-name" type="text" formControlName="name" [class]="inputClass"
                  [class.border-red-300]="form.controls.name.invalid && form.controls.name.touched" />
                @if (form.controls.name.invalid && form.controls.name.touched) {
                  <p class="mt-1 text-sm text-red-600">Company name is required</p>
                }
              </div>
              <div>
                <label for="s-email" class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input id="s-email" type="email" formControlName="email" [class]="inputClass" />
                @if (form.controls.email.invalid && form.controls.email.touched) {
                  <p class="mt-1 text-sm text-red-600">Please provide a valid email address</p>
                }
              </div>
              <div>
                <label for="s-phone" class="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input id="s-phone" type="tel" formControlName="phone" [class]="inputClass" />
              </div>
              <div>
                <label for="s-website" class="block text-sm font-medium text-gray-700 mb-2">Website</label>
                <input id="s-website" type="text" formControlName="website" placeholder="https://" [class]="inputClass" />
              </div>
              <div class="md:col-span-2">
                <label for="s-address" class="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <input id="s-address" type="text" formControlName="address" [class]="inputClass" />
              </div>
              <div>
                <label for="s-city" class="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input id="s-city" type="text" formControlName="city" [class]="inputClass" />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="s-postcode" class="block text-sm font-medium text-gray-700 mb-2">Postcode</label>
                  <input id="s-postcode" type="text" formControlName="postcode" [class]="inputClass" />
                </div>
                <div>
                  <label for="s-country" class="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <input id="s-country" type="text" formControlName="country" [class]="inputClass" />
                </div>
              </div>
              <div>
                <label for="s-companyreg" class="block text-sm font-medium text-gray-700 mb-2">Company registration number</label>
                <input id="s-companyreg" type="text" formControlName="companyRegNumber" [class]="inputClass" />
              </div>
              <div>
                <label for="s-vat" class="block text-sm font-medium text-gray-700 mb-2">VAT number</label>
                <input id="s-vat" type="text" formControlName="vatNumber" [class]="inputClass" />
              </div>
            </div>
          </div>

          <!-- Operating model -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-1">Operating Model</h2>
            <p class="text-sm text-gray-500 mb-4">How vans are allocated to drivers in this DSP.</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              @for (option of operatingModels; track option.value) {
                <label
                  class="flex gap-3 p-4 border rounded-lg cursor-pointer transition-colors"
                  [class.border-blue-500]="form.controls.operatingModel.value === option.value"
                  [class.bg-blue-50]="form.controls.operatingModel.value === option.value"
                  [class.border-gray-200]="form.controls.operatingModel.value !== option.value"
                >
                  <input
                    type="radio"
                    formControlName="operatingModel"
                    [value]="option.value"
                    class="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span>
                    <span class="block text-sm font-medium text-gray-900">{{ option.label }}</span>
                    <span class="block text-sm text-gray-500">{{ option.description }}</span>
                  </span>
                </label>
              }
            </div>
          </div>

          <!-- Invoicing -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Invoicing</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <span class="block text-sm font-medium text-gray-700 mb-2">Logo (printed on invoices)</span>
                <div class="flex items-center gap-4">
                  <div class="h-16 w-32 border border-gray-200 rounded-md flex items-center justify-center bg-gray-50 overflow-hidden">
                    @if (logoPreview()) {
                      <img [src]="logoPreview()" alt="Company logo" class="max-h-full max-w-full object-contain" />
                    } @else {
                      <span class="text-xs text-gray-400">No logo</span>
                    }
                  </div>
                  <div class="flex flex-col gap-1 items-start">
                    <label class="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
                      Upload logo
                      <input type="file" accept="image/png,image/jpeg" class="sr-only" (change)="onLogoSelected($event)" />
                    </label>
                    @if (logoPreview()) {
                      <button type="button" class="text-sm text-red-600 hover:text-red-800" (click)="removeLogo()">Remove</button>
                    }
                    <span class="text-xs text-gray-400">PNG or JPG, max 2 MB</span>
                  </div>
                </div>
              </div>
              <div>
                <label for="s-prefix" class="block text-sm font-medium text-gray-700 mb-2">Invoice number prefix</label>
                <input id="s-prefix" type="text" formControlName="invoicePrefix" placeholder="INV" [class]="inputClass" />
              </div>
              <div class="md:col-span-2">
                <label for="s-invoice-footer" class="block text-sm font-medium text-gray-700 mb-2">Invoice footer</label>
                <textarea id="s-invoice-footer" rows="2" formControlName="invoiceFooter" [class]="inputClass"></textarea>
              </div>
              <div class="md:col-span-2">
                <label for="s-terms" class="block text-sm font-medium text-gray-700 mb-2">Terms and conditions</label>
                <textarea id="s-terms" rows="3" formControlName="termsAndConditions" [class]="inputClass"></textarea>
              </div>
            </div>
          </div>

          <!-- Bank details -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Bank Details</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="s-bank" class="block text-sm font-medium text-gray-700 mb-2">Bank name</label>
                <input id="s-bank" type="text" formControlName="bankName" [class]="inputClass" />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="s-account" class="block text-sm font-medium text-gray-700 mb-2">Account number</label>
                  <input id="s-account" type="text" formControlName="bankAccountNumber" [class]="inputClass" />
                </div>
                <div>
                  <label for="s-sort" class="block text-sm font-medium text-gray-700 mb-2">Sort code</label>
                  <input id="s-sort" type="text" formControlName="bankSortCode" [class]="inputClass" />
                </div>
              </div>
              <div>
                <label for="s-iban" class="block text-sm font-medium text-gray-700 mb-2">IBAN</label>
                <input id="s-iban" type="text" formControlName="iban" [class]="inputClass" />
              </div>
              <div>
                <label for="s-swift" class="block text-sm font-medium text-gray-700 mb-2">SWIFT / BIC</label>
                <input id="s-swift" type="text" formControlName="swiftCode" [class]="inputClass" />
              </div>
            </div>
          </div>

          <!-- Save -->
          <div class="flex justify-end items-center gap-4">
            @if (form.dirty) {
              <span class="text-sm text-gray-500">You have unsaved changes</span>
              <button
                type="button"
                (click)="resetForm()"
                [disabled]="saving()"
                class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Discard
              </button>
            }
            <button
              type="submit"
              [disabled]="saving() || !form.dirty"
              class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ saving() ? "Saving..." : "Save Settings" }}
            </button>
          </div>
        </form>

        <!-- Depots -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 mt-6 overflow-hidden">
          <div class="flex flex-wrap gap-4 justify-between items-center p-6">
            <div>
              <h2 class="text-xl font-semibold text-gray-900">Depots</h2>
              <p class="text-sm text-gray-500">Amazon stations this DSP operates from. Changes here are saved immediately.</p>
            </div>
            <button
              type="button"
              (click)="openDepotForm(null)"
              class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Add Depot
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Drivers / Vans</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                @if (depotsError()) {
                  <tr>
                    <td colspan="6" class="px-6 py-8 text-center">
                      <p class="text-sm text-red-600 mb-3">{{ depotsError() }}</p>
                      <button
                        class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        (click)="loadDepots()"
                      >
                        Retry
                      </button>
                    </td>
                  </tr>
                } @else {
                  @for (depot of depots(); track depot.id) {
                    <tr class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ depot.code }}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ depot.name }}</td>
                      <td class="px-6 py-4 text-sm text-gray-500">
                        {{ depotAddress(depot) }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {{ depot._count?.homeDrivers ?? 0 }} / {{ depot._count?.vans ?? 0 }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          [class]="depot.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'"
                        >
                          {{ depot.isActive ? "Active" : "Inactive" }}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div class="flex justify-end space-x-3">
                          <button type="button" class="text-blue-600 hover:text-blue-900" (click)="openDepotForm(depot)">Edit</button>
                          <button
                            type="button"
                            [disabled]="busyDepotId() === depot.id"
                            class="text-yellow-600 hover:text-yellow-900 disabled:opacity-50"
                            (click)="toggleDepot(depot)"
                          >
                            {{ depot.isActive ? "Deactivate" : "Activate" }}
                          </button>
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="6" class="px-6 py-8 text-center text-sm text-gray-500">
                        @if (depotsLoading()) {
                          <div class="flex justify-center">
                            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          </div>
                        } @else {
                          No depots yet. Add the stations this DSP works from.
                        }
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- Service types -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 mt-6 overflow-hidden">
        <div class="flex flex-wrap gap-4 justify-between items-center p-6">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Service types</h2>
            <p class="text-sm text-gray-500">
              The kinds of work this DSP offers. Changes here are saved immediately.
            </p>
          </div>
          <button
            type="button"
            (click)="openServiceTypeForm(null)"
            class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Add service type
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              @if (serviceTypesError()) {
                <tr>
                  <td colspan="5" class="px-6 py-8 text-center">
                    <p class="text-sm text-red-600 mb-3">{{ serviceTypesError() }}</p>
                    <button type="button" class="text-sm text-blue-600 hover:underline" (click)="loadServiceTypes()">
                      Try again
                    </button>
                  </td>
                </tr>
              } @else {
                @for (serviceType of serviceTypes(); track serviceType.id) {
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{{ serviceType.code }}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ serviceType.name }}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {{ serviceType.hours != null ? serviceType.hours : "—" }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span
                        class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                        [class]="serviceType.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'"
                      >
                        {{ serviceType.isActive ? "Active" : "Inactive" }}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div class="flex gap-3 justify-end">
                        <button type="button" class="text-blue-600 hover:text-blue-900" (click)="openServiceTypeForm(serviceType)">
                          Edit
                        </button>
                        <button
                          type="button"
                          [disabled]="busyServiceTypeId() === serviceType.id"
                          class="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                          (click)="toggleServiceType(serviceType)"
                        >
                          {{ serviceType.isActive ? "Deactivate" : "Activate" }}
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="px-6 py-8 text-center text-sm text-gray-500">
                      @if (serviceTypesLoading()) {
                        Loading service types...
                      } @else {
                        No service types yet.
                      }
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Service type modal -->
      @if (serviceTypeFormOpen()) {
        <div class="fixed inset-0 bg-gray-600/50 overflow-y-auto h-full w-full z-50" (click)="closeServiceTypeForm()">
          <div
            class="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white"
            (click)="$event.stopPropagation()"
          >
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
              {{ editingServiceType() ? "Edit service type" : "Add service type" }}
            </h3>
            <form [formGroup]="serviceTypeForm" (ngSubmit)="saveServiceType()" class="space-y-4">
              @if (serviceTypeFormError()) {
                <p class="text-sm text-red-600">{{ serviceTypeFormError() }}</p>
              }
              <div>
                <label for="st-code" class="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input id="st-code" type="text" formControlName="code" placeholder="STANDARD_PARCEL_9H" [class]="inputClass" />
                @if (editingServiceType()) {
                  <p class="mt-1 text-xs text-gray-500">
                    The code cannot be changed: payment records refer to it.
                  </p>
                } @else {
                  <p class="mt-1 text-xs text-gray-500">Upper case, letters, digits and underscores.</p>
                }
              </div>
              <div>
                <label for="st-name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input id="st-name" type="text" formControlName="name" placeholder="Standard Parcel 9h" [class]="inputClass" />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="st-hours" class="block text-sm font-medium text-gray-700 mb-1">Hours</label>
                  <input id="st-hours" type="text" formControlName="hours" placeholder="9" [class]="inputClass" />
                </div>
                <div>
                  <label for="st-order" class="block text-sm font-medium text-gray-700 mb-1">Order</label>
                  <input id="st-order" type="text" formControlName="sortOrder" placeholder="10" [class]="inputClass" />
                </div>
              </div>
              <div class="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  (click)="closeServiceTypeForm()"
                  [disabled]="serviceTypeSaving()"
                  class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  [disabled]="serviceTypeSaving()"
                  class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {{ serviceTypeSaving() ? "Saving..." : "Save" }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Depot modal -->
      @if (depotFormOpen()) {
        <div class="fixed inset-0 bg-gray-600/50 overflow-y-auto h-full w-full z-50" (click)="closeDepotForm()">
          <div
            class="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white"
            (click)="$event.stopPropagation()"
          >
            <h3 class="text-lg font-medium text-gray-900 mb-4">
              {{ editingDepot() ? "Edit Depot" : "Add Depot" }}
            </h3>
            <form [formGroup]="depotForm" (ngSubmit)="saveDepot()" class="space-y-4">
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <label for="d-code" class="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <input id="d-code" type="text" formControlName="code" placeholder="DXW2" [class]="inputClass + ' uppercase'" />
                </div>
                <div class="col-span-2">
                  <label for="d-name" class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input id="d-name" type="text" formControlName="name" placeholder="Weybridge" [class]="inputClass" />
                </div>
              </div>
              @if (depotForm.controls.code.invalid && depotForm.controls.code.touched) {
                <p class="text-sm text-red-600">Code must be 2–20 letters, numbers or -</p>
              }
              @if (depotForm.controls.name.invalid && depotForm.controls.name.touched) {
                <p class="text-sm text-red-600">Name must be between 2 and 100 characters</p>
              }
              <div>
                <label for="d-address" class="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input id="d-address" type="text" formControlName="address" [class]="inputClass" />
              </div>
              <div>
                <label for="d-postcode" class="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                <input id="d-postcode" type="text" formControlName="postcode" [class]="inputClass + ' uppercase'" />
              </div>
              @if (depotFormError()) {
                <p class="text-sm text-red-600">{{ depotFormError() }}</p>
              }
              <div class="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  (click)="closeDepotForm()"
                  [disabled]="depotSaving()"
                  class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  [disabled]="depotForm.invalid || depotSaving()"
                  class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ depotSaving() ? "Saving..." : editingDepot() ? "Save Depot" : "Add Depot" }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  private readonly organizationsService = inject(OrganizationsService);
  private readonly alertService = inject(AlertService);
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly fb = inject(FormBuilder);

  readonly inputClass = INPUT;
  readonly operatingModels: { value: OperatingModel; label: string; description: string }[] = [
    {
      value: "DSP_1_0",
      label: "DSP 1.0",
      description: "The driver rents a van weekly and keeps it 24/7.",
    },
    {
      value: "DSP_2_0",
      label: "DSP 2.0",
      description: "Vans stay in a depot pool and are picked up daily.",
    },
  ];

  readonly organization = signal<Organization | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal("");
  readonly saving = signal(false);
  readonly logoPreview = signal<string | null>(null);

  readonly depots = signal<DepotRecord[]>([]);
  readonly depotsLoading = signal(false);
  readonly depotsError = signal("");
  readonly busyDepotId = signal<string | null>(null);
  readonly depotFormOpen = signal(false);
  readonly editingDepot = signal<DepotRecord | null>(null);
  readonly depotSaving = signal(false);
  readonly depotFormError = signal("");

  readonly serviceTypes = signal<ServiceTypeRecord[]>([]);
  readonly serviceTypesLoading = signal(false);
  readonly serviceTypesError = signal("");
  readonly busyServiceTypeId = signal<string | null>(null);
  readonly serviceTypeFormOpen = signal(false);
  readonly editingServiceType = signal<ServiceTypeRecord | null>(null);
  readonly serviceTypeSaving = signal(false);
  readonly serviceTypeFormError = signal("");

  readonly form = this.fb.nonNullable.group({
    name: ["", [Validators.required]],
    email: ["", [Validators.email]],
    phone: [""],
    website: [""],
    address: [""],
    city: [""],
    postcode: [""],
    country: [""],
    companyRegNumber: [""],
    vatNumber: [""],
    operatingModel: ["DSP_1_0" as OperatingModel],
    logoBase64: [""],
    invoicePrefix: [""],
    invoiceFooter: [""],
    termsAndConditions: [""],
    bankName: [""],
    bankAccountNumber: [""],
    bankSortCode: [""],
    iban: [""],
    swiftCode: [""],
  });

  readonly depotForm = this.fb.nonNullable.group({
    code: [
      "",
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(20),
        Validators.pattern(/^[A-Za-z0-9-]+$/),
      ],
    ],
    name: ["", [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    address: ["", [Validators.maxLength(200)]],
    postcode: ["", [Validators.maxLength(12)]],
  });

  readonly serviceTypeForm = this.fb.nonNullable.group({
    code: [
      "",
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(60),
        Validators.pattern(/^[A-Z][A-Z0-9_]*$/),
      ],
    ],
    name: ["", [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    hours: ["", [Validators.pattern(/^\d{1,2}(\.\d)?$/)]],
    sortOrder: ["", [Validators.pattern(/^\d{1,4}$/)]],
  });

  ngOnInit(): void {
    this.loadOrganization();
    this.loadServiceTypes();
  }

  loadOrganization(): void {
    this.loading.set(true);
    this.loadError.set("");
    this.organizationsService.getCurrent().subscribe({
      next: (organization) => {
        this.organization.set(organization);
        this.resetForm();
        this.loading.set(false);
        this.loadDepots();
      },
      error: (error: unknown) => {
        this.loadError.set(errorMessage(error, "Failed to load DSP settings"));
        this.loading.set(false);
      },
    });
  }

  resetForm(): void {
    const org = this.organization();
    if (!org) return;
    this.form.reset({
      name: org.name ?? "",
      email: org.email ?? "",
      phone: org.phone ?? "",
      website: org.website ?? "",
      address: org.address ?? "",
      city: org.city ?? "",
      postcode: org.postcode ?? "",
      country: org.country ?? "",
      companyRegNumber: org.companyRegNumber ?? "",
      vatNumber: org.vatNumber ?? "",
      operatingModel: org.operatingModel ?? "DSP_1_0",
      logoBase64: org.logoBase64 ?? "",
      invoicePrefix: org.invoicePrefix ?? "",
      invoiceFooter: org.invoiceFooter ?? "",
      termsAndConditions: org.termsAndConditions ?? "",
      bankName: org.bankName ?? "",
      bankAccountNumber: org.bankAccountNumber ?? "",
      bankSortCode: org.bankSortCode ?? "",
      iban: org.iban ?? "",
      swiftCode: org.swiftCode ?? "",
    });
    this.logoPreview.set(org.logoBase64 ? this.logoDataUrl(org.logoBase64) : null);
  }

  saveSettings(): void {
    const org = this.organization();
    if (!org) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const dto: UpdateOrganizationDto = {
      ...value,
      name: value.name.trim(),
      email: value.email.trim(),
    };

    this.saving.set(true);
    this.organizationsService.update(org.id, dto).subscribe({
      next: (updated) => {
        this.organization.set({ ...org, ...updated });
        this.resetForm();
        this.saving.set(false);
        this.alertService.showSuccess("Settings saved");
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.alertService.showError("Failed to save settings", errorMessage(error, "Please try again"));
      },
    });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      this.alertService.showError("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.alertService.showError("Logo must be smaller than 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      this.form.controls.logoBase64.setValue(dataUrl.split(",")[1] ?? "");
      this.form.markAsDirty();
      this.logoPreview.set(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  removeLogo(): void {
    this.form.controls.logoBase64.setValue("");
    this.form.markAsDirty();
    this.logoPreview.set(null);
  }

  // ---- Depots ----

  loadDepots(): void {
    this.depotsLoading.set(true);
    this.depotsError.set("");
    this.organizationsService.getDepots(true).subscribe({
      next: (depots) => {
        this.depots.set(depots);
        this.depotsLoading.set(false);
      },
      error: (error: unknown) => {
        this.depotsError.set(errorMessage(error, "Failed to load depots"));
        this.depotsLoading.set(false);
      },
    });
  }

  openDepotForm(depot: DepotRecord | null): void {
    this.editingDepot.set(depot);
    this.depotFormError.set("");
    this.depotForm.reset({
      code: depot?.code ?? "",
      name: depot?.name ?? "",
      address: depot?.address ?? "",
      postcode: depot?.postcode ?? "",
    });
    this.depotFormOpen.set(true);
  }

  closeDepotForm(): void {
    if (!this.depotSaving()) {
      this.depotFormOpen.set(false);
    }
  }

  saveDepot(): void {
    if (this.depotForm.invalid) {
      this.depotForm.markAllAsTouched();
      return;
    }
    const value = this.depotForm.getRawValue();
    const dto = {
      code: value.code.trim(),
      name: value.name.trim(),
      address: value.address.trim(),
      postcode: value.postcode.trim(),
    };
    const editing = this.editingDepot();
    const request = editing
      ? this.organizationsService.updateDepot(editing.id, dto)
      : this.organizationsService.createDepot(dto);

    this.depotSaving.set(true);
    this.depotFormError.set("");
    request.subscribe({
      next: () => {
        this.depotSaving.set(false);
        this.depotFormOpen.set(false);
        this.loadDepots();
        this.alertService.showSuccess(editing ? "Depot updated" : "Depot added");
      },
      error: (error: unknown) => {
        this.depotSaving.set(false);
        this.depotFormError.set(errorMessage(error, "Failed to save depot"));
      },
    });
  }

  toggleDepot(depot: DepotRecord): void {
    const activate = !depot.isActive;
    const message = activate
      ? `Activate depot ${depot.code}?`
      : `Deactivate depot ${depot.code}? It will be hidden from depot pickers; existing drivers, vans and history are kept.`;
    if (!confirm(message)) return;

    this.busyDepotId.set(depot.id);
    this.organizationsService.updateDepot(depot.id, { isActive: activate }).subscribe({
      next: () => {
        this.busyDepotId.set(null);
        this.loadDepots();
        this.alertService.showSuccess(activate ? "Depot activated" : "Depot deactivated");
      },
      error: (error: unknown) => {
        this.busyDepotId.set(null);
        this.alertService.showError("Failed to update depot", errorMessage(error, "Please try again"));
      },
    });
  }

  depotAddress(depot: DepotRecord): string {
    return [depot.address, depot.postcode].filter((part) => !!part).join(", ") || "—";
  }

  // ---- Service types -------------------------------------------------------

  loadServiceTypes(): void {
    this.serviceTypesLoading.set(true);
    this.serviceTypesError.set("");
    this.serviceTypesService.list(true).subscribe({
      next: (types) => {
        this.serviceTypes.set(types);
        this.serviceTypesLoading.set(false);
      },
      error: (error: unknown) => {
        this.serviceTypesError.set(errorMessage(error, "Failed to load service types"));
        this.serviceTypesLoading.set(false);
      },
    });
  }

  openServiceTypeForm(serviceType: ServiceTypeRecord | null): void {
    this.editingServiceType.set(serviceType);
    this.serviceTypeFormError.set("");
    this.serviceTypeForm.reset({
      code: serviceType?.code ?? "",
      name: serviceType?.name ?? "",
      hours: serviceType?.hours != null ? String(serviceType.hours) : "",
      sortOrder: serviceType ? String(serviceType.sortOrder) : "",
    });
    // The code is the bridge back to the payment tables, so it is fixed
    // once the row exists.
    if (serviceType) {
      this.serviceTypeForm.controls.code.disable();
    } else {
      this.serviceTypeForm.controls.code.enable();
    }
    this.serviceTypeFormOpen.set(true);
  }

  closeServiceTypeForm(): void {
    if (!this.serviceTypeSaving()) {
      this.serviceTypeFormOpen.set(false);
    }
  }

  saveServiceType(): void {
    if (this.serviceTypeForm.invalid) {
      this.serviceTypeForm.markAllAsTouched();
      return;
    }
    const value = this.serviceTypeForm.getRawValue();
    const hours = value.hours.trim() ? Number(value.hours) : undefined;
    const sortOrder = value.sortOrder.trim() ? Number(value.sortOrder) : undefined;
    const editing = this.editingServiceType();

    const request = editing
      ? this.serviceTypesService.update(editing.id, {
          name: value.name.trim(),
          ...(hours !== undefined && { hours }),
          ...(sortOrder !== undefined && { sortOrder }),
        })
      : this.serviceTypesService.create({
          code: value.code.trim().toUpperCase(),
          name: value.name.trim(),
          ...(hours !== undefined && { hours }),
          ...(sortOrder !== undefined && { sortOrder }),
        });

    this.serviceTypeSaving.set(true);
    this.serviceTypeFormError.set("");
    request.subscribe({
      next: () => {
        this.serviceTypeSaving.set(false);
        this.serviceTypeFormOpen.set(false);
        this.loadServiceTypes();
        this.alertService.showSuccess(
          editing ? "Service type updated" : "Service type added"
        );
      },
      error: (error: unknown) => {
        this.serviceTypeSaving.set(false);
        this.serviceTypeFormError.set(
          errorMessage(error, "Failed to save service type")
        );
      },
    });
  }

  toggleServiceType(serviceType: ServiceTypeRecord): void {
    const activate = !serviceType.isActive;
    const message = activate
      ? `Activate ${serviceType.name}?`
      : `Deactivate ${serviceType.name}? It will be hidden from pickers; payment history that used it is kept.`;
    if (!confirm(message)) return;

    this.busyServiceTypeId.set(serviceType.id);
    const request = activate
      ? this.serviceTypesService.update(serviceType.id, { isActive: true })
      : this.serviceTypesService.deactivate(serviceType.id);

    request.subscribe({
      next: () => {
        this.busyServiceTypeId.set(null);
        this.loadServiceTypes();
        this.alertService.showSuccess(
          activate ? "Service type activated" : "Service type deactivated"
        );
      },
      error: (error: unknown) => {
        this.busyServiceTypeId.set(null);
        this.alertService.showError(
          "Failed to update service type",
          errorMessage(error, "Please try again")
        );
      },
    });
  }

  private logoDataUrl(base64: string): string {
    if (base64.startsWith("data:")) return base64;
    const mime = base64.startsWith("/9j/") ? "image/jpeg" : "image/png";
    return `data:${mime};base64,${base64}`;
  }
}
