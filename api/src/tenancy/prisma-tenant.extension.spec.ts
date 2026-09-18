import { Prisma, PrismaClient } from "@prisma/client";
import { prismaTenantExtension } from "./prisma-tenant.extension";
import { TenantContext, TenantContextMissingError } from "./tenant-context";
import { TenantScopeViolationError } from "./tenant-scope";

/**
 * Runs the real extension on a real PrismaClient without a database: an inner
 * extension records the final query arguments and returns fake results instead
 * of calling the engine.
 */
describe("prismaTenantExtension", () => {
  const calls: Array<{ model?: string; operation: string; args: unknown }> = [];
  let parentCount = 1;

  // Query extensions run in the order they are added: the first one added
  // sees the call first. Chain: parentCountStub -> tenant -> recorder.
  const recorder = Prisma.defineExtension((client) =>
    client.$extends({
      query: {
        $allModels: {
          $allOperations({ model, operation, args }) {
            calls.push({ model, operation, args });
            return Promise.resolve(operation === "count" ? 0 : []);
          },
        },
      },
    })
  );

  // Answers the extension's own parent-ownership lookups (count by id list)
  const parentCountStub = Prisma.defineExtension((client) =>
    client.$extends({
      query: {
        $allModels: {
          $allOperations({ operation, args, query }) {
            const where = (args as { where?: { id?: { in?: unknown } } }).where;
            if (operation === "count" && Array.isArray(where?.id?.in)) {
              return Promise.resolve(parentCount);
            }
            return query(args);
          },
        },
      },
    })
  );

  const base = new PrismaClient({
    datasources: { db: { url: "postgresql://user:pass@localhost:5432/none" } },
  });
  const db = base
    .$extends(parentCountStub)
    .$extends(prismaTenantExtension)
    .$extends(recorder);

  beforeEach(() => {
    calls.length = 0;
    parentCount = 1;
  });

  afterAll(async () => {
    await base.$disconnect();
  });

  it("fails closed when there is no organization context", async () => {
    await expect(db.driver.findMany()).rejects.toThrow(TenantContextMissingError);
    expect(calls).toHaveLength(0);
  });

  it("scopes queries to the organization in context", async () => {
    await TenantContext.runForOrganization("org-a", async () =>
      await db.driver.findMany({ where: { status: "ACTIVE" } })
    );
    expect(calls).toEqual([
      {
        model: "Driver",
        operation: "findMany",
        args: { where: { status: "ACTIVE", AND: [{ organizationId: "org-a" }] } },
      },
    ]);
  });

  it("keeps the context across awaits", async () => {
    await TenantContext.runForOrganization("org-b", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await db.van.count();
    });
    expect(calls[0].args).toEqual({ where: { AND: [{ organizationId: "org-b" }] } });
  });

  it("documents that Prisma queries are lazy: they must be awaited inside the context", async () => {
    // Returning the PrismaPromise un-awaited runs the query after the context
    // callback has returned, so it fails closed instead of leaking data.
    const lazy = TenantContext.runForOrganization("org-a", () => db.driver.findMany());
    await expect(lazy).rejects.toThrow(TenantContextMissingError);
  });

  it("does not scope non-tenant models", async () => {
    await db.user.findMany({ where: { email: "a@b.com" } });
    expect(calls[0].args).toEqual({ where: { email: "a@b.com" } });
  });

  // Every tenant table has to be listed in DIRECT_TENANT_MODELS by hand.
  // A new table that nobody adds there is readable across DSPs, and local
  // development runs as a superuser, where RLS does not catch the mistake.
  it("scopes ServiceType, the table added for per-DSP service types", async () => {
    await TenantContext.runForOrganization("org-a", async () => {
      await db.serviceType.findMany({ where: { isActive: true } });
    });
    expect(calls[0].args).toEqual({
      where: { isActive: true, AND: [{ organizationId: "org-a" }] },
    });
  });

  it("fails closed on ServiceType with no organization context", async () => {
    await expect(db.serviceType.findMany()).rejects.toThrow(
      TenantContextMissingError
    );
    expect(calls).toHaveLength(0);
  });

  it("bypasses scoping only inside runAsSystem", async () => {
    await TenantContext.runAsSystem(async () => await db.driver.findMany());
    expect(calls[0].args).toEqual({});
  });

  it("blocks creating a child whose parent is in another organization", async () => {
    parentCount = 0;
    await expect(
      TenantContext.runForOrganization("org-a", async () =>
        await db.driverSchedule.create({
          data: { driverId: "driver-from-org-b", date: new Date(), status: "AVAILABLE" },
        } as never)
      )
    ).rejects.toThrow(TenantScopeViolationError);
    expect(calls).toHaveLength(0);
  });

  it("allows creating a child whose parent is in the same organization", async () => {
    parentCount = 1;
    await TenantContext.runForOrganization("org-a", async () =>
      await db.driverSchedule.create({
        data: { driverId: "driver-from-org-a", date: new Date(), status: "AVAILABLE" },
      } as never)
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].operation).toBe("create");
  });
});
