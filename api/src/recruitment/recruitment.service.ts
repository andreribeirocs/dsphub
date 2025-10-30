import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { SecureErrorUtil } from "../shared/utils/secure-error.util";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsAppService } from "../shared/services/twilio.service";
import { ConfigService } from "@nestjs/config";
import { CreateCandidateDto } from "./dto/create-candidate.dto";
import { CompleteRegistrationDto } from "./dto/complete-registration.dto";
import { GetCandidatesDto } from "./dto/get-candidates.dto";
import { UpdateCandidateDto } from "./dto/update-candidate.dto";
import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";

// Constants
const SMS_TOKEN_LENGTH = 7;
const TOKEN_EXPIRY_HOURS = 48;
const DEFAULT_PAGE_SIZE = 10;

@Injectable()
export class RecruitmentService {
  private readonly logger = new Logger(RecruitmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsAppService,
    private readonly configService: ConfigService
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

    // Get default organization
    const organization = await this.prisma.organization.findUnique({
      where: { slug: "default" },
    });
    if (!organization) {
      throw new BadRequestException("Default organization not found");
    }

    const smsToken = nanoid(SMS_TOKEN_LENGTH);
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + TOKEN_EXPIRY_HOURS);

    const candidate = await this.prisma.candidate.create({
      data: {
        ...createCandidateDto,
        organizationId: organization.id,
        smsToken,
        tokenExpiry,
        status: "LEAD",
      },
    });

    return candidate;
  }

  async sendSms(candidateId: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      throw new NotFoundException("Candidate not found");
    }

    const registrationLink = `https://careers.dsphub.co.uk/register/${candidate.smsToken}`;

    // Get the template SID from environment variables - now required for WhatsApp
    const templateSid = this.configService.get<string>(
      "TWILIO_WHATSAPP_TEMPLATE_SID"
    );

    if (!templateSid) {
      this.logger.error(
        "TWILIO_WHATSAPP_TEMPLATE_SID is required for WhatsApp business messaging"
      );
      throw new BadRequestException(
        "WhatsApp template not configured. Please set TWILIO_WHATSAPP_TEMPLATE_SID environment variable with your approved template SID."
      );
    }

    // Validate template SID format (should start with HX)
    if (!templateSid.startsWith("HX")) {
      this.logger.error(
        `Invalid template SID format: ${templateSid}. Template SID should start with 'HX'`
      );
      throw new BadRequestException(
        'Invalid WhatsApp template configuration. The template SID should start with "HX". Please check your Twilio Console for the correct template SID.'
      );
    }

    // Use template with variables (required for WhatsApp business messaging)
    const templateVariables = [registrationLink];

    const smsSent = await this.whatsappService.sendWhatsAppTemplate(
      candidate.phoneNumber,
      templateSid,
      templateVariables
    );

    if (smsSent) {
      await this.prisma.candidate.update({
        where: { id: candidateId },
        data: { status: "SMS_SENT" },
      });

      return {
        success: true,
        message: "WhatsApp message sent successfully",
        registrationLink,
      };
    } else {
      throw new BadRequestException("Failed to send WhatsApp message");
    }
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
      emergencyContact: {
        name: emergencyContactName,
        phone: emergencyContactPhone,
        relationship: emergencyContactRelationship,
      },
    };

    const updatedCandidate = await this.prisma.candidate.update({
      where: { id: candidate.id },
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

    const where: Prisma.CandidateWhereInput = {};

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
        data: candidates,
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
      const updatedDocuments = {
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

      // Remove image fields from DTO as they'll be stored in documents
      const {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        driverLicenseImage,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        insuranceNumberImage,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        addressProofImage,
        ...updateData
      } = updateCandidateDto;

      // Update the candidate
      const updatedCandidate = await this.prisma.candidate.update({
        where: { id },
        data: {
          ...updateData,
          documents: updatedDocuments,
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
