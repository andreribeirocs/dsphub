import {
  IsString,
  IsOptional,
  IsEmail,
  IsDateString,
  IsNumber,
  IsBoolean,
  Matches,
  IsEnum,
  IsBase64,
  Min,
  Max,
  Length,
} from "class-validator";
import { CandidateStatus } from "@prisma/client";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateCandidateDto {
  @ApiProperty({
    description: "Candidate name",
    required: false,
    example: "John Doe",
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: "Phone number in international format",
    required: false,
    example: "+447123456789",
  })
  @IsString()
  @IsOptional()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: "Phone number must be a valid international format",
  })
  phoneNumber?: string;

  @ApiProperty({
    description: "Email address",
    required: false,
    example: "john@example.com",
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: "Physical address",
    required: false,
    example: "123 Main St, London",
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    description: "Candidate source (website, referral, etc.)",
    required: false,
    example: "Website",
  })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiProperty({
    description: "Date of birth",
    required: false,
    example: "1990-01-15",
  })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiProperty({
    description: "Age (calculated from date of birth)",
    required: false,
    example: 34,
  })
  @IsNumber()
  @IsOptional()
  @Min(16)
  @Max(100)
  age?: number;

  @ApiProperty({
    description: "Citizenship",
    required: false,
    example: "British",
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  citizenship?: string;

  @ApiProperty({
    description: "Postal code",
    required: false,
    example: "SW1A 1AA",
  })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiProperty({
    description: "Document number (passport, ID, etc.)",
    required: false,
    example: "P123456789",
  })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  documentNumber?: string;

  @ApiProperty({
    description: "Insurance policy number",
    required: false,
    example: "INS123456",
  })
  @IsString()
  @IsOptional()
  insuranceNumber?: string;

  @ApiProperty({
    description: "Insurance document image in base64 format",
    required: false,
  })
  @IsString()
  @IsOptional()
  insuranceNumberImage?: string;

  @ApiProperty({
    description: "Driver license number",
    required: false,
    example: "DL123456",
  })
  @IsString()
  @IsOptional()
  driverLicense?: string;

  @ApiProperty({
    description: "Driver license image in base64 format",
    required: false,
  })
  @IsString()
  @IsOptional()
  driverLicenseImage?: string;

  @ApiProperty({
    description: "Address proof document in base64 format",
    required: false,
  })
  @IsString()
  @IsOptional()
  addressProofImage?: string;

  @ApiProperty({
    description: "Passport/Visa expiry date",
    required: false,
    example: "2030-12-31",
  })
  @IsDateString()
  @IsOptional()
  passportVisaExpiry?: string;

  @ApiProperty({
    description: "Right to Work expiry date",
    required: false,
    example: "2030-12-31",
  })
  @IsDateString()
  @IsOptional()
  rtwExpiry?: string;

  @ApiProperty({
    description: "License expiry date",
    required: false,
    example: "2030-12-31",
  })
  @IsDateString()
  @IsOptional()
  licenceExpiry?: string;

  @ApiProperty({
    description: "DVLA points",
    required: false,
    example: 0,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(50)
  points?: number;

  @ApiProperty({
    description: "Next DVLA check date",
    required: false,
    example: "2025-12-31",
  })
  @IsDateString()
  @IsOptional()
  nextDVLA?: string;

  @ApiProperty({
    description: "Last check date",
    required: false,
    example: "2024-12-31T10:30:00Z",
  })
  @IsDateString()
  @IsOptional()
  lastCheck?: string;

  @ApiProperty({
    description: "Last check on (alternative field)",
    required: false,
    example: "2024-12-31T10:30:00Z",
  })
  @IsDateString()
  @IsOptional()
  lastCheckOn?: string;

  @ApiProperty({
    description: "Service Level Agreement",
    required: false,
    example: "Standard",
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  sla?: string;

  @ApiProperty({
    description: "Account type",
    required: false,
    example: "Individual",
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  account?: string;

  @ApiProperty({
    description: "Whether registration form was completed",
    required: false,
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  formCompleted?: boolean;

  // Driver-specific fields
  @ApiProperty({
    description: "Driver ID",
    required: false,
    example: "DRV001",
  })
  @IsString()
  @IsOptional()
  driverId?: string;

  @ApiProperty({
    description: "TLC License number",
    required: false,
    example: "TLC123456",
  })
  @IsString()
  @IsOptional()
  tlcLicense?: string;

  @ApiProperty({
    description: "TLC License expiry date",
    required: false,
    example: "2030-12-31",
  })
  @IsDateString()
  @IsOptional()
  tlcLicenseExpiry?: string;

  @ApiProperty({
    description: "Vehicle ID",
    required: false,
    example: "VEH001",
  })
  @IsString()
  @IsOptional()
  vehicleId?: string;

  @ApiProperty({
    description: "Route ID",
    required: false,
    example: "RT001",
  })
  @IsString()
  @IsOptional()
  routeId?: string;

  @ApiProperty({
    description: "Sign up date",
    required: false,
    example: "2024-01-15",
  })
  @IsDateString()
  @IsOptional()
  signUpDate?: string;

  @ApiProperty({
    description: "Start working date",
    required: false,
    example: "2024-02-01",
  })
  @IsDateString()
  @IsOptional()
  startWorkingDate?: string;

  @ApiProperty({
    description: "Last working date",
    required: false,
    example: "2024-12-31",
  })
  @IsDateString()
  @IsOptional()
  lastWorkingDate?: string;

  @ApiProperty({
    description: "Whether driver is currently active",
    required: false,
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: "Whether onboarding is completed",
    required: false,
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  onboardingCompleted?: boolean;

  @ApiProperty({
    description: "Background check status",
    required: false,
    example: "PASSED",
  })
  @IsString()
  @IsOptional()
  backgroundCheckStatus?: string;

  @ApiProperty({
    description: "Background check date",
    required: false,
    example: "2024-01-20",
  })
  @IsDateString()
  @IsOptional()
  backgroundCheckDate?: string;

  @ApiProperty({
    description: "Emergency contact name",
    required: false,
    example: "Jane Doe",
  })
  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @ApiProperty({
    description: "Emergency contact phone",
    required: false,
    example: "+447123456789",
  })
  @IsString()
  @IsOptional()
  @Matches(/^\+?[1-9]\d{1,14}$/)
  emergencyContactPhone?: string;

  @ApiProperty({
    description: "Emergency contact relationship",
    required: false,
    example: "Spouse",
  })
  @IsString()
  @IsOptional()
  emergencyContactRelationship?: string;

  @ApiProperty({
    description: "Pay rate",
    required: false,
    example: 15.5,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  payRate?: number;

  @ApiProperty({
    description: "Pay type",
    required: false,
    example: "HOURLY",
  })
  @IsString()
  @IsOptional()
  payType?: string;

  @ApiProperty({
    description: "Medical certificate in base64 format",
    required: false,
  })
  @IsString()
  @IsOptional()
  medicalCertificate?: string;

  @ApiProperty({
    description: "Medical certificate expiry date",
    required: false,
    example: "2025-12-31",
  })
  @IsDateString()
  @IsOptional()
  medicalCertificateExpiry?: string;

  @ApiProperty({
    description: "Drug test result",
    required: false,
    example: "NEGATIVE",
  })
  @IsString()
  @IsOptional()
  drugTestResult?: string;

  @ApiProperty({
    description: "Drug test date",
    required: false,
    example: "2024-01-15",
  })
  @IsDateString()
  @IsOptional()
  drugTestDate?: string;

  @ApiProperty({
    description: "Training certificate in base64 format",
    required: false,
  })
  @IsString()
  @IsOptional()
  trainingCertificate?: string;

  @ApiProperty({
    description: "Training completion date",
    required: false,
    example: "2024-02-15",
  })
  @IsDateString()
  @IsOptional()
  trainingCompletionDate?: string;

  @ApiProperty({
    description: "Additional notes about the candidate",
    required: false,
    example: "Passed background check on 2024-03-20",
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({
    description: "Current status of the candidate",
    required: false,
    enum: CandidateStatus,
    example: "APPROVED",
  })
  @IsEnum(CandidateStatus)
  @IsOptional()
  status?: CandidateStatus;
}
