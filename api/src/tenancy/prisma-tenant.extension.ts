import { Prisma } from "@prisma/client";
import { TenantContext, TenantContextMissingError } from "./tenant-context";
import {
  isTenantModel,
  scopeQueryArgs,
  TenantScopeViolationError,
} from "./tenant-scope";

type CountDelegate = {
  count(args: { where: Record<string, unknown> }): Prisma.PrismaPromise<number>;
};

type BatchClient = {
  $transaction(promises: Prisma.PrismaPromise<unknown>[]): Promise<unknown[]>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Prisma.PrismaPromise<number>;
};

const delegateName = (model: string) =>
  model.charAt(0).toLowerCase() + model.slice(1);

/**
 * Row-Level Security (second lock, inside PostgreSQL).
 * `active` is switched on at startup when the database role is subject to RLS
 * (not a superuser and without BYPASSRLS). While active, every query runs in a
 * transaction that first sets `app.current_organization_id`, which the
 * policies created by the migrations check.
 */
export const rlsState = { active: false };

export const RLS_SETTING = "app.current_organization_id";

/** Run one Prisma operation with the organization set for RLS policies */
function withOrganizationSetting<T>(
  client: BatchClient,
  organizationId: string,
  operation: Prisma.PrismaPromise<T>
): Promise<T> {
  return client
    .$transaction([
      client.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, TRUE)`,
      operation,
    ])
    .then((results) => results[1] as T);
}

/**
 * Prisma client extension that scopes every query on DSP data to the
 * organization in TenantContext. Fails closed: without an organization (and
 * outside TenantContext.runAsSystem) tenant models cannot be queried at all.
 */
export const prismaTenantExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: "tenant-scope",
    query: {
      async $allOperations({ model, operation, args, query }) {
        const store = TenantContext.get();
        const batchClient = client as unknown as BatchClient;
        const wrapForRls =
          rlsState.active && !!store?.organizationId && !store.system && !store.inTransaction;

        // Raw SQL and non-tenant models: no argument rewriting
        if (!model || !isTenantModel(model)) {
          return wrapForRls
            ? withOrganizationSetting(
                batchClient,
                store!.organizationId!,
                query(args) as Prisma.PrismaPromise<unknown>
              )
            : query(args);
        }

        if (store?.system) {
          return query(args);
        }

        const organizationId = store?.organizationId;
        if (!organizationId) {
          throw new TenantContextMissingError(`${model}.${operation}`);
        }

        const scoped = scopeQueryArgs(
          model,
          operation,
          args,
          organizationId,
          store?.depotIds ?? null
        );

        for (const check of scoped.parentChecks) {
          const uniqueIds = [...new Set(check.ids)];
          const delegate = (client as unknown as Record<string, CountDelegate>)[
            delegateName(check.parent)
          ];
          const countQuery = delegate.count({
            where: { id: { in: uniqueIds }, organizationId },
          });
          const found = rlsState.active
            ? await withOrganizationSetting(batchClient, organizationId, countQuery)
            : await countQuery;
          if (found !== uniqueIds.length) {
            throw new TenantScopeViolationError(
              `${model}.${operation}: referenced ${check.parent} does not belong to the current organization`
            );
          }
        }

        const operationPromise = query(scoped.args as typeof args);
        return wrapForRls
          ? withOrganizationSetting(
              batchClient,
              organizationId,
              operationPromise as Prisma.PrismaPromise<unknown>
            )
          : operationPromise;
      },
    },
  })
);
