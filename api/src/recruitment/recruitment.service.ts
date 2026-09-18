import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { SecureErrorUtil } from "../shared/utils/secure-error.util";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenancy/tenant-context";
import {
  MESSAGING_PROVIDER,
  MessagingProvider,
} from "../messaging/messaging.types";
import { toE164 } from "../messaging/phone.util";
import { ConfigService } from "@nestjs/config";
import { CreateCandidateDto } from "./dto/create-candidate.dto";
import { CompleteRegistrationDto } from "./dto/complete-registration.dto";
import { GetCandidatesDto } from "./dto/get-candidates.dto";
import { UpdateCandidateDto } from "./dto/update-candidate.dto";
import { ConvertToDriverDto } from "./dto/convert-to-driver.dto";
import { CandidateStatus, Prisma, UserRole, UserStatus } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { nanoid } from "nanoid";
import { AuditService } from "../audit/audit.service";
import { documentFlags, documentObject, recruitmentReview } from "./workflow/recruitment-workflow";

// Constants
const SMS_TOKEN_LENGTH = 32;
const TOKEN_EXPIRY_HOURS = 48;
const DEFAULT_PAGE_SIZE = 10;
/** Months between compliance checks, applied when a driver is first created */
const DRIVER_CHECK_INTERVAL_MONTHS = 6;
const GENERATED_PASSWORD_LENGTH = 16;

