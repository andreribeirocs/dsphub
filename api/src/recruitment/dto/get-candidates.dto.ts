import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CandidateStatus } from '@prisma/client';

export class GetCandidatesDto {
  @ApiProperty({
    required: false,
    description: 'Page number (zero-based)',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number = 0;

  @ApiProperty({
    required: false,
    description: 'Page size',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  @ApiProperty({
    required: false,
    description: 'Candidate status filter',
    enum: CandidateStatus,
  })
  @IsOptional()
  @IsEnum(CandidateStatus)
  status?: CandidateStatus;

  @ApiProperty({
    required: false,
    description: 'Search by name or phone number',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
