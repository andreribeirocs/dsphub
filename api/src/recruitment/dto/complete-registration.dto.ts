import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsDateString,
  IsNumber,
  Matches,
  Length,
  Min,
  Max,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import {
  TrimWhitespace,
  NormalizeEmail,
  NoXSS,
  NoSqlInjection,
} from "../../shared/validation/custom-validators";

export class CompleteRegistrationDto {
  @ApiProperty({
    example: "abc123",
    description: "Registration token from URL",
  })
  @TrimWhitespace()
  @IsString({ message: "Token must be a string" })
  @IsNotEmpty({ message: "Registration token is required" })
  @Length(1, 255, { message: "Token must be between 1 and 255 characters" })
  @NoXSS()
  @NoSqlInjection()
  token!: string;

  @ApiProperty({
    example: "john.doe@example.com",
    description: "Email address",
    required: false,
  })
  @TrimWhitespace()
  @NormalizeEmail()
  @IsEmail({}, { message: "Please provide a valid email address" })
  @IsOptional()
  @Length(5, 254, { message: "Email must be between 5 and 254 characters" })
  @NoXSS()
  @NoSqlInjection()
  email?: string;

  @ApiProperty({
    example: "1990-01-15",
    description: "Date of birth in YYYY-MM-DD format",
  })
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth!: string;

  @ApiProperty({ example: "123 Main St, London", description: "User address" })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({
    example: "SW1A 1AA",
    description: "Postal code",
  })
  @IsString()
  @IsNotEmpty()
  postalCode!: string;

  @ApiProperty({
    example: "British",
    description: "Citizenship",
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(1, 100, {
    message: "Citizenship must be between 1 and 100 characters",
  })
  @NoXSS()
  @NoSqlInjection()
  citizenship?: string;

  @ApiProperty({
    example: "P123456789",
    description: "Document number (passport, ID, etc.)",
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(1, 50, {
    message: "Document number must be between 1 and 50 characters",
  })
  @NoXSS()
  @NoSqlInjection()
  documentNumber?: string;

  @ApiProperty({
    example: "2030-12-31",
    description: "Passport/Visa expiry date in YYYY-MM-DD format",
    required: false,
  })
  @IsDateString()
  @IsOptional()
  passportVisaExpiry?: string;

  @ApiProperty({
    example: "2030-12-31",
    description: "Right to Work expiry date in YYYY-MM-DD format",
    required: false,
  })
  @IsDateString()
  @IsOptional()
  rtwExpiry?: string;

  @ApiProperty({
    example: 0,
    description: "DVLA points",
    required: false,
  })
  @IsNumber({}, { message: "Points must be a number" })
  @Min(0, { message: "Points cannot be negative" })
  @Max(50, { message: "Points cannot exceed 50" })
  @IsOptional()
  points?: number;

  @ApiProperty({
    example: "2025-12-31",
    description: "Next DVLA check date in YYYY-MM-DD format",
    required: false,
  })
  @IsDateString()
  @IsOptional()
  nextDVLA?: string;

  @ApiProperty({
    example: "Standard",
    description: "Service Level Agreement type",
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(1, 100, { message: "SLA must be between 1 and 100 characters" })
  @NoXSS()
  @NoSqlInjection()
  sla?: string;

  @ApiProperty({
    example: "Corporate Account",
    description: "Account type or name",
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(1, 100, { message: "Account must be between 1 and 100 characters" })
  @NoXSS()
  @NoSqlInjection()
  account?: string;

  @ApiProperty({
    example: "AB123456C",
    description: "National Insurance number",
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-CEGHJ-PR-TW-Z]{1}[A-CEGHJ-NPR-TW-Z]{1}[0-9]{6}[A-D]{1}$/, {
    message: "Invalid National Insurance number format",
  })
  insuranceNumber!: string;

  @ApiProperty({
    example: "DRIV1234567AB9CD",
    description: "Driver license number",
  })
  @IsString()
  @IsNotEmpty()
  driverLicense!: string;

  @ApiProperty({
    example: "2030-12-31",
    description: "Driver license expiry date in YYYY-MM-DD format",
  })
  @IsDateString()
  @IsNotEmpty()
  driverLicenseExpiry!: string;

  @ApiProperty({
    example: "Jane Doe",
    description: "Emergency contact name",
  })
  @IsString()
  @IsNotEmpty()
  emergencyContactName!: string;

  @ApiProperty({
    example: "+447123456789",
    description: "Emergency contact phone number",
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: "Invalid phone number format",
  })
  emergencyContactPhone!: string;

  @ApiProperty({
    example: "Mother",
    description: "Relationship to emergency contact",
  })
  @IsString()
  @IsNotEmpty()
  emergencyContactRelationship!: string;

  @ApiProperty({
    description: "Driver license image in base64 format",
  })
  @IsString()
  @IsNotEmpty()
  driverLicenseImage!: string;

  @ApiProperty({
    description: "National Insurance document image in base64 format",
  })
  @IsString()
  @IsNotEmpty()
  insuranceImage!: string;

  @ApiProperty({
    description: "Address proof document image in base64 format",
  })
  @IsString()
  @IsNotEmpty()
  addressProofImage!: string;

  @ApiProperty({
    description: "Passport or ID document image in base64 format",
    required: false,
  })
  @IsString()
  @IsOptional()
  passportImage?: string;

  @ApiProperty({
    description: "Right to Work document image in base64 format",
    required: false,
  })
  @IsString()
  @IsOptional()
  rightToWorkImage?: string;

  @ApiProperty({
    description: "Additional comments or notes",
    required: false,
  })
  @IsString()
  @IsOptional()
  comments?: string;
}