@Injectable()
export class RecruitmentService {
  private readonly logger = new Logger(RecruitmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MESSAGING_PROVIDER)
    private readonly messagingProvider: MessagingProvider,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService
  ) {}

  /**
   * Create a new candidate in the system
   * @param createCandidateDto - Candidate creation data
   * @returns Created candidate object
   * @throws BadRequestException if candidate already exists
   */
  async createCandidate(createCandidateDto: CreateCandidateDto) {
    const existingCandidate = await this.prisma.candidate.findFirst({
      where: { phoneNumber: createCandidateDto.phoneNumber },
    });

    if (existingCandidate) {
      throw new BadRequestException(
        "Candidate with this phone number already exists"
      );
    }

    const smsToken = nanoid(SMS_TOKEN_LENGTH);
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + TOKEN_EXPIRY_HOURS);

    const candidate = await this.prisma.candidate.create({
      data: {
        ...createCandidateDto,
        // organizationId is set from the request domain (TenantContext)
        organizationId: TenantContext.requireOrganizationId(),
        smsToken,
        tokenExpiry,
        status: "LEAD",
      },
    });

    return candidate;
  }

  /** Registration link on the DSP's own domain (the one this request came from) */
  private buildRegistrationLink(token: string | null): string {
    const domain = TenantContext.get()?.domain;
    const isLocal = !domain || domain === "localhost" || domain === "127.0.0.1";
    const base = isLocal
      ? this.configService.get<string>("FRONTEND_DEV_URL") || "http://localhost:4200"
      : `https://${domain}`;
    return `${base}/register/${token ?? ""}`;
  }

  async sendSms(candidateId: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      throw new NotFoundException("Candidate not found");
    }

    const registrationLink = this.buildRegistrationLink(candidate.smsToken);

    const templateName =
      this.configService.get<string>("RECRUITMENT_INVITE_TEMPLATE") ||
      "registration_link";

    const result = await this.messagingProvider.send({
      channel: "whatsapp",
      to: toE164(candidate.phoneNumber),
      template: { name: templateName, variables: [registrationLink] },
    });

    if (result.status === "not_configured") {
      throw new BadRequestException(
        `WhatsApp messaging is not configured yet, so nothing was sent. Share this registration link with the candidate manually: ${registrationLink}`
      );
    }

    if (!result.success) {
      this.logger.error(
        `Failed to send registration invite to candidate ${candidateId}: ${result.error}`
      );
      throw new BadRequestException("Failed to send WhatsApp message");
    }

    await this.prisma.candidate.update({
      where: { id: candidateId },
      data: { status: "SMS_SENT" },
    });

    return {
      success: true,
      message: "WhatsApp message sent successfully",
      registrationLink,
    };
  }

  async validateToken(token: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: {
        smsToken: token,
        tokenExpiry: {
          gte: new Date(),
        },
      },
    });

    if (!candidate) {
      throw new NotFoundException("Invalid or expired token");
    }

    // Check if candidate has already completed registration
    if (
      candidate.status === "DOCUMENTS_UPLOADED" ||
      candidate.status === "BACKGROUND_CHECK" ||
      candidate.status === "APPROVED"
    ) {
      return {
        candidateId: candidate.id,
        name: candidate.name,
        phone: candidate.phoneNumber,
        alreadyCompleted: true,
        status: candidate.status,
        completedAt: candidate.updatedAt,
      };
    }

    return {
      candidateId: candidate.id,
      name: candidate.name,
      phone: candidate.phoneNumber,
      alreadyCompleted: false,
    };
  }

  async completeRegistration(completeRegistrationDto: CompleteRegistrationDto) {
    const {
      token,
      email,
      dateOfBirth,
      address,
      postalCode,
      citizenship,
      documentNumber,
      insuranceNumber,
      driverLicense,
      driverLicenseExpiry,
      passportVisaExpiry,
      rtwExpiry,
      points,
      nextDVLA,
      sla,
      account,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelationship,
      driverLicenseImage,
      insuranceImage,
      addressProofImage,
      passportImage,
      rightToWorkImage,
      comments,
      contactPreference,
      applicationDetails,
    } = completeRegistrationDto;

    const candidate = await this.prisma.candidate.findFirst({
      where: {
        smsToken: token,
        tokenExpiry: {
          gte: new Date(),
        },
      },
    });

    if (!candidate) {
      throw new NotFoundException("Invalid or expired token");
    }

    // Prepare documents object with all uploaded files
    if (candidate.formCompleted || candidate.userId || !(["LEAD", "SMS_SENT"] as CandidateStatus[]).includes(candidate.status)) {
      throw new BadRequestException("This application has already been submitted. Contact the recruitment team to update your documents.");
    }
    if (contactPreference === "email" && !(email || candidate.email)) {
      throw new BadRequestException("Enter an email address to choose email as your preferred contact method.");
    }
    const documents = {
      driverLicenseImage,
      insuranceImage,
      addressProofImage,
      ...(passportImage && { passportImage }),
      ...(rightToWorkImage && { rightToWorkImage }),
    };

    // Calculate age from date of birth
    const dob = new Date(dateOfBirth);
    const age = Math.floor(
      (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    // Prepare additional data for the candidate record (stored in documents JSON for emergency contact)
    const additionalData = {
      applicationDetails: applicationDetails ?? {},
      contactPreference: contactPreference ?? "whatsapp",
      emergencyContact: {
        name: emergencyContactName,
        phone: emergencyContactPhone,
        relationship: emergencyContactRelationship,
      },
    };

    const updatedCandidate = await this.prisma.candidate.update({
      where: { id: candidate.id, updatedAt: candidate.updatedAt, status: { in: ["LEAD", "SMS_SENT"] } },
      data: {
        email: email || candidate.email,
        dateOfBirth: dob,
        age,
        citizenship,
        address,
        postalCode,
        documentNumber,
        insuranceNumber,
        driverLicense,
        licenceExpiry: driverLicenseExpiry
          ? new Date(driverLicenseExpiry)
          : null,
        passportVisaExpiry: passportVisaExpiry
          ? new Date(passportVisaExpiry)
          : null,
        rtwExpiry: rtwExpiry ? new Date(rtwExpiry) : null,
        points: points || 0,
        nextDVLA: nextDVLA ? new Date(nextDVLA) : null,
        sla,
        account,
        lastCheck: new Date(), // Set last check to now when registration is completed
        formCompleted: true,
        smsToken: null,
        tokenExpiry: null,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        documents: {
          ...documents,
          additionalData,
        } as any,
        status: "DOCUMENTS_UPLOADED",
        notes: comments || candidate.notes,
      },
    });

    const {
      documents: candidateDocuments,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      smsToken,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      tokenExpiry,
      ...result
    } = updatedCandidate;

    return {
      ...result,
      message: "Registration completed successfully",
      documentsUploaded: candidateDocuments
        ? Object.keys(candidateDocuments as Record<string, unknown>).length
        : 0,
    };
  }

  async getAllCandidates(query: GetCandidatesDto) {
    const { page = 0, pageSize = DEFAULT_PAGE_SIZE, status, search } = query;

    const where: Prisma.CandidateWhereInput = { status: { not: CandidateStatus.ACTIVE_DRIVER } };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    try {
      const total = await this.prisma.candidate.count({ where });

      const candidates = await this.prisma.candidate.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: page * pageSize,
        take: pageSize,
      });

      return {
        data: candidates.map(({ smsToken, tokenExpiry, ...candidate }) => ({
          ...candidate,
          documentFlags: documentFlags(candidate.documents),
          contactPreference: documentObject(documentObject(candidate.documents).additionalData).contactPreference ?? null,
        })),
        pagination: {
          page,
          pageSize,
          total,
          pageCount: Math.ceil(total / pageSize),
        },
      };
    } catch (error: unknown) {
      throw SecureErrorUtil.handleDatabaseError(error, "retrieve candidates");
    }
  }

  async getCandidateById(id: string) {
    if (!id) {
      throw new BadRequestException("Candidate ID is required");
    }

    try {
      const candidate = await this.prisma.candidate.findUnique({
        where: { id },
      });

      if (!candidate) {
        this.logger.warn(`Candidate not found with ID: ${id}`);
        throw new NotFoundException(`Candidate with ID ${id} not found`);
      }

      // Remove sensitive information
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { smsToken, tokenExpiry, ...safeCandidate } = candidate;

      // Count documents if they exist
      const documentsCount = candidate.documents
        ? Object.keys(candidate.documents as Record<string, unknown>).length
        : 0;

      return {
        ...safeCandidate,
        documentFlags: documentFlags(candidate.documents),
        contactPreference: documentObject(documentObject(candidate.documents).additionalData).contactPreference ?? null,
        documentsCount,
        lastUpdated: candidate.updatedAt,
        registrationDate: candidate.createdAt,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error retrieving candidate ${id}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined
      );

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error.code === "P2023"
      ) {
        throw new BadRequestException("Invalid candidate ID format");
      }

      throw new BadRequestException("Failed to retrieve candidate information");
    }
  }

  async updateCandidate(id: string, updateCandidateDto: UpdateCandidateDto) {
    if (!id) {
      throw new BadRequestException("Candidate ID is required");
    }

    try {
      // Check if candidate exists
      const existingCandidate = await this.prisma.candidate.findUnique({
        where: { id },
      });

      if (!existingCandidate) {
        this.logger.warn(`Candidate not found with ID: ${id}`);
        throw new NotFoundException(`Candidate with ID ${id} not found`);
      }

      if (updateCandidateDto.status && updateCandidateDto.status !== existingCandidate.status) {
        throw new BadRequestException("Use the Recruitment Management workflow to change a candidate's stage.");
      }

      // If phone number is being updated, check for duplicates
      if (
        updateCandidateDto.phoneNumber &&
        updateCandidateDto.phoneNumber !== existingCandidate.phoneNumber
      ) {
        const duplicatePhone = await this.prisma.candidate.findFirst({
          where: {
            phoneNumber: updateCandidateDto.phoneNumber,
            id: { not: id },
          },
        });

        if (duplicatePhone) {
          throw new BadRequestException(
            "Phone number is already in use by another candidate"
          );
        }
      }

      // Prepare documents object
      const updatedDocuments: Record<string, unknown> = {
        ...((existingCandidate.documents as Record<string, unknown>) || {}),
        ...(updateCandidateDto.driverLicenseImage && {
          driverLicenseImage: updateCandidateDto.driverLicenseImage,
        }),
        ...(updateCandidateDto.insuranceNumberImage && {
          insuranceImage: updateCandidateDto.insuranceNumberImage,
        }),
        ...(updateCandidateDto.addressProofImage && {
          addressProofImage: updateCandidateDto.addressProofImage,
        }),
      };

      // A replacement must be reviewed again; never keep an approval for an old image.
      const documentChanges = [
        ["driverLicenseImage", updateCandidateDto.driverLicenseImage],
        ["insuranceImage", updateCandidateDto.insuranceNumberImage],
        ["addressProofImage", updateCandidateDto.addressProofImage],
      ] as const;
      const changedKeys = documentChanges.filter(([key, value]) => value && value !== documentObject(existingCandidate.documents)[key]).map(([key]) => key);
      if (changedKeys.length && !existingCandidate.userId) {
        const review = recruitmentReview(existingCandidate.documents);
        for (const key of changedKeys) delete review.documentReviews[key];
        review.documentsStatus = Object.values(review.documentReviews).some(entry => entry?.status === "rejected") ? "rejected" : "pending";
        delete review.background;
        updatedDocuments._recruitment = review;
      }

      // Remove image fields from DTO as they'll be stored in documents
      const {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        driverLicenseImage,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        insuranceNumberImage,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        addressProofImage,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelationship,
        ...updateData
      } = updateCandidateDto;

      const additionalData = documentObject(updatedDocuments.additionalData);
      const emergencyContact = documentObject(additionalData.emergencyContact);
      if (emergencyContactName !== undefined) emergencyContact.name = emergencyContactName;
      if (emergencyContactPhone !== undefined) emergencyContact.phone = emergencyContactPhone;
      if (emergencyContactRelationship !== undefined) emergencyContact.relationship = emergencyContactRelationship;
      updatedDocuments.additionalData = { ...additionalData, emergencyContact };
      const dateUpdates = Object.fromEntries(
        ["dateOfBirth", "passportVisaExpiry", "rtwExpiry", "licenceExpiry", "nextDVLA", "lastCheck", "lastCheckOn"]
          .filter(key => typeof updateData[key as keyof typeof updateData] === "string")
          .map(key => [key, new Date(updateData[key as keyof typeof updateData] as string)])
      );

      // Update the candidate
      const updatedCandidate = await this.prisma.candidate.update({
        where: { id, updatedAt: existingCandidate.updatedAt },
        data: {
          ...updateData,
          ...dateUpdates,
          documents: updatedDocuments as Prisma.InputJsonValue,
          ...(changedKeys.length && !existingCandidate.userId ? { status: CandidateStatus.DOCUMENTS_UPLOADED, classroomDate: null, rideAlongDate: null } : {}),
        },
      });

      // Remove sensitive information
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { smsToken, tokenExpiry, ...safeCandidate } = updatedCandidate;

      // Count documents if they exist
      const documentsCount = updatedCandidate.documents
        ? Object.keys(updatedCandidate.documents as Record<string, unknown>)
            .length
        : 0;

      return {
        ...safeCandidate,
        documentsCount,
        lastUpdated: updatedCandidate.updatedAt,
        documentFlags: documentFlags(updatedCandidate.documents),
        contactPreference: documentObject(documentObject(updatedCandidate.documents).additionalData).contactPreference ?? null,
        registrationDate: updatedCandidate.createdAt,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating candidate ${id}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined
      );

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error.code === "P2023"
      ) {
        throw new BadRequestException("Invalid candidate ID format");
      }

      throw new BadRequestException("Failed to update candidate information");
    }
  }

  /**
   * Hire a candidate: create the DRIVER login and the Driver record, and close
   * the candidate out of the pipeline.
   *
   * Everything happens in one transaction — a driver without a login, or a
   * login without a driver, would leave the DSP in a state nobody can fix from
   * the screens.
   *
   * The Driver model requires several fields the Candidate holds as optional.
   * Rather than invent values, an incomplete candidate is rejected with the
   * list of what is missing, so the recruiter can finish the record first.
   */
  async convertToDriver(
    candidateId: string,
    dto: ConvertToDriverDto,
    actorUserId?: string
  ) {
    if (!candidateId) {
      throw new BadRequestException("Candidate ID is required");
    }

    const organizationId = TenantContext.requireOrganizationId();

    // Scoped to this DSP by the Prisma tenant extension: a candidate of
    // another DSP reads as "not found".
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate) {
      throw new NotFoundException(`Candidate with ID ${candidateId} not found`);
    }

    if (candidate.userId || candidate.status === CandidateStatus.ACTIVE_DRIVER) {
      throw new BadRequestException(
        "This candidate has already been hired as a driver"
      );
    }

    if (!dto.rideAlongDate) {
      throw new BadRequestException("Schedule a ride along to activate and archive this candidate.");
    }
    {
      if (!([CandidateStatus.CLASSROOM_COMPLETED, CandidateStatus.RIDE_ALONG_SCHEDULED, CandidateStatus.RIDE_ALONG_COMPLETED] as CandidateStatus[]).includes(candidate.status)) {
        throw new BadRequestException("Complete classroom training before scheduling a ride along.");
      }
      if (Number.isNaN(new Date(dto.rideAlongDate).getTime()) || new Date(dto.rideAlongDate) <= new Date()) {
        throw new BadRequestException("Choose a future ride along date and time.");
      }
    }

    const depot = await this.prisma.depot.findUnique({
      where: { id: dto.homeDepotId },
      select: { id: true, name: true, isActive: true },
    });
    if (!depot || !depot.isActive) {
      throw new BadRequestException("Home depot not found or inactive");
    }

    // Fields the Driver record cannot be created without
    const missing: string[] = [];
    if (!candidate.email) missing.push("email");
    if (!candidate.address) missing.push("address");
    if (candidate.age === null || candidate.age === undefined) missing.push("age");
    if (!candidate.citizenship) missing.push("citizenship");
    if (!candidate.licenceExpiry) missing.push("licence expiry");
    if (!candidate.passportVisaExpiry) missing.push("passport/visa expiry");
    if (!candidate.rtwExpiry) missing.push("right to work expiry");
    if (missing.length > 0) {
      throw new BadRequestException(
        `Candidate record is incomplete. Fill in before hiring: ${missing.join(", ")}`
      );
    }

    const email = candidate.email!.trim().toLowerCase();

    // Logins are global identities, so this check spans every DSP on purpose.
    const existingUser = await TenantContext.runAsSystem(() =>
      this.prisma.user.findUnique({ where: { email }, select: { id: true } })
    );
    if (existingUser) {
      throw new BadRequestException(
        "A user account with this email already exists"
      );
    }

    const duplicateTransporterId = await this.prisma.driver.findFirst({
      where: { transporterId: dto.transporterId.trim() },
      select: { id: true },
    });
    if (duplicateTransporterId) {
      throw new BadRequestException(
        "Another driver already uses this Transporter ID"
      );
    }

    const joinDate = dto.joinDate ? new Date(dto.joinDate) : new Date();
    // No compliance rule for this yet; six months is the interval the existing
    // records use. Reviewed on the driver screen like any other date.
    const nextCheck = new Date(joinDate);
    nextCheck.setMonth(nextCheck.getMonth() + DRIVER_CHECK_INTERVAL_MONTHS);

    const generatedPassword = dto.password ? null : nanoid(GENERATED_PASSWORD_LENGTH);
    const password = dto.password ?? generatedPassword!;
    const passwordHash = await hashPassword(password);

    const result = await this.prisma.tenantTransaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: candidate.name,
          role: UserRole.DRIVER,
          phoneNumber: candidate.phoneNumber,
          status: UserStatus.ACTIVE,
        },
      });

      await tx.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: passwordHash,
        },
      });

      // "member" is the better-auth organization role for every non-owner,
      // non-director user (see users.service memberRoleFor).
      await tx.member.create({
        data: { userId: user.id, organizationId, role: "member" },
      });

      const driver = await tx.driver.create({
        data: {
          organizationId,
          userId: user.id,
          name: candidate.name,
          email,
          corporateEmail: dto.corporateEmail?.trim().toLowerCase() ?? null,
          phone: candidate.phoneNumber,
          address: candidate.address!,
          age: candidate.age!,
          citizenship: candidate.citizenship!,
          transporterId: dto.transporterId.trim(),
          contractType: dto.contractType ?? null,
          homeDepotId: depot.id,
          // Legacy free-text column, kept in sync with the depot relation
          depot: depot.name,
          licenseNumber: candidate.driverLicense ?? null,
          licenseExpiry: candidate.licenceExpiry!,
          passportExpiry: candidate.passportVisaExpiry!,
          rtwExpiry: candidate.rtwExpiry!,
          insuranceNumber: candidate.insuranceNumber ?? null,
          points: candidate.points ?? 0,
          documents: candidate.documents ?? undefined,
          joinDate,
          lastCheck: candidate.lastCheck ?? joinDate,
          nextCheck,
          status: "ACTIVE",
          onboardingComplete: true,
          ...(dto.rideAlongDate ? { rideAlongDate: new Date(dto.rideAlongDate), classroomComplete: true, backgroundCheckDone: true } : {}),
        },
      });

      await tx.candidate.update({
        where: { id: candidate.id, updatedAt: candidate.updatedAt, status: candidate.status },
        data: { userId: user.id, status: CandidateStatus.ACTIVE_DRIVER, ...(dto.rideAlongDate ? { rideAlongDate: new Date(dto.rideAlongDate) } : {}) },
      });

      // Same transaction as the change itself: if anything above rolls back,
      // the trail does not claim a hire that never happened.
      await this.auditService.record(
        {
          action: "Candidate hired as driver",
          entityType: "Driver",
          entityId: driver.id,
          actorUserId,
          summary: `${candidate.name} hired as a driver at ${depot.name} (Transporter ID ${dto.transporterId.trim()})`,
          metadata: {
            candidateId: candidate.id,
            driverId: driver.id,
            userId: user.id,
            depotId: depot.id,
          },
        },
        tx
      );

      return { user, driver };
    });

    this.logger.log(
      `Candidate ${candidate.id} hired as driver ${result.driver.id} ` +
        `(user ${result.user.id}, depot ${depot.name}) in organization ${organizationId}`
    );

    return {
      success: true,
      driverId: result.driver.id,
      userId: result.user.id,
      email,
      // Shown once so the recruiter can hand it over; never stored in clear.
      generatedPassword,
      message: `${candidate.name} is now a driver at ${depot.name}`,
    };
  }

  async deleteCandidate(id: string) {
    if (!id) {
      throw new BadRequestException("Candidate ID is required");
    }

    try {
      // Check if candidate exists
      const existingCandidate = await this.prisma.candidate.findUnique({
        where: { id },
      });

      if (!existingCandidate) {
        this.logger.warn(`Candidate not found with ID: ${id}`);
        throw new NotFoundException(`Candidate with ID ${id} not found`);
      }

      // Delete the candidate
      await this.prisma.candidate.delete({
        where: { id },
      });

      return {
        success: true,
        message: "Candidate deleted successfully",
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Error deleting candidate ${id}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined
      );

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error.code === "P2023"
      ) {
        throw new BadRequestException("Invalid candidate ID format");
      }

      throw new BadRequestException("Failed to delete candidate");
    }
  }
}
