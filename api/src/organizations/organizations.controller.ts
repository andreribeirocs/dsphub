import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { BetterAuthGuard } from "../auth/guards/better-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CurrentOrganization } from "../auth/decorators/current-organization.decorator";
import { BetterAuthService } from "../auth/better-auth.service";

@Controller("organizations")
@UseGuards(BetterAuthGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly betterAuthService: BetterAuthService
  ) {}

  @Post()
  async create(
    @Body() createOrganizationDto: CreateOrganizationDto,
    @CurrentUser() user: any
  ) {
    // Only SUPER_ADMIN can create organizations
    const isSuperAdmin = await this.betterAuthService.isSuperAdmin(user.id);
    if (!isSuperAdmin) {
      throw new ForbiddenException(
        "Only super administrators can create organizations"
      );
    }

    return this.organizationsService.create(createOrganizationDto, user.id);
  }

  @Get()
  async findAll(@CurrentUser() user: any) {
    // Only SUPER_ADMIN can list all organizations
    const isSuperAdmin = await this.betterAuthService.isSuperAdmin(user.id);
    if (!isSuperAdmin) {
      throw new ForbiddenException(
        "Only super administrators can list all organizations"
      );
    }

    return this.organizationsService.findAll();
  }

  /** Current organization of the domain (settings screen) */
  @Get("current")
  async findCurrent(@CurrentOrganization() organizationId: string, @CurrentUser() user: any) {
    return this.organizationsService.findOne(organizationId, user.id, false);
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @CurrentUser() user: any) {
    const isSuperAdmin = await this.betterAuthService.isSuperAdmin(user.id);
    return this.organizationsService.findOne(id, user.id, isSuperAdmin);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
    @CurrentUser() user: any
  ) {
    const isSuperAdmin = await this.betterAuthService.isSuperAdmin(user.id);
    if (!isSuperAdmin && !["OWNER", "DIRECTOR"].includes(user.role)) {
      throw new ForbiddenException(
        "Only owners and directors can change organization settings"
      );
    }
    if (!isSuperAdmin && updateOrganizationDto.isActive !== undefined) {
      throw new ForbiddenException("Only super administrators can activate or deactivate an organization");
    }
    return this.organizationsService.update(
      id,
      updateOrganizationDto,
      user.id,
      isSuperAdmin
    );
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @CurrentUser() user: any) {
    // Only SUPER_ADMIN can delete organizations
    const isSuperAdmin = await this.betterAuthService.isSuperAdmin(user.id);
    if (!isSuperAdmin) {
      throw new ForbiddenException(
        "Only super administrators can delete organizations"
      );
    }

    return this.organizationsService.remove(id);
  }

  @Get(":id/members")
  async getMembers(@Param("id") id: string, @CurrentUser() user: any) {
    const isSuperAdmin = await this.betterAuthService.isSuperAdmin(user.id);
    return this.organizationsService.getMembers(id, user.id, isSuperAdmin);
  }
}
