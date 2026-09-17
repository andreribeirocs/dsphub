/**
 * Pure functions that rewrite Prisma query arguments so they can only touch
 * rows of one organization. Used by the Prisma tenant extension.
 *
 * Adding a new model that holds DSP data? Register it below. Unlisted models
 * are NOT scoped (tenant-scope.spec.ts fails if a model with organizationId is
 * missing from the list).
 *
 * Known limits (enforced by code review, not by this layer):
 * - A created child (DriverSchedule, InvoiceItem, PaymentHistory) must point to
 *   a parent that is already committed (checked outside the transaction).
 * - Raw SQL ($queryRaw/$executeRaw) is not scoped: always filter by
 *   organizationId explicitly.
 * - Nested writes through a NON-tenant model (e.g. user.create with a nested
 *   driverProfile) must set organizationId from TenantContext explicitly.
 */

/** Models with their own `organizationId` column */
export const DIRECT_TENANT_MODELS: ReadonlySet<string> = new Set([
  "Candidate",
  "Contract",
  "Driver",
  "DriverInvoice",
  "Depot",
  "DriverPayment",
  "Invitation",
  "MaintenanceRecord",
  "Member",
  "Part",
  "RoutePrice",
  "Van",
]);

/**
 * Models without `organizationId` that belong to a tenant through a required
 * parent relation: model -> { relation field, foreign key, parent model }
 */
export const RELATION_TENANT_MODELS: Readonly<
  Record<string, { relation: string; foreignKey: string; parent: string }>
> = {
  DriverSchedule: {
    relation: "driver",
    foreignKey: "driverId",
    parent: "Driver",
  },
  InvoiceItem: {
    relation: "invoice",
    foreignKey: "invoiceId",
    parent: "DriverInvoice",
  },
  PaymentHistory: {
    relation: "routePrice",
    foreignKey: "routePriceId",
    parent: "RoutePrice",
  },
  MemberDepot: {
    relation: "depot",
    foreignKey: "depotId",
    parent: "Depot",
  },
};

/**
 * Second level of scoping inside an organization: managers limited to some
 * depots. Returns the extra where filter for a model, or null when the model
 * is not depot-bound.
 */
export function depotFilter(model: string, depotIds: string[]): Obj | null {
  const inDepots = { in: depotIds };
  switch (model) {
    case "Depot":
      return { id: inDepots };
    case "Driver":
      return { homeDepotId: inDepots };
    case "Van":
      return { depotId: inDepots };
    case "DriverPayment":
      return { OR: [{ depotId: inDepots }, { driver: { homeDepotId: inDepots } }] };
    case "DriverSchedule":
    case "DriverInvoice":
      return { driver: { homeDepotId: inDepots } };
    case "MemberDepot":
      return { depotId: inDepots };
    default:
      return null;
  }
}

/** Field that places a new row of a depot-bound model in a depot */
const DEPOT_CREATE_FIELD: Readonly<Record<string, { fk: string; relation: string }>> = {
  Driver: { fk: "homeDepotId", relation: "homeDepot" },
  Van: { fk: "depotId", relation: "depotRef" },
  DriverPayment: { fk: "depotId", relation: "depotRef" },
};

export function isTenantModel(model: string | undefined): boolean {
  return (
    !!model &&
    (DIRECT_TENANT_MODELS.has(model) || model in RELATION_TENANT_MODELS)
  );
}

export class TenantScopeViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantScopeViolationError";
  }
}

/** Parent rows that must be verified to belong to the organization */
export interface ParentCheck {
  parent: string;
  ids: string[];
}

export interface ScopedQuery {
  args: Record<string, unknown>;
  parentChecks: ParentCheck[];
}

const WHERE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

const CREATE_OPERATIONS = new Set(["create", "createMany", "createManyAndReturn"]);

type Obj = Record<string, unknown>;

const isObj = (value: unknown): value is Obj =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function tenantFilter(model: string, organizationId: string): Obj {
  if (DIRECT_TENANT_MODELS.has(model)) {
    return { organizationId };
  }
  const rel = RELATION_TENANT_MODELS[model];
  return { [rel.relation]: { organizationId } };
}

/** AND the tenant filter into an existing where (valid for unique wheres too) */
function scopeWhere(where: unknown, filter: Obj): Obj {
  const base: Obj = isObj(where) ? { ...where } : {};
  const existingAnd = base.AND;
  const andList = Array.isArray(existingAnd)
    ? existingAnd
    : existingAnd !== undefined
      ? [existingAnd]
      : [];
  base.AND = [...andList, filter];
  return base;
}

const RELATION_WRITE_KEYS = [
  "connect",
  "create",
  "connectOrCreate",
  "createMany",
  "set",
  "disconnect",
  "delete",
  "update",
  "upsert",
  "updateMany",
  "deleteMany",
];

/** True when the data object uses relation objects (Prisma "checked" input) */
function usesRelationObjects(data: Obj): boolean {
  return Object.values(data).some(
    (value) =>
      isObj(value) && RELATION_WRITE_KEYS.some((key) => key in value)
  );
}

function assertNoForeignOrganization(
  model: string,
  data: Obj,
  organizationId: string
): void {
  if ("organizationId" in data && data.organizationId !== organizationId) {
    throw new TenantScopeViolationError(
      `${model}: organizationId does not match the current organization`
    );
  }
  const org = data.organization;
  if (isObj(org)) {
    const connect = org.connect;
    if (!isObj(connect) || connect.id !== organizationId || Object.keys(org).length > 1) {
      throw new TenantScopeViolationError(
        `${model}: organization relation must connect to the current organization`
      );
    }
  }
}

