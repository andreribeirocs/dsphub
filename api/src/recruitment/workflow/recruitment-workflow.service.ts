import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Candidate, CandidateStatus, Prisma } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { isPhoneNumber } from "class-validator";
import { nanoid } from "nanoid";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../tenancy/tenant-context";
import { AuditService } from "../../audit/audit.service";
import { EmailService } from "../../email/email.service";
import {
  MESSAGING_PROVIDER,
  MessagingProvider,
} from "../../messaging/messaging.types";
import { toE164 } from "../../messaging/phone.util";
import { RecruitmentService } from "../recruitment.service";
import {
  BulkContactDto,
  ImportLeadsDto,
  ReplaceDocumentDto,
  ReviewBackgroundDto,
  ReviewDocumentDto,
  ScheduleRideAlongDto,
  WorkflowQueryDto,
} from "../dto/workflow.dto";
import {
  documentFlags,
  documentObject,
  documentsReady,
  documentValue,
  recruitmentReview,
  workflowWhere,
  WORKFLOW_STAGES,
} from "./recruitment-workflow";

@Injectable()
export class RecruitmentWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly recruitment: RecruitmentService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    @Inject(MESSAGING_PROVIDER) private readonly messaging: MessagingProvider
  ) {}

  async summary() {
    const counts = await Promise.all(
      WORKFLOW_STAGES.map((stage) =>
        this.prisma.candidate.count({ where: workflowWhere(stage) })
      )
    );
    const [leads, forms, inProgress] = await Promise.all([
      this.prisma.candidate.count({ where: { status: "LEAD" } }),
      this.prisma.candidate.count({ where: { formCompleted: true } }),
      this.prisma.candidate.count({
        where: { status: { notIn: ["LEAD", "ACTIVE_DRIVER", "REJECTED"] } },
      }),
    ]);
    return {
      stages: Object.fromEntries(
        WORKFLOW_STAGES.map((stage, i) => [stage, counts[i]])
      ),
      statistics: { leads, forms, inProgress, completed: counts[5] },
      channels: {
        whatsapp: this.messaging.isConfigured(),
        email: this.email.isEmailServiceConfigured(),
      },
    };
  }

  async list(query: WorkflowQueryDto) {
    const where: Prisma.CandidateWhereInput = {
      AND: [workflowWhere(query.stage, query.bucket)],
    };
    if (query.search?.trim()) {
      where.OR = ["name", "phoneNumber", "email"].map((field) => ({
        [field]: { contains: query.search!.trim(), mode: "insensitive" },
      }));
    }
    const [total, records] = await Promise.all([
      this.prisma.candidate.count({ where }),
      this.prisma.candidate.findMany({
        where,
        skip: query.page * query.pageSize,
        take: query.pageSize,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          status: true,
          source: true,
          userId: true,
          formCompleted: true,
          classroomDate: true,
          rideAlongDate: true,
          createdAt: true,
          documents: true,
        },
      }),
    ]);
    return {
      data: records.map(({ documents, ...candidate }) => ({
        ...candidate,
        documentFlags: documentFlags(documents),
        review: recruitmentReview(documents),
        contactPreference:
          documentObject(documentObject(documents).additionalData)
            .contactPreference ?? null,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    };
  }

  async importLeads(dto: ImportLeadsDto, actorUserId: string) {
    const results: {
      row: number;
      name: string;
      status: "imported" | "duplicate" | "invalid";
      message?: string;
    }[] = [];
    for (const [index, lead] of dto.leads.entries()) {
      const phoneNumber = toE164(lead.phoneNumber.trim().replace(/^00/, "+"));
      if (!isPhoneNumber(phoneNumber) || !lead.name.trim()) {
        results.push({
          row: index + 1,
          name: lead.name,
          status: "invalid",
          message: "A valid name and phone number are required.",
        });
        continue;
      }
      const email = lead.email?.trim().toLowerCase();
      const duplicate = await this.prisma.candidate.findFirst({
        where: {
          OR: [
            { phoneNumber },
            ...(email
              ? [
                  {
                    email: {
                      equals: email,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                ]
              : []),
          ],
        },
        select: { id: true },
      });
      if (duplicate) {
        results.push({ row: index + 1, name: lead.name, status: "duplicate" });
        continue;
      }
      await this.prisma.candidate.create({
        data: {
          organizationId: TenantContext.requireOrganizationId(),
          name: lead.name.trim(),
          phoneNumber,
          email,
          source: dto.source.trim(),
          status: "LEAD",
        },
      });
      results.push({ row: index + 1, name: lead.name, status: "imported" });
    }
    const imported = results.filter((row) => row.status === "imported").length;
    await this.audit.record({
      action: "Recruitment leads imported",
      entityType: "Candidate",
      actorUserId,
      summary: `${imported} leads imported from ${dto.source}`,
      metadata: {
        imported,
        duplicates: results.filter((row) => row.status === "duplicate").length,
      },
    });
    return { imported, results };
  }

  async contact(dto: BulkContactDto, actorUserId: string) {
    const results: {
      id: string;
      success: boolean;
      channel: string;
      message: string;
    }[] = [];
    for (const id of dto.candidateIds) {
      const candidate = await this.prisma.candidate.findUnique({
        where: { id },
      });
      if (
        !candidate ||
        !(["LEAD", "SMS_SENT"] as CandidateStatus[]).includes(candidate.status)
      ) {
        results.push({
          id,
          success: false,
          channel: dto.channel,
          message: "Candidate unavailable or application already submitted.",
        });
        continue;
      }
      const preference = documentObject(
        documentObject(candidate.documents).additionalData
      ).contactPreference;
      const channel =
        dto.channel === "preferred"
          ? preference === "email"
            ? "email"
            : "whatsapp"
          : dto.channel;
      if (
        channel === "email"
          ? !this.email.isEmailServiceConfigured()
          : !this.messaging.isConfigured()
      ) {
        results.push({
          id,
          success: false,
          channel,
          message: `${channel === "email" ? "Email" : "WhatsApp"} is not configured. Nothing was sent.`,
        });
        continue;
      }
      if (channel === "email" && !candidate.email) {
        results.push({
          id,
          success: false,
          channel,
          message: "This lead has no email address.",
        });
        continue;
      }
      let token = candidate.smsToken;
      if (
        !token ||
        !candidate.tokenExpiry ||
        candidate.tokenExpiry <= new Date()
      ) {
        token = nanoid(32);
        const updated = await this.prisma.candidate.updateMany({
          where: {
            id,
            updatedAt: candidate.updatedAt,
            status: { in: ["LEAD", "SMS_SENT"] },
          },
          data: {
            smsToken: token,
            tokenExpiry: new Date(Date.now() + 48 * 60 * 60 * 1000),
          },
        });
        if (updated.count !== 1) {
          results.push({
            id,
            success: false,
            channel,
            message: "Candidate changed. Refresh before sending.",
          });
          continue;
        }
      }
      const domain = TenantContext.get()?.domain;
      const base =
        !domain || domain === "localhost" || domain === "127.0.0.1"
          ? this.config.get<string>("FRONTEND_DEV_URL") ||
            "http://localhost:4200"
          : `https://${domain}`;
      const link = `${base}/register/${token}`;
      const expiry =
        candidate.smsToken === token && candidate.tokenExpiry
          ? candidate.tokenExpiry
          : new Date(Date.now() + 48 * 60 * 60 * 1000);
      const body = `Hello ${candidate.name}, please complete your driver application: ${link}\nThis link expires on ${expiry.toUTCString()}.`;
      try {
        const escape = (value: string) =>
          value.replace(
            /[&<>"']/g,
            (char) =>
              ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
              })[char]!
          );
        const result =
          channel === "email"
            ? await this.email.sendEmail({
                to: candidate.email!,
                subject: "Complete your driver application",
                text: body,
                html: `<p>${escape(body).replace(/\n/g, "<br>")}</p>`,
              })
            : await this.messaging.send({
                channel: "whatsapp",
                to: toE164(candidate.phoneNumber),
                template: {
                  name:
                    this.config.get<string>("RECRUITMENT_INVITE_TEMPLATE") ||
                    "registration_link",
                  variables: [link],
                },
              });
        if (!result.success) {
          results.push({
            id,
            success: false,
            channel,
            message:
              "The provider could not send the invitation. Please try again later.",
          });
          continue;
        }
        await this.prisma.candidate.updateMany({
          where: { id, status: { in: ["LEAD", "SMS_SENT"] } },
          data: { status: "SMS_SENT", initialContactDone: true },
        });
        await this.audit.record({
          action: "Registration invitation sent",
          entityType: "Candidate",
          entityId: id,
          actorUserId,
          summary: `Registration invitation sent by ${channel}`,
          metadata: { channel },
        });
        results.push({
          id,
          success: true,
          channel,
          message: "Invitation sent.",
        });
      } catch {
        results.push({
          id,
          success: false,
          channel,
          message:
            "Could not confirm delivery. Check the provider before retrying.",
        });
      }
    }
    return { sent: results.filter((result) => result.success).length, results };
  }

  private async getCandidate(id: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { id } });
    if (!candidate) throw new NotFoundException("Candidate not found");
    if (candidate.userId || candidate.status === "ACTIVE_DRIVER")
      throw new BadRequestException(
        "This candidate is already active and archived."
      );
    return candidate;
  }

  private async change(
    candidate: Candidate,
    data: Prisma.CandidateUpdateManyMutationInput,
    action: string,
    actorUserId: string
  ) {
    await this.prisma.tenantTransaction(async (tx) => {
      const result = await tx.candidate.updateMany({
        where: { id: candidate.id, updatedAt: candidate.updatedAt },
        data,
      });
      if (result.count !== 1)
        throw new ConflictException(
          "This candidate changed. Refresh and try again."
        );
      await this.audit.record(
        {
          action,
          entityType: "Candidate",
          entityId: candidate.id,
          actorUserId,
          summary: `${action}: ${candidate.name}`,
        },
        tx
      );
    });
    return this.recruitment.getCandidateById(candidate.id);
  }

  async reviewDocument(
    id: string,
    dto: ReviewDocumentDto,
    actorUserId: string
  ) {
    const candidate = await this.getCandidate(id);
    if (
      !(["FORM_COMPLETED", "DOCUMENTS_UPLOADED"] as CandidateStatus[]).includes(
        candidate.status
      )
    )
      throw new BadRequestException(
        "Document review requires a submitted application."
      );
    const documents = documentObject(candidate.documents);
    if (!documentValue(documents, dto.document))
      throw new BadRequestException("This document has not been uploaded.");
    if (dto.decision === "rejected" && !dto.reason?.trim())
      throw new BadRequestException("Explain why the document was rejected.");
    const review = recruitmentReview(documents);
    review.documentReviews[dto.document] = {
      status: dto.decision,
      reason: dto.reason?.trim() || "",
      reviewedAt: new Date().toISOString(),
      reviewedBy: actorUserId,
    };
    review.documentsStatus = Object.values(review.documentReviews).some(
      (item) => item?.status === "rejected"
    )
      ? "rejected"
      : "pending";
    documents._recruitment = review;
    if (documentsReady(documents)) review.documentsStatus = "approved";
    return this.change(
      candidate,
      {
        documents: documents as Prisma.InputJsonValue,
        status:
          review.documentsStatus === "approved"
            ? "BACKGROUND_CHECK"
            : "DOCUMENTS_UPLOADED",
      },
      "Document review updated",
      actorUserId
    );
  }

  async replaceDocument(
    id: string,
    dto: ReplaceDocumentDto,
    actorUserId: string
  ) {
    const candidate = await this.getCandidate(id);
    if (
      candidate.status !== "FORM_COMPLETED" &&
      candidate.status !== "DOCUMENTS_UPLOADED"
    )
      throw new BadRequestException(
        "Replace documents while the application is awaiting document review."
      );
    const bytes = Buffer.from(dto.image, "base64");
    const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp =
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP";
    if (
      !bytes.length ||
      bytes.length > 5 * 1024 * 1024 ||
      !(png || jpeg || webp)
    )
      throw new BadRequestException(
        "Choose a PNG, JPEG or WebP image up to 5 MB."
      );
    const documents = documentObject(candidate.documents);
    const review = recruitmentReview(documents);
    delete review.documentReviews[dto.document];
    review.documentsStatus = Object.values(review.documentReviews).some(
      (entry) => entry?.status === "rejected"
    )
      ? "rejected"
      : "pending";
    documents[dto.document] =
      `data:image/${png ? "png" : jpeg ? "jpeg" : "webp"};base64,${dto.image}`;
    documents._recruitment = review;
    return this.change(
      candidate,
      {
        documents: documents as Prisma.InputJsonValue,
        status: "DOCUMENTS_UPLOADED",
      },
      "Application document replaced",
      actorUserId
    );
  }

  async reviewBackground(
    id: string,
    dto: ReviewBackgroundDto,
    actorUserId: string
  ) {
    const candidate = await this.getCandidate(id);
    const review = recruitmentReview(candidate.documents);
    if (
      candidate.status !== "BACKGROUND_CHECK" &&
      !(
        candidate.status === "REJECTED" &&
        review.background?.status === "rejected"
      )
    )
      throw new BadRequestException(
        "Candidate is not awaiting a background decision."
      );
    if (dto.decision === "rejected" && !dto.reason?.trim())
      throw new BadRequestException(
        "Explain why the background check was rejected."
      );
    review.background = {
      status: dto.decision,
      reason: dto.reason?.trim() || "",
      reviewedAt: new Date().toISOString(),
      reviewedBy: actorUserId,
    };
    return this.change(
      candidate,
      {
        documents: {
          ...documentObject(candidate.documents),
          _recruitment: review,
        } as unknown as Prisma.InputJsonValue,
        status:
          dto.decision === "approved"
            ? "APPROVED"
            : dto.decision === "rejected"
              ? "REJECTED"
              : "BACKGROUND_CHECK",
      },
      "Background review updated",
      actorUserId
    );
  }

  async scheduleClassroom(id: string, date: string, actorUserId: string) {
    const candidate = await this.getCandidate(id);
    if (
      !(
        candidate.status === "APPROVED" ||
        candidate.status === "CLASSROOM_SCHEDULED"
      )
    )
      throw new BadRequestException(
        "Pass the background check before scheduling classroom training."
      );
    const classroomDate = new Date(date);
    if (Number.isNaN(classroomDate.getTime()) || classroomDate <= new Date())
      throw new BadRequestException("Choose a future classroom date and time.");
    return this.change(
      candidate,
      { classroomDate, status: "CLASSROOM_SCHEDULED" },
      "Classroom scheduled",
      actorUserId
    );
  }

  async completeClassroom(id: string, actorUserId: string) {
    const candidate = await this.getCandidate(id);
    if (candidate.status !== "CLASSROOM_SCHEDULED" || !candidate.classroomDate)
      throw new BadRequestException(
        "Schedule classroom training before completing it."
      );
    if (candidate.classroomDate > new Date())
      throw new BadRequestException("Classroom training has not started yet.");
    return this.change(
      candidate,
      { status: "CLASSROOM_COMPLETED" },
      "Classroom completed",
      actorUserId
    );
  }

  async scheduleRideAlong(
    id: string,
    dto: ScheduleRideAlongDto,
    actorUserId: string
  ) {
    return this.recruitment.convertToDriver(id, dto, actorUserId);
  }
}
