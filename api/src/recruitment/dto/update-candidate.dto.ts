import {
  IsString,
  IsOptional,
  IsEmail,
  Matches,
  IsEnum,
  IsBase64,
} from 'class-validator';
import { CandidateStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCandidateDto {
  @ApiProperty({
    description: 'Candidate name',
    required: false,
    example: 'John Doe',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Phone number in international format',
    required: false,
    example: '+447123456789',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone number must be a valid international format',
  })
  phoneNumber?: string;

  @ApiProperty({
    description: 'Email address',
    required: false,
    example: 'john@example.com',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Physical address',
    required: false,
    example: '123 Main St, London',
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    description: 'Insurance policy number',
    required: false,
    example: 'INS123456',
  })
  @IsString()
  @IsOptional()
  insuranceNumber?: string;

  @ApiProperty({
    description: 'Insurance document image in base64 format',
    required: false,
  })
  @IsBase64()
  @IsOptional()
  insuranceNumberImage?: string;

  @ApiProperty({
    description: 'Driver license number',
    required: false,
    example: 'DL123456',
  })
  @IsString()
  @IsOptional()
  driverLicense?: string;

  @ApiProperty({
    description: 'Driver license image in base64 format',
    required: false,
  })
  @IsBase64()
  @IsOptional()
  driverLicenseImage?: string;

  @ApiProperty({
    description: 'Address proof document in base64 format',
    required: false,
  })
  @IsBase64()
  @IsOptional()
  addressProofImage?: string;

  @ApiProperty({
    description: 'Additional notes about the candidate',
    required: false,
    example: 'Passed background check on 2024-03-20',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({
    description: 'Current status of the candidate',
    required: false,
    enum: CandidateStatus,
    example: 'APPROVED',
  })
  @IsEnum(CandidateStatus)
  @IsOptional()
  status?: CandidateStatus;
}