function injectOrganization(model: string, data: unknown, organizationId: string): Obj {
  if (!isObj(data)) {
    throw new TenantScopeViolationError(`${model}: create data must be an object`);
  }
  assertNoForeignOrganization(model, data, organizationId);
  if ("organizationId" in data || "organization" in data) {
    return { ...data };
  }
  return usesRelationObjects(data)
    ? { ...data, organization: { connect: { id: organizationId } } }
    : { ...data, organizationId };
}

function collectParentId(model: string, data: unknown): string {
  const rel = RELATION_TENANT_MODELS[model];
  if (!isObj(data)) {
    throw new TenantScopeViolationError(`${model}: create data must be an object`);
  }
  const fk = data[rel.foreignKey];
  if (typeof fk === "string") {
    return fk;
  }
  const relation = data[rel.relation];
  if (isObj(relation) && isObj(relation.connect) && typeof relation.connect.id === "string") {
    return relation.connect.id;
  }
  throw new TenantScopeViolationError(
    `${model}: create must reference an existing ${rel.parent} by id`
  );
}

function assertUpdateDataAllowed(model: string, data: unknown, organizationId: string): void {
  if (!isObj(data)) return;
  if (DIRECT_TENANT_MODELS.has(model)) {
    assertNoForeignOrganization(model, data, organizationId);
    return;
  }
  // Moving a child row to another parent is not allowed through this layer
  const rel = RELATION_TENANT_MODELS[model];
  if (rel.foreignKey in data || rel.relation in data) {
    throw new TenantScopeViolationError(
      `${model}: changing ${rel.relation} is not allowed`
    );
  }
}

function depotIdOf(model: string, data: unknown): string | undefined {
  const field = DEPOT_CREATE_FIELD[model];
  if (!field || !isObj(data)) return undefined;
  const fk = data[field.fk];
  if (typeof fk === "string") return fk;
  const rel = data[field.relation];
  if (isObj(rel) && isObj(rel.connect) && typeof rel.connect.id === "string") {
    return rel.connect.id;
  }
  return undefined;
}

function assertCreateInDepots(model: string, items: unknown[], depotIds: string[]): void {
  if (model === "Depot" || model === "MemberDepot") {
    throw new TenantScopeViolationError(
      `${model}: only users with access to every depot can manage depots`
    );
  }
  if (!DEPOT_CREATE_FIELD[model]) return;
  for (const item of items) {
    const depotId = depotIdOf(model, item);
    if (!depotId || !depotIds.includes(depotId)) {
      throw new TenantScopeViolationError(
        `${model}: the depot must be one of the depots you manage`
      );
    }
  }
}

function assertMoveInDepots(model: string, data: unknown, depotIds: string[]): void {
  if (!DEPOT_CREATE_FIELD[model] || !isObj(data)) return;
  const field = DEPOT_CREATE_FIELD[model];
  if (!(field.fk in data) && !(field.relation in data)) return;
  const depotId = depotIdOf(model, data);
  if (!depotId || !depotIds.includes(depotId)) {
    throw new TenantScopeViolationError(
      `${model}: the depot must be one of the depots you manage`
    );
  }
}

/**
 * Rewrite args of a Prisma operation on a tenant model.
 * @throws TenantScopeViolationError when the query tries to cross organizations
 */
export function scopeQueryArgs(
  model: string,
  operation: string,
  rawArgs: unknown,
  organizationId: string,
  depotIds: string[] | null = null
): ScopedQuery {
  if (!isTenantModel(model)) {
    return { args: isObj(rawArgs) ? rawArgs : {}, parentChecks: [] };
  }

  const args: Obj = isObj(rawArgs) ? { ...rawArgs } : {};
  const orgFilter = tenantFilter(model, organizationId);
  const depotScope = depotIds ? depotFilter(model, depotIds) : null;
  const filter: Obj = depotScope ? { AND: [orgFilter, depotScope] } : orgFilter;
  const parentChecks: ParentCheck[] = [];
  const isRelationModel = model in RELATION_TENANT_MODELS;

  if (WHERE_OPERATIONS.has(operation)) {
    args.where = scopeWhere(args.where, filter);

    if (operation.startsWith("update")) {
      assertUpdateDataAllowed(model, args.data, organizationId);
    }

    if (depotIds && operation.startsWith("update")) {
      assertMoveInDepots(model, args.data, depotIds);
    }

    if (operation === "upsert") {
      assertUpdateDataAllowed(model, args.update, organizationId);
      if (depotIds) {
        assertCreateInDepots(model, [args.create], depotIds);
        assertMoveInDepots(model, args.update, depotIds);
      }
      if (isRelationModel) {
        parentChecks.push({
          parent: RELATION_TENANT_MODELS[model].parent,
          ids: [collectParentId(model, args.create)],
        });
      } else {
        args.create = injectOrganization(model, args.create, organizationId);
      }
    }

    return { args, parentChecks };
  }

  if (CREATE_OPERATIONS.has(operation)) {
    const items = Array.isArray(args.data) ? args.data : [args.data];

    if (depotIds) {
      assertCreateInDepots(model, items, depotIds);
    }

    if (isRelationModel) {
      parentChecks.push({
        parent: RELATION_TENANT_MODELS[model].parent,
        ids: items.map((item) => collectParentId(model, item)),
      });
    } else {
      const scoped = items.map((item) => injectOrganization(model, item, organizationId));
      args.data = Array.isArray(args.data) ? scoped : scoped[0];
    }

    return { args, parentChecks };
  }

  throw new TenantScopeViolationError(
    `${model}.${operation} is not supported on tenant data`
  );
}
