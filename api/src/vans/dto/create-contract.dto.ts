import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDecimal,
  IsDateString,
  IsBoolean,
  IsEmail,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ContractStatus } from "@prisma/client";
import { Transform } from "class-transformer";

export class CreateContractDto {
  @ApiProperty({
    description: "Contract name",
    example: "Amazon",
  })
  @IsString()
  @IsNotEmpty()
  readonly name!: string;

  @ApiProperty({
    description: "Depot location",
    example: "DP01",
  })
  @IsString()
  @IsNotEmpty()
  readonly depot!: string;

  @ApiProperty({
    description: "Hire contact name",
    example: "Marcos",
  })
  @IsString()
  @IsNotEmpty()
  readonly hireName!: string;

  @ApiProperty({
    description: "Monthly rental rate",
    example: "399.00",
    type: "string",
  })
  @IsDecimal({ decimal_digits: "2" })
  @IsNotEmpty()
  @Transform(({ value }) => parseFloat(value).toFixed(2))
  readonly rentalRate!: string;

  @ApiProperty({
    description: "Contract start date",
    example: "2024-01-01",
  })
  @IsDateString()
  @IsNotEmpty()
  readonly startDate!: string;

  @ApiPropertyOptional({
    enum: ContractStatus,
    description: "Contract status",
    example: "ACTIVE",
  })
  @IsOptional()
  @IsEnum(ContractStatus)
  readonly status?: ContractStatus;

  @ApiPropertyOptional({
    description: "Insurance coverage included",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  readonly hasInsurance?: boolean;

  @ApiPropertyOptional({
    description: "Vehicle supplier",
    example: "Enterprise",
  })
  @IsOptional()
  @IsString()
  readonly supplier?: string;

  @ApiPropertyOptional({
    description: "Contract end date",
    example: "2024-12-31",
  })
  @IsOptional()
  @IsDateString()
  readonly endDate?: string;

  @ApiPropertyOptional({
    description: "Contact email",
    example: "marcos@amazon.com",
  })
  @IsOptional()
  @IsEmail()
  readonly contactEmail?: string;

  @ApiPropertyOptional({
    description: "Contact phone number",
    example: "+44 20 1234 5678",
  })
  @IsOptional()
  @IsString()
  readonly contactPhone?: string;

  @ApiPropertyOptional({
    description: "Contract description",
    example: "Full fleet rental agreement for Amazon logistics",
  })
  @IsOptional()
  @IsString()
  readonly description?: string;
}
