import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import { AlertService } from "../../shared/services/alert.service";
import { downloadCsv, today, type CsvColumn } from "../../shared/utils/csv";
import { WhatsAppMessagingComponent } from "../whatsapp/whatsapp.component";
import { DriverEditModalComponent } from "./driver-edit-modal.component";
import { DriverService } from "./drivers.service";
import {
  DRIVER_STATUSES,
  Depot,
  DocumentStatus,
  Driver,
  StatCard,
  apiErrorMessage,
  documentStatus,
  documentStatusClass,
  driverStatusClass,
} from "./drivers.model";

type DriversTab = "overview" | "compliance" | "whatsapp";

interface ComplianceDoc {
  readonly key: "passportExpiry" | "licenseExpiry" | "rtwExpiry";
  readonly label: string;
}

@Component({
  selector: "app-drivers",
  standalone: true,
  imports: [DatePipe, RouterLink, WhatsAppMessagingComponent, DriverEditModalComponent],
  templateUrl: "./drivers.component.html",
  styleUrls: ["./drivers.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriversComponent {
  private readonly driverService = inject(DriverService);
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);

  readonly statuses = DRIVER_STATUSES;
  readonly tabs: readonly { id: DriversTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "compliance", label: "Compliance" },
    { id: "whatsapp", label: "WhatsApp" },
  ];
  readonly complianceDocs: readonly ComplianceDoc[] = [
    { key: "passportExpiry", label: "Passport / visa" },
    { key: "licenseExpiry", label: "Licence" },
    { key: "rtwExpiry", label: "Right to work" },
  ];

  readonly drivers = signal<Driver[]>([]);
  readonly depots = signal<Depot[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly searchTerm = signal("");
  readonly statusFilter = signal<string>("all");
  readonly depotFilter = signal<string>("all");
  readonly activeTab = signal<DriversTab>("overview");
  readonly editingDriver = signal<Driver | null>(null);
  readonly deactivatingId = signal<string | null>(null);
  readonly stats = signal<StatCard[]>([]);

  readonly filteredDrivers = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();

    return this.drivers().filter((driver) => {
      const matchesSearch =
        search === "" ||
        (driver.name ?? "").toLowerCase().includes(search) ||
        (driver.email ?? "").toLowerCase().includes(search) ||
        (driver.phone ?? "").includes(search) ||
        (driver.transporterId ?? "").toLowerCase().includes(search);
      const matchesStatus = status === "all" || driver.status === status;
      return matchesSearch && matchesStatus;
    });
  });

  /** Counts over the drivers loaded for the selected depot (all statuses except inactive) */
  readonly compliance = computed(() => {
    const now = new Date();
    let expired = 0;
    let expiring = 0;
    let checkOverdue = 0;
    for (const driver of this.drivers()) {
      if (driver.status === "INACTIVE") {
        continue;
      }
      const statuses = this.complianceDocs.map((doc) => documentStatus(driver[doc.key], now));
      if (statuses.includes("expired")) {
        expired++;
      } else if (statuses.includes("expiring")) {
        expiring++;
      }
      if (driver.nextCheck && new Date(driver.nextCheck).getTime() < now.getTime()) {
        checkOverdue++;
      }
    }
    return { expired, expiring, checkOverdue };
  });

  constructor() {
    this.loadDepots();
    this.loadDrivers();
    this.loadStats();
  }

  loadDrivers(): void {
    const depotId = this.depotFilter();
    this.loading.set(true);
    this.loadError.set(null);
    this.driverService.getDrivers(depotId === "all" ? {} : { depotId }).subscribe({
      next: (drivers) => {
        this.drivers.set(drivers);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.loadError.set(apiErrorMessage(err, "Could not load drivers."));
      },
    });
  }

  private loadDepots(): void {
    this.driverService.getDepots().subscribe({
      next: (depots) => this.depots.set(depots),
      error: (err: unknown) =>
        this.alertService.showError("Could not load depots", apiErrorMessage(err, "Depot filter unavailable.")),
    });
  }

  loadStats(): void {
    this.driverService.getStats().subscribe({
      next: (stats) => {
        const activeShare = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;
        this.stats.set([
          {
            title: "Total Drivers",
            value: String(stats.total),
            change: "All depots, all statuses",
            icon: "user",
            color: "text-blue-600",
            bgColor: "bg-blue-100",
          },
          {
            title: "Active Drivers",
            value: String(stats.active),
            change: `${activeShare}% of total`,
            icon: "check-circle",
            color: "text-green-600",
            bgColor: "bg-green-100",
          },
          {
            title: "Documents Expiring",
            value: String(stats.expiring),
            change: "Expired or due in 30 days",
            icon: "alert-circle",
            color: "text-orange-600",
            bgColor: "bg-orange-100",
          },
          {
            title: "Pending",
            value: String(stats.pending),
            change: "Drivers with status PENDING",
            icon: "file-text",
            color: "text-red-600",
            bgColor: "bg-red-100",
          },
        ]);
      },
      error: () => this.stats.set([]),
    });
  }

  onSearchChange(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  onStatusFilterChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
  }

  onDepotFilterChange(event: Event): void {
    this.depotFilter.set((event.target as HTMLSelectElement).value);
    this.loadDrivers();
  }

  setActiveTab(tab: DriversTab): void {
    this.activeTab.set(tab);
  }

  statusBadgeClass(status: string): string {
    return driverStatusClass(status);
  }

  docStatus(driver: Driver, doc: ComplianceDoc): DocumentStatus {
    return documentStatus(driver[doc.key]);
  }

  docStatusClass(status: DocumentStatus): string {
    return documentStatusClass(status);
  }

  depotLabel(driver: Driver): string {
    return driver.homeDepot ? `${driver.homeDepot.code} · ${driver.homeDepot.name}` : driver.depot || "No home depot";
  }

  getInitials(name: string): string {
    return (name ?? "")
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  viewDriverDetails(driver: Driver): void {
    this.router.navigate(["/drivers", driver.id]);
  }

  editDriver(driver: Driver): void {
    this.editingDriver.set(driver);
  }

  closeEdit(): void {
    this.editingDriver.set(null);
  }

  onDriverSaved(): void {
    this.editingDriver.set(null);
    this.loadDrivers();
    this.loadStats();
  }

  deactivateDriver(driver: Driver): void {
    if (driver.status === "INACTIVE") {
      return;
    }
    const confirmed = confirm(
      `Deactivate ${driver.name}?\n\nThe driver is not deleted: status becomes INACTIVE and payment history is kept.`
    );
    if (!confirmed) {
      return;
    }
    this.deactivatingId.set(driver.id);
    this.driverService.deactivateDriver(driver.id).subscribe({
      next: () => {
        this.deactivatingId.set(null);
        this.alertService.showSuccess("Driver deactivated", driver.name);
        this.loadDrivers();
        this.loadStats();
      },
      error: (err: unknown) => {
        this.deactivatingId.set(null);
        this.alertService.showError("Could not deactivate driver", apiErrorMessage(err, "Please try again."));
      },
    });
  }

  /** Drivers are created from recruitment only (POST /api/drivers is forbidden) */
  newCandidate(): void {
    this.router.navigate(["/candidates"]);
  }

  exportData(): void {
    const rows = this.filteredDrivers();
    if (rows.length === 0) {
      this.alertService.showWarning("Nothing to export", "No drivers match the current filters.");
      return;
    }
    const date = (value: string | null | undefined): string => (value ? value.slice(0, 10) : "");
    const columns: CsvColumn<Driver>[] = [
      { header: "Name", value: (d) => d.name },
      { header: "Transporter ID", value: (d) => d.transporterId },
      { header: "Status", value: (d) => d.status },
      { header: "Home depot code", value: (d) => d.homeDepot?.code ?? "" },
      { header: "Home depot", value: (d) => d.homeDepot?.name ?? d.depot },
      { header: "Email", value: (d) => d.email },
      { header: "Phone", value: (d) => d.phone },
      { header: "Address", value: (d) => d.address },
      { header: "Citizenship", value: (d) => d.citizenship },
      { header: "Contract type", value: (d) => d.contractType },
      { header: "Licence number", value: (d) => d.licenseNumber },
      { header: "Licence expiry", value: (d) => date(d.licenseExpiry) },
      { header: "Passport/visa expiry", value: (d) => date(d.passportExpiry) },
      { header: "Right to work expiry", value: (d) => date(d.rtwExpiry) },
      { header: "Next DVLA check", value: (d) => date(d.nextCheck) },
      { header: "Licence points", value: (d) => d.points },
      { header: "Endorsements", value: (d) => (d.hasEndorsements ? "Yes" : "No") },
    ];
    downloadCsv(`drivers-${today()}`, rows, columns);
  }
}
