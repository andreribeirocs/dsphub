import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBase64,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { ConvertToDriverDto } from "./convert-to-driver.dto";
import {
  DOCUMENT_KEYS,
  DocumentKey,
  WORKFLOW_STAGES,
  WorkflowStage,
} from "../workflow/recruitment-workflow";

export class WorkflowQueryDto {
  @IsIn(WORKFLOW_STAGES) stage!: WorkflowStage;
  @IsOptional()
  @IsIn([
    "all",
    "pending",
    "sent",
    "rejected",
    "passed",
    "ready",
    "scheduled",
    "completed",
  ])
  bucket = "all";
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) page = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional() @IsString() @MaxLength(150) search?: string;
}

export class ImportLeadDto {
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(40) phoneNumber!: string;
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;
}
export class ImportLeadsDto {
  @IsString() @IsNotEmpty() @MaxLength(100) source!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportLeadDto)
  leads!: ImportLeadDto[];
}
export class BulkContactDto {
  @IsIn(["whatsapp", "email", "preferred"]) channel!:
    | "whatsapp"
    | "email"
    | "preferred";
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  candidateIds!: string[];
}
export class ReviewDocumentDto {
  @IsIn(DOCUMENT_KEYS) document!: DocumentKey;
  @IsIn(["approved", "rejected"]) decision!: "approved" | "rejected";
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}
export class ReplaceDocumentDto {
  @IsIn(DOCUMENT_KEYS) document!: DocumentKey;
  @IsString()
  @IsNotEmpty()
  @IsBase64()
  @MaxLength(7 * 1024 * 1024)
  image!: string;
}
export class ReviewBackgroundDto {
  @IsIn(["pending", "approved", "rejected"]) decision!:
    | "pending"
    | "approved"
    | "rejected";
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}
export class ScheduleClassroomDto {
  @IsDateString() date!: string;
}
export class ScheduleRideAlongDto extends ConvertToDriverDto {
  @IsDateString() override rideAlongDate = "";
}
