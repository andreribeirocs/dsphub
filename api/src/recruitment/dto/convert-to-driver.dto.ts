import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from "class-validator";

/**
 * Hiring a candidate: the recruiter supplies what the Driver record requires
 * and the Candidate record cannot provide.
 */
export class ConvertToDriverDto {
  @IsOptional()
  @IsDateString()
  rideAlongDate?: string;

  @ApiProperty({
    description: "Home depot the driver is based at (must be active)",
  })
  @IsString()
  @IsNotEmpty()
  homeDepotId!: string;

  @ApiProperty({
    description: "Amazon Transporter ID, unique within the DSP",
    example: "A1B2C3D4E5",
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 40)
  transporterId!: string;

  @ApiPropertyOptional({
    description: "Company-issued email address",
    example: "john.doe@mydsp.com",
  })
  @IsOptional()
  @IsEmail()
  @Length(0, 160)
  corporateEmail?: string;

  @ApiPropertyOptional({
    description: "First working day. Defaults to today.",
    example: "2026-10-01",
  })
  @IsOptional()
  @IsDateString()
  joinDate?: string;

  @ApiPropertyOptional({
    description: "Contract type, free text (e.g. PAYE, Ltd)",
  })
  @IsOptional()
  @IsString()
  @Length(0, 60)
  contractType?: string;

  @ApiPropertyOptional({
    description:
      "Password for the new driver login. Generated and returned once if omitted.",
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
