import { PrismaService } from "./prisma.service";
import { TenantContextMissingError } from "../tenancy/tenant-context";

describe("PrismaService", () => {
  const service = new PrismaService();

  afterAll(async () => {
    await service.$disconnect();
  });

  it("keeps its own methods after applying the tenant extension", () => {
    expect(typeof service.onModuleInit).toBe("function");
    expect(typeof service.onModuleDestroy).toBe("function");
    expect(typeof service.getHealthInfo).toBe("function");
  });

  it("refuses tenant queries outside an organization context", async () => {
    await expect(service.driver.findMany()).rejects.toThrow(
      TenantContextMissingError
    );
  });
});
