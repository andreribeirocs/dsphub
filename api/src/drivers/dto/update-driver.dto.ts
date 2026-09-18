import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
} from "class-validator";

export const DRIVER_STATUSES = ["ACTIVE", "PENDING", "SUSPENDED", "EXPIRED", "INACTIVE"] as const;

/** Fields a manager may change on a driver (identity comes from recruitment) */
export class UpdateDriverDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(6, 20)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: "Company-issued email address. Send an empty string to clear it.",
  })
  @IsOptional() @ValidateIf((o: UpdateDriverDto) => o.corporateEmail !== "")
  @IsEmail() @Length(0, 160)
  corporateEmail?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 250)
  address?: string;

  @ApiPropertyOptional({ enum: DRIVER_STATUSES }) @IsOptional() @IsIn(DRIVER_STATUSES)
  status?: (typeof DRIVER_STATUSES)[number];

  @ApiPropertyOptional({ description: "Home depot id" }) @IsOptional() @IsString()
  homeDepotId?: string;

  @ApiPropertyOptional({ description: "Amazon Transporter ID" }) @IsOptional() @IsString() @Length(0, 40)
  transporterId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 60)
  citizenship?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 60)
  contractType?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 40)
  licenseNumber?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  licenseExpiry?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  passportExpiry?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  rtwExpiry?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  nextCheck?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(12)
  points?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  hasEndorsements?: boolean;
}
