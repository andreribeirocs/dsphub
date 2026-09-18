import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Query,
  Patch,
  Delete,
} from "@nestjs/common";
import { RecruitmentService } from "./recruitment.service";
import { CreateCandidateDto } from "./dto/create-candidate.dto";
import { SendSmsDto } from "./dto/send-sms.dto";
import { CompleteRegistrationDto } from "./dto/complete-registration.dto";
import { BetterAuthGuard } from "../auth/guards/better-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import {
  ThrottleStrict,
  ThrottleModerate,
} from "../auth/decorators/throttle.decorator";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import { GetCandidatesDto } from "./dto/get-candidates.dto";
import { UpdateCandidateDto } from "./dto/update-candidate.dto";
import { ConvertToDriverDto } from "./dto/convert-to-driver.dto";

@ApiTags("recruitment")
@Controller("recruitment")
export class RecruitmentController {
  constructor(private recruitmentService: RecruitmentService) {}

  @ApiOperation({
    summary: "Create a new candidate (recruitment manager only)",
  })
  @ApiResponse({ status: 201, description: "Candidate created successfully." })
  @ApiResponse({ status: 400, description: "Bad request." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiBearerAuth()
  @UseGuards(BetterAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_RECRUITMENT")
  @Post("candidates")
  async createCandidate(@Body() createCandidateDto: CreateCandidateDto) {
    return this.recruitmentService.createCandidate(createCandidateDto);
  }

  @ApiOperation({
    summary:
      "Send WhatsApp message with registration link to candidate (recruitment manager only)",
  })
  @ApiResponse({
    status: 200,
    description: "WhatsApp message sent successfully.",
  })
  @ApiResponse({ status: 404, description: "Candidate not found." })
  @ApiResponse({ status: 400, description: "Failed to send WhatsApp message." })
  @ApiResponse({ status: 429, description: "Too many requests." })
  @ThrottleStrict()
  @ApiBearerAuth()
  @UseGuards(BetterAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_RECRUITMENT")
  @Post("send-sms")
  async sendSms(@Body() sendSmsDto: SendSmsDto) {
    return this.recruitmentService.sendSms(sendSmsDto.candidateId);
  }

  @ApiOperation({ summary: "Validate registration token (public endpoint)" })
  @ApiResponse({ status: 200, description: "Token validated successfully." })
  @ApiResponse({ status: 404, description: "Token not found or expired." })
  @ApiParam({
    name: "token",
    description: "Registration token sent to candidate",
  })
  @Get("validate-token/:token")
  async validateToken(@Param("token") token: string) {
    return this.recruitmentService.validateToken(token);
  }

  @ApiOperation({
    summary: "Complete candidate registration with documents (public endpoint)",
  })
  @ApiResponse({
    status: 200,
    description: "Registration completed successfully.",
  })
  @ApiResponse({ status: 404, description: "Token not found or expired." })
  @ApiResponse({ status: 429, description: "Too many requests." })
  @ThrottleModerate()
  @Post("complete-registration")
  async completeRegistration(
    @Body() completeRegistrationDto: CompleteRegistrationDto
  ) {
    return this.recruitmentService.completeRegistration(
      completeRegistrationDto
    );
  }

  @ApiOperation({ summary: "Get all candidates (recruitment manager only)" })
  @ApiResponse({ status: 200, description: "List of all candidates." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiBearerAuth()
  @UseGuards(BetterAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_RECRUITMENT")
  @Get("candidates")
  async getAllCandidates(@Query() query: GetCandidatesDto) {
    return this.recruitmentService.getAllCandidates(query);
  }

  @ApiOperation({ summary: "Get candidate by ID (recruitment manager only)" })
  @ApiResponse({
    status: 200,
    description: "Candidate details retrieved successfully.",
  })
  @ApiResponse({ status: 404, description: "Candidate not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiBearerAuth()
  @ApiParam({
    name: "id",
    description: "Candidate ID",
  })
  @UseGuards(BetterAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_RECRUITMENT")
  @Get("candidates/:id")
  async getCandidateById(@Param("id") id: string) {
    return this.recruitmentService.getCandidateById(id);
  }

  @Patch("candidates/:id")
  @UseGuards(BetterAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_RECRUITMENT")
  @ApiOperation({ summary: "Update candidate information" })
  @ApiResponse({ status: 200, description: "Candidate updated successfully" })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  @ApiResponse({ status: 404, description: "Candidate not found" })
  @ApiBearerAuth()
  @ApiParam({ name: "id", description: "Candidate ID" })
  @ApiBody({ type: UpdateCandidateDto })
  async updateCandidate(
    @Param("id") id: string,
    @Body() updateCandidateDto: UpdateCandidateDto
  ) {
    return this.recruitmentService.updateCandidate(id, updateCandidateDto);
  }

  @Post("candidates/:id/convert-to-driver")
  @UseGuards(BetterAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_RECRUITMENT")
  @ApiOperation({
    summary: "Hire a candidate: create the driver record and the DRIVER login",
  })
  @ApiResponse({
    status: 201,
    description: "Candidate converted to driver successfully",
  })
  @ApiResponse({
    status: 400,
    description:
      "Candidate already hired, record incomplete, depot inactive, or email/Transporter ID already in use",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  @ApiResponse({ status: 404, description: "Candidate not found" })
  @ApiBearerAuth()
  @ApiParam({ name: "id", description: "Candidate ID" })
  @ApiBody({ type: ConvertToDriverDto })
  async convertToDriver(
    @Param("id") id: string,
    @Body() convertToDriverDto: ConvertToDriverDto
  ) {
    return this.recruitmentService.convertToDriver(id, convertToDriverDto);
  }

  @Delete("candidates/:id")
  @UseGuards(BetterAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_RECRUITMENT")
  @ApiOperation({ summary: "Delete a candidate" })
  @ApiResponse({
    status: 200,
    description: "Candidate deleted successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Candidate deleted successfully" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid candidate ID or deletion failed",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  @ApiResponse({ status: 404, description: "Candidate not found" })
  @ApiBearerAuth()
  @ApiParam({ name: "id", description: "Candidate ID" })
  async deleteCandidate(@Param("id") id: string) {
    return this.recruitmentService.deleteCandidate(id);
  }
}
