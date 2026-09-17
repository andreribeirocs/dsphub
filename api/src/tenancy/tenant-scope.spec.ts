import { readFileSync } from "fs";
import { join } from "path";
import {
  DIRECT_TENANT_MODELS,
  RELATION_TENANT_MODELS,
  scopeQueryArgs,
  TenantScopeViolationError,
} from "./tenant-scope";

const ORG_A = "org-a";
const ORG_B = "org-b";

describe("scopeQueryArgs", () => {
  it("adds the organization filter to findMany without dropping the original where", () => {
    const { args } = scopeQueryArgs(
      "Driver",
      "findMany",
      { where: { status: "ACTIVE" }, orderBy: { name: "asc" } },
      ORG_A
    );
    expect(args).toEqual({
      where: { status: "ACTIVE", AND: [{ organizationId: ORG_A }] },
      orderBy: { name: "asc" },
    });
  });

  it("keeps an OR from the caller inside the tenant boundary", () => {
    const { args } = scopeQueryArgs(
      "Driver",
      "findMany",
      { where: { OR: [{ name: "x" }, { email: "y" }] } },
      ORG_A
    );
    expect(args.where).toEqual({
      OR: [{ name: "x" }, { email: "y" }],
      AND: [{ organizationId: ORG_A }],
    });
  });

  it("scopes findUnique / update / delete by id", () => {
    for (const op of ["findUnique", "findUniqueOrThrow", "update", "delete"]) {
      const { args } = scopeQueryArgs("Van", op, { where: { id: "v1" } }, ORG_A);
      expect(args.where).toEqual({ id: "v1", AND: [{ organizationId: ORG_A }] });
    }
  });

  it("scopes queries without where (count, deleteMany)", () => {
    expect(scopeQueryArgs("Candidate", "count", undefined, ORG_A).args).toEqual({
      where: { AND: [{ organizationId: ORG_A }] },
    });
    expect(scopeQueryArgs("Part", "deleteMany", {}, ORG_A).args).toEqual({
      where: { AND: [{ organizationId: ORG_A }] },
    });
  });

  it("appends to an existing AND array", () => {
    const { args } = scopeQueryArgs(
      "Driver",
      "findFirst",
      { where: { AND: [{ depot: "DXW2" }] } },
      ORG_A
    );
    expect(args.where).toEqual({
      AND: [{ depot: "DXW2" }, { organizationId: ORG_A }],
    });
  });

  it("injects organizationId on create (unchecked input)", () => {
    const { args } = scopeQueryArgs("Van", "create", { data: { vanNumber: "V1" } }, ORG_A);
    expect(args.data).toEqual({ vanNumber: "V1", organizationId: ORG_A });
  });

  it("injects organization.connect when the data uses relation objects", () => {
    const { args } = scopeQueryArgs(
      "Driver",
      "create",
      { data: { name: "A", user: { connect: { id: "u1" } } } },
      ORG_A
    );
    expect(args.data).toEqual({
      name: "A",
      user: { connect: { id: "u1" } },
      organization: { connect: { id: ORG_A } },
    });
  });

  it("injects organizationId on every createMany row", () => {
    const { args } = scopeQueryArgs(
      "Part",
      "createMany",
      { data: [{ name: "a" }, { name: "b" }], skipDuplicates: true },
      ORG_A
    );
    expect(args).toEqual({
      data: [
        { name: "a", organizationId: ORG_A },
        { name: "b", organizationId: ORG_A },
      ],
      skipDuplicates: true,
    });
  });

  it("rejects creating data for another organization", () => {
    expect(() =>
      scopeQueryArgs("Van", "create", { data: { organizationId: ORG_B } }, ORG_A)
    ).toThrow(TenantScopeViolationError);
    expect(() =>
      scopeQueryArgs(
        "Van",
        "create",
        { data: { organization: { connect: { id: ORG_B } } } },
        ORG_A
      )
    ).toThrow(TenantScopeViolationError);
  });

  it("rejects moving a row to another organization on update", () => {
    expect(() =>
      scopeQueryArgs(
        "Driver",
        "update",
        { where: { id: "d1" }, data: { organizationId: ORG_B } },
        ORG_A
      )
    ).toThrow(TenantScopeViolationError);
  });

  it("scopes upsert where and create", () => {
    const { args } = scopeQueryArgs(
      "RoutePrice",
      "upsert",
      { where: { id: "r1" }, create: { routeType: "STANDARD" }, update: { dailyRate: 1 } },
      ORG_A
    );
    expect(args).toEqual({
      where: { id: "r1", AND: [{ organizationId: ORG_A }] },
      create: { routeType: "STANDARD", organizationId: ORG_A },
      update: { dailyRate: 1 },
    });
  });

  describe("models scoped through a parent", () => {
    it("filters DriverSchedule through its driver", () => {
      const { args } = scopeQueryArgs(
        "DriverSchedule",
        "findMany",
        { where: { date: "2026-09-16" } },
        ORG_A
      );
      expect(args.where).toEqual({
        date: "2026-09-16",
        AND: [{ driver: { organizationId: ORG_A } }],
      });
    });

    it("requires a parent check when creating a child", () => {
      const byFk = scopeQueryArgs(
        "DriverSchedule",
        "create",
        { data: { driverId: "d1", date: "2026-09-16" } },
        ORG_A
      );
      expect(byFk.parentChecks).toEqual([{ parent: "Driver", ids: ["d1"] }]);

      const byConnect = scopeQueryArgs(
        "InvoiceItem",
        "createMany",
        { data: [{ invoice: { connect: { id: "i1" } } }, { invoiceId: "i2" }] },
        ORG_A
      );
      expect(byConnect.parentChecks).toEqual([
        { parent: "DriverInvoice", ids: ["i1", "i2"] },
      ]);
    });

    it("rejects a child create without a parent id", () => {
      expect(() =>
        scopeQueryArgs("PaymentHistory", "create", { data: { newRate: 1 } }, ORG_A)
      ).toThrow(TenantScopeViolationError);
    });

    it("rejects re-parenting a child on update", () => {
      expect(() =>
        scopeQueryArgs(
          "DriverSchedule",
          "update",
          { where: { id: "s1" }, data: { driverId: "other" } },
          ORG_A
        )
      ).toThrow(TenantScopeViolationError);
    });
  });

  it("leaves non-tenant models untouched", () => {
    const input = { where: { email: "a@b.com" } };
    expect(scopeQueryArgs("User", "findUnique", input, ORG_A).args).toBe(input);
  });

  it("covers every Prisma model that has an organizationId column", () => {
    const schema = readFileSync(
      join(__dirname, "..", "..", "prisma", "schema.prisma"),
      "utf8"
    );
    // OrganizationDomain: read before a tenant is known (domain -> organization lookup)
    // LoginAttempt: written during sign-in (no session yet, organization optional);
    //   AuditService and DashboardService always filter it by organizationId explicitly
    const intentionallyUnscoped = new Set(["OrganizationDomain", "LoginAttempt"]);
    const modelsWithOrg = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
      .filter(([, , body]) => /^\s+organizationId\s+String/m.test(body))
      .map(([, name]) => name)
      .filter((name) => !intentionallyUnscoped.has(name))
      .sort();

    expect(modelsWithOrg).toEqual([...DIRECT_TENANT_MODELS].sort());
  });

  describe("depot scope (managers limited to some depots)", () => {
    const DEPOTS = ["dep-1"];

    it("adds the depot filter on top of the organization filter", () => {
      const { args } = scopeQueryArgs("Driver", "findMany", {}, ORG_A, DEPOTS);
      expect(args.where).toEqual({
        AND: [{ AND: [{ organizationId: ORG_A }, { homeDepotId: { in: DEPOTS } }] }],
      });
    });

    it("lets a manager see payments of away drivers working at their depot", () => {
      const { args } = scopeQueryArgs("DriverPayment", "count", {}, ORG_A, DEPOTS);
      expect(args.where).toEqual({
        AND: [
          {
            AND: [
              { organizationId: ORG_A },
              { OR: [{ depotId: { in: DEPOTS } }, { driver: { homeDepotId: { in: DEPOTS } } }] },
            ],
          },
        ],
      });
    });

    it("does not add a depot filter for models without depot", () => {
      const { args } = scopeQueryArgs("Candidate", "findMany", {}, ORG_A, DEPOTS);
      expect(args.where).toEqual({ AND: [{ organizationId: ORG_A }] });
    });

    it("blocks creating a driver or van outside the manager's depots", () => {
      expect(() =>
        scopeQueryArgs("Driver", "create", { data: { homeDepotId: "dep-2" } }, ORG_A, DEPOTS)
      ).toThrow(TenantScopeViolationError);
      expect(() =>
        scopeQueryArgs("Van", "create", { data: { vanNumber: "V1" } }, ORG_A, DEPOTS)
      ).toThrow(TenantScopeViolationError);
      expect(
        scopeQueryArgs("Van", "create", { data: { depotId: "dep-1" } }, ORG_A, DEPOTS).args.data
      ).toEqual({ depotId: "dep-1", organizationId: ORG_A });
    });

    it("blocks moving a van to a depot the manager does not manage", () => {
      expect(() =>
        scopeQueryArgs(
          "Van",
          "update",
          { where: { id: "v1" }, data: { depotId: "dep-2" } },
          ORG_A,
          DEPOTS
        )
      ).toThrow(TenantScopeViolationError);
    });

    it("only unrestricted users can create depots", () => {
      expect(() =>
        scopeQueryArgs("Depot", "create", { data: { code: "X" } }, ORG_A, DEPOTS)
      ).toThrow(TenantScopeViolationError);
      expect(() => scopeQueryArgs("Depot", "create", { data: { code: "X" } }, ORG_A)).not.toThrow();
    });
  });

  it("only lists relation-scoped models whose parent is a direct tenant model", () => {
    for (const { parent } of Object.values(RELATION_TENANT_MODELS)) {
      expect(DIRECT_TENANT_MODELS.has(parent)).toBe(true);
    }
  });
});
