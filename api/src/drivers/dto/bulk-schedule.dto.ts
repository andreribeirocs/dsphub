import { IsArray, ValidateNested } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { CreateScheduleDto } from "./create-schedule.dto";

export class BulkScheduleDto {
  @ApiProperty({
    description: "Array of schedules to create",
    type: [CreateScheduleDto],
    example: [
      {
        driverId: "clr123456789",
        date: "2024-01-15",
        status: "SCHEDULED",
        startTime: "08:00",
        endTime: "16:00",
        notes: "Regular route",
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateScheduleDto)
  readonly schedules: CreateScheduleDto[];
}
