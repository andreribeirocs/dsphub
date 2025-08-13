import { IsString, IsEnum, IsOptional, IsDateString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { ScheduleStatus } from "@prisma/client";

export class CreateScheduleDto {
  @ApiProperty({
    description: "Driver ID",
    example: "clr123456789",
  })
  @IsString()
  readonly driverId: string;

  @ApiProperty({
    description: "Schedule date in YYYY-MM-DD format",
    example: "2024-01-15",
  })
  @IsDateString()
  readonly date: string;

  @ApiProperty({
    description: "Schedule status",
    enum: ScheduleStatus,
    example: "SCHEDULED",
  })
  @IsEnum(ScheduleStatus)
  readonly status: ScheduleStatus;

  @ApiProperty({
    description: "Start time in HH:MM format",
    example: "08:00",
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly startTime?: string;

  @ApiProperty({
    description: "End time in HH:MM format",
    example: "16:00",
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly endTime?: string;

  @ApiProperty({
    description: "Additional notes for the schedule",
    example: "Regular route",
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly notes?: string;
}
