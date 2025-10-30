import { IsArray, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SendInvoicesDto {
  @ApiProperty({ description: "Array of invoice IDs to send" })
  @IsArray()
  @IsString({ each: true })
  readonly invoiceIds: string[];
}

export interface SendInvoicesResult {
  readonly total: number;
  readonly sent: number;
  readonly failed: number;
  readonly results: Array<{
    readonly invoiceId: string;
    readonly invoiceNumber: string;
    readonly driverEmail: string;
    readonly success: boolean;
    readonly error?: string;
  }>;
}
