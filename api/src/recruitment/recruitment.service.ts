import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../shared/services/twilio.service';
import { ConfigService } from '@nestjs/config';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { GetCandidatesDto } from './dto/get-candidates.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { nanoid } from 'nanoid';

@Injectable()
export class RecruitmentService {
  private readonly logger = new Logger(RecruitmentService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsAppService,
    private configService: ConfigService,
  ) {}

  async createCandidate(createCandidateDto: CreateCandidateDto) {
    const existingCandidate = await this.prisma.candidate.findFirst({
      where: { phoneNumber: createCandidateDto.phoneNumber },
    });

    if (existingCandidate) {
      throw new BadRequestException(
        'Candidate with this phone number already exists',
      );
    }

    const smsToken = nanoid(7);
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 48);

    const candidate = await this.prisma.candidate.create({
      data: {
        ...createCandidateDto,
        smsToken,
        tokenExpiry,
        status: 'LEAD',
      },
    });

    return candidate;
  }

  async sendSms(candidateId: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    const registrationLink = `https://candidate.dsphub.co.uk/${candidate.smsToken}`;

    // Get the template SID from environment variables - now required for WhatsApp
    const templateSid = this.configService.get<string>(
      'TWILIO_WHATSAPP_TEMPLATE_SID',
    );

    if (!templateSid) {
      this.logger.error(
        'TWILIO_WHATSAPP_TEMPLATE_SID is required for WhatsApp business messaging',
      );
      throw new BadRequestException(
        'WhatsApp template not configured. Please set TWILIO_WHATSAPP_TEMPLATE_SID environment variable with your approved template SID.',
      );
    }

    // Validate template SID format (should start with HX)
    if (!templateSid.startsWith('HX')) {
      this.logger.error(
        `Invalid template SID format: ${templateSid}. Template SID should start with 'HX'`,
      );
      throw new BadRequestException(
        'Invalid WhatsApp template configuration. The template SID should start with "HX". Please check your Twilio Console for the correct template SID.',
      );
    }

    // Use template with variables (required for WhatsApp business messaging)
    const templateVariables = [registrationLink];

    const smsSent = await this.whatsappService.sendWhatsAppTemplate(
      candidate.phoneNumber,
      templateSid,
      templateVariables,
    );

    if (smsSent) {
      await this.prisma.candidate.update({
        where: { id: candidateId },
        data: { status: 'SMS_SENT' },
      });

      return {
        success: true,
        message: 'WhatsApp message sent successfully',
        registrationLink,
      };
    } else {
      throw new BadRequestException('Failed to send WhatsApp message');
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
      throw new NotFoundException('Invalid or expired token');
    }

    return {
      candidateId: candidate.id,
      name: candidate.name,
      phone: candidate.phoneNumber,
    };
  }

  async completeRegistration(completeRegistrationDto: CompleteRegistrationDto) {
    const {
      token,
      address,
      insuranceNumber,
      driverLicense,
      driverLicenseImage,
      insuranceImage,
      addressProofImage,
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
      throw new NotFoundException('Invalid or expired token');
    }

    const documents = {
      driverLicenseImage,
      insuranceImage,
      addressProofImage,
    };

    const updatedCandidate = await this.prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        address,
        insuranceNumber,
        driverLicense,
        documents,
        status: 'DOCUMENTS_UPLOADED',
        notes: comments || candidate.notes,
      },
    });

    const { documents: _, ...result } = updatedCandidate;

    return {
      ...result,
      message: 'Registration completed successfully',
    };
  }

  async getAllCandidates(query: GetCandidatesDto) {
    const { page = 0, pageSize = 10, status, search } = query;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    try {
      const total = await this.prisma.candidate.count({ where });

      const candidates = await this.prisma.candidate.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
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
    } catch (error) {
      this.logger.error(`Error retrieving candidates: ${error.message}`);
      throw new BadRequestException('Failed to retrieve candidates');
    }
  }

  async getCandidateById(id: string) {
    if (!id) {
      throw new BadRequestException('Candidate ID is required');
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
        `Error retrieving candidate ${id}: ${error.message}`,
        error.stack,
      );

      if (error.code === 'P2023') {
        throw new BadRequestException('Invalid candidate ID format');
      }

      throw new BadRequestException('Failed to retrieve candidate information');
    }
  }

  async updateCandidate(id: string, updateCandidateDto: UpdateCandidateDto) {
    if (!id) {
      throw new BadRequestException('Candidate ID is required');
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
            'Phone number is already in use by another candidate',
          );
        }
      }

      // Prepare documents object
      const documents = {
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
        driverLicenseImage,
        insuranceNumberImage,
        addressProofImage,
        ...updateData
      } = updateCandidateDto;

      // Update the candidate
      const updatedCandidate = await this.prisma.candidate.update({
        where: { id },
        data: {
          ...updateData,
          documents,
        },
      });

      // Remove sensitive information
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
        `Error updating candidate ${id}: ${error.message}`,
        error.stack,
      );

      if (error.code === 'P2023') {
        throw new BadRequestException('Invalid candidate ID format');
      }

      throw new BadRequestException('Failed to update candidate information');
    }
  }

  async deleteCandidate(id: string) {
    if (!id) {
      throw new BadRequestException('Candidate ID is required');
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
        message: 'Candidate deleted successfully',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Error deleting candidate ${id}: ${error.message}`,
        error.stack,
      );

      if (error.code === 'P2023') {
        throw new BadRequestException('Invalid candidate ID format');
      }

      throw new BadRequestException('Failed to delete candidate');
    }
  }
}
