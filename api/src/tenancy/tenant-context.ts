import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request tenant (DSP organization) context.
 *
 * - Set by TenantMiddleware from the domain the request arrived on.
 * - Read by the Prisma tenant extension to scope every query.
 * - `system` bypasses scoping and must only be used by trusted background
 *   jobs that iterate organizations explicitly (never from a request handler).
 */
export interface TenantStore {
  organizationId?: string;
  domain?: string;
  system?: boolean;
  /**
   * Depots the current user is limited to. undefined/null = every depot of the
   * organization (owners, directors, managers without depot assignments).
   */
  depotIds?: string[] | null;
  /** Inside PrismaService.tenantTransaction (RLS setting already applied) */
  inTransaction?: boolean;
}

const storage = new AsyncLocalStorage<TenantStore>();

export const TenantContext = {
  run<T>(store: TenantStore, fn: () => T): T {
    return storage.run(store, fn);
  },

  runForOrganization<T>(organizationId: string, fn: () => T): T {
    return storage.run({ organizationId }, fn);
  },

  runAsSystem<T>(fn: () => T): T {
    return storage.run({ system: true }, fn);
  },

  get(): TenantStore | undefined {
    return storage.getStore();
  },

  /** Limit the rest of the request to these depots (null = all depots) */
  setDepotScope(depotIds: string[] | null): void {
    const store = storage.getStore();
    if (!store || store.system) {
      throw new TenantContextMissingError("setDepotScope");
    }
    store.depotIds = depotIds;
  },

  getDepotIds(): string[] | null {
    return storage.getStore()?.depotIds ?? null;
  },

  getOrganizationId(): string | undefined {
    return storage.getStore()?.organizationId;
  },

  /** Returns the current organization id or throws (fail closed). */
  requireOrganizationId(): string {
    const organizationId = storage.getStore()?.organizationId;
    if (!organizationId) {
      throw new TenantContextMissingError();
    }
    return organizationId;
  },
};

export class TenantContextMissingError extends Error {
  constructor(detail?: string) {
    super(
      `Organization context is missing${detail ? ` (${detail})` : ""}. ` +
        "Tenant data can only be accessed inside a resolved organization."
    );
    this.name = "TenantContextMissingError";
  }
}
