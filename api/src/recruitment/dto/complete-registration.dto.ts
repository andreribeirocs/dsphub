import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteRegistrationDto {
  @ApiProperty({
    example: 'abc123',
    description: 'Registration token from URL',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: '123 Main St, London', description: 'User address' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({ example: 'AB123456C', description: 'Insurance number' })
  @IsString()
  @IsNotEmpty()
  insuranceNumber!: string;

  @ApiProperty({
    example: 'DRIV1234567AB9CD',
    description: 'Driver license number',
  })
  @IsString()
  @IsNotEmpty()
  driverLicense!: string;

  @ApiProperty({
    description: 'Driver license image in base64 format',
  })
  @IsString()
  @IsNotEmpty()
  driverLicenseImage!: string;

  @ApiProperty({
    description: 'Insurance document image in base64 format',
  })
  @IsString()
  @IsNotEmpty()
  insuranceImage!: string;

  @ApiProperty({
    description: 'Address proof document image in base64 format',
  })
  @IsString()
  @IsNotEmpty()
  addressProofImage!: string;

  @ApiProperty({
    description: 'Additional comments',
    required: false,
  })
  @IsString()
  @IsOptional()
  comments?: string;
}
