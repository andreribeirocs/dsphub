import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}

  async findAll(where?: Prisma.DriverWhereInput) {
    return this.prisma.driver.findMany({
      where,
    });
  }

  async findOne(id: string) {
    return this.prisma.driver.findUnique({
      where: { id },
    });
  }

  async create(data: Prisma.DriverCreateInput) {
    return this.prisma.driver.create({
      data,
    });
  }

  async update(id: string, data: Prisma.DriverUpdateInput) {
    return this.prisma.driver.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.driver.delete({
      where: { id },
    });
  }

  async getStats() {
    const total = await this.prisma.driver.count();
    const active = await this.prisma.driver.count({
      where: { status: 'ACTIVE' },
    });
    const expiring = await this.prisma.driver.count({
      where: {
        OR: [
          {
            licenseExpiry: {
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          },
          {
            passportExpiry: {
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          },
          {
            rtwExpiry: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
          },
        ],
      },
    });
    const pending = await this.prisma.driver.count({
      where: { status: 'PENDING' },
    });

    return {
      total,
      active,
      expiring,
      pending,
    };
  }
}
