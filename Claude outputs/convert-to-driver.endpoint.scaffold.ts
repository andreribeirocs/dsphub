// Scaffold for api/src/recruitment/recruitment.controller.ts
// Add this endpoint to convert candidate to driver

import {
  Controller,
  Post,
  Param,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { RecruitmentService } from './recruitment.service';
import { ConvertToDrivierDto } from './dto/convert-to-driver.dto';
import { TenantGuard } from '../tenancy/tenant.guard';
import { CurrentOrganization } from '../tenancy/current-organization.decorator';

@Controller('recruitment')
@UseGuards(TenantGuard)
export class RecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  // ... existing endpoints ...

  @Post('convert-to-driver/:candidateId')
  async convertToDriver(
    @Param('candidateId') candidateId: string,
    @Body() dto: ConvertToDrivierDto,
    @CurrentOrganization() organizationId: string,
  ) {
    /**
     * Converts a candidate to a driver:
     * 1. Validates candidate exists and belongs to this DSP
     * 2. Validates depot_id exists and is active
     * 3. Creates Driver record with homeDepotId
     * 4. Creates User with role DRIVER
     * 5. Marks candidate as converted (status: CONVERTED or similar)
     * 6. Logs audit event
     *
     * Returns: { success: true, driverId, userId, message: string }
     */
    const result = await this.recruitmentService.convertCandidateToDriver(
      candidateId,
      dto.depot_id,
      organizationId,
    );

    return result;
  }
}
