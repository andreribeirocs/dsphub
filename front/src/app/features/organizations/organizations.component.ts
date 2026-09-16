import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { OrganizationsService } from "./organizations.service";
import { OrganizationFormComponent } from "./organization-form.component";
import type { Organization } from "./organizations.model";

@Component({
  selector: "app-organizations",
  imports: [CommonModule, RouterModule, OrganizationFormComponent],
  templateUrl: "./organizations.component.html",
  styleUrls: ["./organizations.component.scss"],
})
export class OrganizationsComponent implements OnInit {
  private readonly organizationsService = inject(OrganizationsService);

  readonly organizations = signal<Organization[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly selectedOrganization = signal<Organization | null>(null);

  ngOnInit(): void {
    this.loadOrganizations();
  }

  loadOrganizations(): void {
    this.loading.set(true);
    this.error.set(null);

    this.organizationsService.getAll().subscribe({
      next: (orgs) => {
        this.organizations.set(orgs);
        this.loading.set(false);
      },
      error: (err) => {
        console.error("Failed to load organizations:", err);
        this.error.set("Failed to load organizations. Please try again.");
        this.loading.set(false);
      },
    });
  }

  openCreateForm(): void {
    this.selectedOrganization.set(null);
    this.showForm.set(true);
  }

  openEditForm(organization: Organization): void {
    this.selectedOrganization.set(organization);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.selectedOrganization.set(null);
  }

  handleFormSuccess(): void {
    this.closeForm();
    this.loadOrganizations();
  }

  deleteOrganization(organization: Organization): void {
    if (
      !confirm(
        `Are you sure you want to deactivate "${organization.name}"? This will set it as inactive.`
      )
    ) {
      return;
    }

    this.organizationsService.delete(organization.id).subscribe({
      next: () => {
        this.loadOrganizations();
      },
      error: (err) => {
        console.error("Failed to delete organization:", err);
        alert("Failed to delete organization. Please try again.");
      },
    });
  }

  toggleStatus(organization: Organization): void {
    const newStatus = !organization.isActive;
    const action = newStatus ? "activate" : "deactivate";

    if (
      !confirm(`Are you sure you want to ${action} "${organization.name}"?`)
    ) {
      return;
    }

    this.organizationsService
      .update(organization.id, { isActive: newStatus })
      .subscribe({
        next: () => {
          this.loadOrganizations();
        },
        error: (err) => {
          console.error("Failed to update organization status:", err);
          alert("Failed to update organization status. Please try again.");
        },
      });
  }
}
