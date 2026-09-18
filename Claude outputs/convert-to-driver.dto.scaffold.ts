// Scaffold for api/src/recruitment/dto/convert-to-driver.dto.ts

import { IsUUID, IsNotEmpty } from 'class-validator';

export class ConvertToDrivierDto {
  @IsNotEmpty()
  @IsUUID()
  depot_id: string;
}

export class ConvertToDrivierResponseDto {
  success: boolean;
  driverId: string;
  userId: string;
  email: string;
  message: string;
}
