import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DriversService } from './drivers.service';
import { Driver, Prisma } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('depot') depot?: string,
    @Query('search') search?: string,
  ) {
    return this.driversService.findAll();
  }

  @Get('stats')
  async getStats() {
    return this.driversService.getStats();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.driversService.findOne(id);
  }

  @Post()
  async create(@Body() data: Prisma.DriverCreateInput) {
    return this.driversService.create(data);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() data: Prisma.DriverUpdateInput,
  ) {
    return this.driversService.update(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.driversService.delete(id);
  }
}
