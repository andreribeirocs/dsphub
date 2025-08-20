import { IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { UserStatus } from "@prisma/client";

export class UpdateStatusDto {
  @ApiProperty({
    description: "New status for the user",
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  @IsEnum(UserStatus, { message: "Please provide a valid user status" })
  readonly status: UserStatus;
}
