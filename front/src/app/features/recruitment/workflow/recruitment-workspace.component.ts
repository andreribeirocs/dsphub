import { CommonModule } from "@angular/common";
import { Component, DestroyRef, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { firstValueFrom } from "rxjs";
import {
  Candidate,
  CandidatesService,
  ConvertToDriverResponse,
  DepotOption,
} from "../candidates/candidates.service";
import { apiErrorMessage } from "../../../shared/utils/api-error";
import { LeadImportComponent } from "./lead-import.component";
import {
  CandidateReview,
  ContactChannel,
  ContactResult,
  DOCUMENT_LABELS,
  DocumentKey,
  RecruitmentWorkflowService,
  WorkflowCandidate,
  WorkflowPage,
  WorkflowStage,
  WorkflowSummary,
} from "./recruitment-workflow.service";

const STAGES: Record<
  WorkflowStage,
  {
    title: string;
    description: string;
    tabs: { value: string; label: string }[];
  }
> = {
  leads: {
    title: "Lead Generation",
    description: "Bring new contacts into your recruitment pipeline.",
    tabs: [],
  },
  contact: {
    title: "Initial Contact",
    description:
      "Select leads and send their individual application links by WhatsApp or email.",
    tabs: [
      { value: "all", label: "All contacts" },
      { value: "pending", label: "Not contacted" },
      { value: "sent", label: "Invited / awaiting application" },
    ],
  },
  documents: {
    title: "Document Collection",
    description:
      "Applications submitted and awaiting document validation. Rejected documents stay flagged until resolved.",
    tabs: [
      { value: "all", label: "Awaiting review" },
      { value: "rejected", label: "Flagged documents" },
    ],
  },
  background: {
    title: "Background Check",
    description:
      "Record the outcome of the background check performed outside DSPHub.",
    tabs: [
      { value: "pending", label: "Pending" },
      { value: "rejected", label: "Rejected" },
      { value: "passed", label: "Passed" },
    ],
  },
  classroom: {
    title: "Classroom",
    description:
      "Schedule training after background approval and record attendance when complete.",
    tabs: [
      { value: "ready", label: "Ready to schedule" },
      { value: "scheduled", label: "Scheduled" },
      { value: "completed", label: "Completed" },
    ],
  },
  "ride-along": {
    title: "Ride Along",
    description:
      "Scheduling activates the driver and archives the application. Classroom training must be complete.",
    tabs: [
      { value: "ready", label: "Ready to schedule" },
      { value: "scheduled", label: "Scheduled / active" },
      { value: "all", label: "Awaiting activation" },
    ],
  },
  archived: {
    title: "Archived Applications",
    description:
      "Candidates converted to active drivers. Their application records remain available.",
    tabs: [{ value: "all", label: "Active drivers" }],
  },
};

@Component({
  selector: "app-recruitment-workspace",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LeadImportComponent],
  templateUrl: "./recruitment-workspace.component.html",
})
export class RecruitmentWorkspaceComponent {
  private readonly workflow = inject(RecruitmentWorkflowService);
  private readonly candidates = inject(CandidatesService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private requestId = 0;
  readonly stage = signal<WorkflowStage>("contact");
  readonly config = computed(() => STAGES[this.stage()]);
  readonly bucket = signal("all");
  readonly page = signal<WorkflowPage | null>(null);
  readonly summary = signal<WorkflowSummary | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal("");
  readonly message = signal("");
  readonly selectedIds = signal(new Set<string>());
  readonly selectedContacts = computed(() =>
    (this.page()?.data ?? []).filter((row) => this.selectedIds().has(row.id))
  );
  readonly modal = signal<
    "contact" | "documents" | "background" | "classroom" | "ride-along" | null
  >(null);
  readonly target = signal<WorkflowCandidate | null>(null);
  readonly detail = signal<Candidate | null>(null);
  readonly modalError = signal("");
  readonly depots = signal<DepotOption[]>([]);
  readonly contactResult = signal<ContactResult | null>(null);
  readonly hireResult = signal<ConvertToDriverResponse | null>(null);
  readonly review = computed<CandidateReview>(
    () =>
      (this.detail()?.documents?.["_recruitment"] as
        | CandidateReview
        | undefined) ?? { documentReviews: {}, documentsStatus: "pending" }
  );
  readonly documents = Object.entries(DOCUMENT_LABELS).map(([key, label]) => ({
    key: key as DocumentKey,
    label,
  }));
  readonly channel = signal<ContactChannel>("whatsapp");
  readonly canSend = computed(
    () =>
      this.selectedContacts().length > 0 &&
      (this.channel() === "preferred"
        ? !!(
            this.summary()?.channels.whatsapp || this.summary()?.channels.email
          )
        : !!this.summary()?.channels[this.channel() as "whatsapp" | "email"])
  );
  search = "";
  date = "";
  reason = "";
  homeDepotId = "";
  transporterId = "";
  corporateEmail = "";
  contractType = "";
  documentReasons: Partial<Record<DocumentKey, string>> = {};
  readonly inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const stage = params.get("stage") || "contact";
        this.stage.set(
          Object.prototype.hasOwnProperty.call(STAGES, stage)
            ? (stage as WorkflowStage)
            : "contact"
        );
        this.bucket.set(this.config().tabs[0]?.value ?? "all");
        this.search = this.route.snapshot.queryParamMap.get("search") || "";
        this.closeModal();
        this.load();
        this.workflow
          .summary()
          .subscribe({
            next: (result) => this.summary.set(result),
            error: (error) =>
              this.error.set(
                apiErrorMessage(error, "Could not load delivery configuration.")
              ),
          });
      });
  }

  load(pageNumber = 0): void {
    const stage = this.stage();
    if (stage === "leads") return;
    const request = ++this.requestId;
    this.loading.set(true);
    this.error.set("");
    this.selectedIds.set(new Set());
    this.workflow
      .list(stage, this.bucket(), pageNumber, this.search.trim())
      .subscribe({
        next: (result) => {
          if (request === this.requestId) {
            this.page.set(result);
            this.loading.set(false);
          }
        },
        error: (error) => {
          if (request === this.requestId) {
            this.page.set(null);
            this.error.set(
              apiErrorMessage(error, "Could not load candidates.")
            );
            this.loading.set(false);
          }
        },
      });
  }
  changeBucket(bucket: string): void {
    this.bucket.set(bucket);
    this.load();
  }
  toggle(id: string): void {
    const selected = new Set(this.selectedIds());
    selected.has(id) ? selected.delete(id) : selected.add(id);
    this.selectedIds.set(selected);
  }
  togglePage(checked: boolean): void {
    this.selectedIds.set(
      new Set(checked ? (this.page()?.data ?? []).map((row) => row.id) : [])
    );
  }
  allSelected(): boolean {
    return (
      !!this.page()?.data.length &&
      this.selectedIds().size === this.page()?.data.length
    );
  }
  candidateName(id: string): string {
    return this.page()?.data.find((row) => row.id === id)?.name ?? "Candidate";
  }
  label(status: string): string {
    return (
      (
        {
          SMS_SENT: "Invitation sent",
          DOCUMENTS_UPLOADED: "Documents awaiting review",
          APPROVED: "Background passed",
          ACTIVE_DRIVER: "Active · archived",
        } as Record<string, string>
      )[status] ?? status.replace(/_/g, " ").toLowerCase()
    );
  }

  async open(
    row: WorkflowCandidate,
    action: "documents" | "background" | "classroom" | "ride-along"
  ): Promise<void> {
    if (this.busy()) return;
    this.target.set(row);
    this.modal.set(action);
    this.modalError.set("");
    this.detail.set(null);
    this.hireResult.set(null);
    this.date = "";
    this.reason = row.review.background?.reason ?? "";
    this.homeDepotId = "";
    this.transporterId = "";
    this.corporateEmail = "";
    this.contractType = "";
    this.documentReasons = {};
    if (action === "documents" || action === "ride-along") {
      this.busy.set(true);
      try {
        const detail = await firstValueFrom(
          this.candidates.getCandidateById(row.id)
        );
        this.detail.set(detail);
        if (action === "documents")
          for (const document of this.documents)
            this.documentReasons[document.key] =
              this.review().documentReviews[document.key]?.reason ?? "";
        else
          this.depots.set(
            (await firstValueFrom(this.candidates.getDepots())).filter(
              (depot) => depot.isActive
            )
          );
      } catch (error) {
        this.modalError.set(
          apiErrorMessage(error, "Could not load candidate information.")
        );
      } finally {
        this.busy.set(false);
      }
    }
  }
  closeModal(): void {
    if (this.busy()) return;
    const refreshContacts =
      this.modal() === "contact" && !!this.contactResult();
    this.modal.set(null);
    this.target.set(null);
    this.detail.set(null);
    this.modalError.set("");
    this.hireResult.set(null);
    this.contactResult.set(null);
    if (refreshContacts) this.load();
  }
  openContact(): void {
    if (!this.selectedContacts().length) return;
    this.contactResult.set(null);
    this.modalError.set("");
    this.modal.set("contact");
  }
  imageUrl(key: DocumentKey): string | null {
    const documents = this.detail()?.documents;
    const value =
      documents?.[key] ??
      (key === "insuranceImage" ? documents?.insuranceNumberImage : undefined);
    if (typeof value !== "string" || !value) return null;
    if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value)) return value;
    return /^[A-Za-z0-9+/=\s]+$/.test(value)
      ? `data:image/jpeg;base64,${value}`
      : null;
  }

  async reviewDocument(
    key: DocumentKey,
    decision: "approved" | "rejected"
  ): Promise<void> {
    const target = this.target();
    if (!target || this.busy()) return;
    const reason = this.documentReasons[key]?.trim() ?? "";
    if (decision === "rejected" && !reason) {
      this.modalError.set("Enter a reason before rejecting this document.");
      return;
    }
    this.busy.set(true);
    this.modalError.set("");
    try {
      this.detail.set(
        await firstValueFrom(
          this.workflow.reviewDocument(target.id, key, decision, reason)
        )
      );
      this.load(this.page()?.pagination.page ?? 0);
      if (this.detail()?.status === "BACKGROUND_CHECK")
        this.message.set(
          "All supplied documents approved. Candidate moved to Background Check."
        );
    } catch (error) {
      this.modalError.set(
        apiErrorMessage(error, "Could not save this review.")
      );
    } finally {
      this.busy.set(false);
    }
  }

  async replaceDocument(key: DocumentKey, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const target = this.target();
    if (!file || !target || this.busy()) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      this.modalError.set("Choose a PNG, JPEG or WebP image up to 5 MB.");
      input.value = "";
      return;
    }
    this.busy.set(true);
    this.modalError.set("");
    try {
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read this file."));
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.readAsDataURL(file);
      });
      this.detail.set(
        await firstValueFrom(
          this.workflow.replaceDocument(target.id, key, image)
        )
      );
      this.documentReasons[key] = "";
      this.load(this.page()?.pagination.page ?? 0);
    } catch (error) {
      this.modalError.set(
        apiErrorMessage(error, "Could not replace the document.")
      );
    } finally {
      this.busy.set(false);
      input.value = "";
    }
  }

  async background(
    decision: "pending" | "approved" | "rejected"
  ): Promise<void> {
    const target = this.target();
    if (!target || this.busy()) return;
    if (decision === "rejected" && !this.reason.trim()) {
      this.modalError.set("Enter a reason for rejection.");
      return;
    }
    await this.perform(
      () =>
        firstValueFrom(
          this.workflow.reviewBackground(
            target.id,
            decision,
            this.reason.trim()
          )
        ),
      "Background decision saved."
    );
  }
  async classroom(): Promise<void> {
    const target = this.target();
    if (!target || !this.validDate()) return;
    await this.perform(
      () =>
        firstValueFrom(
          this.workflow.scheduleClassroom(
            target.id,
            new Date(this.date).toISOString()
          )
        ),
      "Classroom scheduled."
    );
  }
  async completeClassroom(row: WorkflowCandidate): Promise<void> {
    await this.perform(
      () => firstValueFrom(this.workflow.completeClassroom(row.id)),
      "Classroom completed. Candidate is ready for Ride Along."
    );
  }
  private validDate(): boolean {
    if (
      !this.date ||
      Number.isNaN(new Date(this.date).getTime()) ||
      new Date(this.date) <= new Date()
    ) {
      this.modalError.set("Choose a future date and time.");
      return false;
    }
    return true;
  }
  async rideAlong(): Promise<void> {
    const target = this.target();
    if (!target || this.busy() || !this.validDate()) return;
    if (!this.homeDepotId || !this.transporterId.trim()) {
      this.modalError.set("Select a depot and enter the Transporter ID.");
      return;
    }
    this.busy.set(true);
    this.modalError.set("");
    try {
      const result = await firstValueFrom(
        this.workflow.scheduleRideAlong(target.id, {
          rideAlongDate: new Date(this.date).toISOString(),
          homeDepotId: this.homeDepotId,
          transporterId: this.transporterId.trim(),
          joinDate: this.date.slice(0, 10),
          ...(this.corporateEmail.trim()
            ? { corporateEmail: this.corporateEmail.trim() }
            : {}),
          ...(this.contractType.trim()
            ? { contractType: this.contractType.trim() }
            : {}),
        })
      );
      this.hireResult.set(result);
      this.load();
      this.message.set(
        "Ride Along scheduled. Driver activated and application archived."
      );
    } catch (error) {
      this.modalError.set(
        apiErrorMessage(error, "Could not schedule and activate this driver.")
      );
    } finally {
      this.busy.set(false);
    }
  }
  async sendInvitations(): Promise<void> {
    if (this.busy() || !this.canSend()) return;
    this.busy.set(true);
    this.modalError.set("");
    try {
      this.contactResult.set(
        await firstValueFrom(
          this.workflow.contact([...this.selectedIds()], this.channel())
        )
      );
    } catch (error) {
      this.modalError.set(
        apiErrorMessage(error, "Could not send invitations.")
      );
    } finally {
      this.busy.set(false);
    }
  }
  finishContact(): void {
    this.closeModal();
  }
  private async perform(
    operation: () => Promise<unknown>,
    message: string
  ): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.modalError.set("");
    this.error.set("");
    try {
      await operation();
      this.busy.set(false);
      this.closeModal();
      this.message.set(message);
      this.load();
    } catch (error) {
      (this.modal() ? this.modalError : this.error).set(
        apiErrorMessage(error, "Could not update the candidate.")
      );
    } finally {
      this.busy.set(false);
    }
  }
}
