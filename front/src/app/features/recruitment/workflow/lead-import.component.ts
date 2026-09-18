import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { apiErrorMessage } from "../../../shared/utils/api-error";
import {
  ImportLead,
  ImportResult,
  RecruitmentWorkflowService,
} from "./recruitment-workflow.service";

@Component({
  selector: "app-lead-import",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: "./lead-import.component.html",
})
export class LeadImportComponent {
  private readonly workflow = inject(RecruitmentWorkflowService);
  readonly headers = signal<string[]>([]);
  readonly rows = signal<string[][]>([]);
  readonly nameColumn = signal(-1);
  readonly surnameColumn = signal(-1);
  readonly phoneColumn = signal(-1);
  readonly emailColumn = signal(-1);
  readonly busy = signal(false);
  readonly error = signal("");
  readonly result = signal<ImportResult | null>(null);
  source = "Indeed";
  fileName = "";
  readonly preview = computed(() => {
    const seen = new Set<string>();
    return this.rows().map((row, index) => {
      const name = [row[this.nameColumn()], row[this.surnameColumn()]]
        .filter(Boolean)
        .join(" ")
        .trim();
      const rawPhone = row[this.phoneColumn()] || "";
      let digits = rawPhone.replace(/\D/g, "");
      if (digits.startsWith("00")) digits = digits.slice(2);
      if (digits.startsWith("0") && digits.length === 11)
        digits = `44${digits.slice(1)}`;
      else if (digits.length === 10 && !digits.startsWith("44"))
        digits = `44${digits}`;
      const phoneNumber = digits ? `+${digits}` : "";
      const email = (row[this.emailColumn()] || "").trim().toLowerCase();
      let error = !name
        ? "Name missing"
        : !/^\+[1-9]\d{7,14}$/.test(phoneNumber)
          ? "Invalid phone"
          : email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            ? "Invalid email"
            : "";
      if (!error && seen.has(phoneNumber))
        error = "Duplicate phone in this file";
      seen.add(phoneNumber);
      return {
        row: index + 2,
        name,
        phoneNumber,
        ...(email ? { email } : {}),
        error,
      };
    });
  });
  readonly validLeads = computed<ImportLead[]>(() =>
    this.preview()
      .filter((row) => !row.error)
      .map(({ name, phoneNumber, email }) => ({
        name,
        phoneNumber,
        ...(email ? { email } : {}),
      }))
  );

  async readFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.error.set("");
    this.result.set(null);
    this.rows.set([]);
    this.headers.set([]);
    if (!/\.(csv|xlsx|xls)$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
      this.error.set("Choose a CSV or Excel file up to 5 MB.");
      return;
    }
    this.busy.set(true);
    try {
      const xlsx = await import("xlsx");
      const workbook = xlsx.read(await file.arrayBuffer(), {
        type: "array",
        sheetRows: 502,
      });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("No worksheet found.");
      const data = xlsx.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
      });
      if (data.length < 2)
        throw new Error(
          "The file must contain column headers and at least one lead."
        );
      if (data.length > 501)
        throw new Error(
          "Import up to 500 leads at a time. Split this file into smaller batches."
        );
      const headers = data[0].map(String);
      const find = (names: string[]) =>
        headers.findIndex((header) =>
          names.includes(header.toLowerCase().replace(/[^a-z]/g, ""))
        );
      this.headers.set(headers);
      this.nameColumn.set(
        find([
          "name",
          "fullname",
          "candidatename",
          "applicantname",
          "firstname",
          "forename",
        ])
      );
      const nameHeader = headers[this.nameColumn()]
        ?.toLowerCase()
        .replace(/[^a-z]/g, "");
      this.surnameColumn.set(
        nameHeader === "firstname" || nameHeader === "forename"
          ? find(["lastname", "surname"])
          : -1
      );
      this.phoneColumn.set(
        find([
          "phone",
          "phonenumber",
          "mobile",
          "mobilenumber",
          "telephone",
          "contactnumber",
        ])
      );
      this.emailColumn.set(
        find(["email", "emailaddress", "personalemailaddress"])
      );
      this.rows.set(data.slice(1).map((row) => row.map(String)));
      this.fileName = file.name;
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : "Could not read this file."
      );
    } finally {
      this.busy.set(false);
    }
  }

  importLeads(): void {
    if (
      this.busy() ||
      !this.validLeads().length ||
      !this.source.trim() ||
      this.result()
    )
      return;
    this.busy.set(true);
    this.error.set("");
    this.workflow.importLeads(this.source.trim(), this.validLeads()).subscribe({
      next: (result) => {
        this.result.set(result);
        this.busy.set(false);
      },
      error: (error) => {
        this.error.set(
          apiErrorMessage(
            error,
            "Could not import leads. Existing leads will be skipped if you retry."
          )
        );
        this.busy.set(false);
      },
    });
  }
}
