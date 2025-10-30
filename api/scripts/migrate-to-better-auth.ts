import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

interface OldUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  status: string;
  phoneNumber: string | null;
  lastLogin: Date | null;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

async function migrateUsers(organizationId: string) {
  console.log("Starting user migration...");

  // Get all users from old User table
  const oldUsers = await prisma.$queryRaw<OldUser[]>`
    SELECT * FROM "User"
  `;

  console.log(`Found ${oldUsers.length} users to migrate`);

  for (const oldUser of oldUsers) {
    try {
      // Create new user in Better Auth user table
      await prisma.$executeRaw`
        INSERT INTO "user" (
          id, email, "emailVerified", name, image, "createdAt", "updatedAt",
          role, status, "phoneNumber", "lastLogin", avatar
        ) VALUES (
          ${oldUser.id},
          ${oldUser.email},
          true,
          ${oldUser.name},
          ${oldUser.avatar},
          ${oldUser.createdAt},
          ${oldUser.updatedAt},
          ${oldUser.role}::"UserRole",
          ${oldUser.status}::"UserStatus",
          ${oldUser.phoneNumber},
          ${oldUser.lastLogin},
          ${oldUser.avatar}
        )
        ON CONFLICT (id) DO NOTHING
      `;

      // Create account entry with password
      const accountId = nanoid();
      await prisma.$executeRaw`
        INSERT INTO "account" (
          id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt"
        ) VALUES (
          ${nanoid()},
          ${oldUser.id},
          ${accountId},
          'credential',
          ${oldUser.password},
          NOW(),
          NOW()
        )
        ON CONFLICT DO NOTHING
      `;

      // Create member entry for organization
      await prisma.$executeRaw`
        INSERT INTO "member" (
          id, "organizationId", "userId", role, "createdAt", "updatedAt"
        ) VALUES (
          ${nanoid()},
          ${organizationId},
          ${oldUser.id},
          ${oldUser.role},
          NOW(),
          NOW()
        )
        ON CONFLICT DO NOTHING
      `;

      console.log(`✓ Migrated user: ${oldUser.email}`);
    } catch (error) {
      console.error(`✗ Failed to migrate user ${oldUser.email}:`, error);
    }
  }

  console.log("User migration completed!");
}

async function addOrganizationIdToTables(organizationId: string) {
  console.log("Adding organizationId to existing records...");

  const tables = [
    { name: "Driver", column: "organizationId" },
    { name: "Candidate", column: "organizationId" },
    { name: "driver_payments", column: "organizationId" },
    { name: "driver_invoices", column: "organizationId" },
    { name: "vans", column: "organizationId" },
    { name: "contracts", column: "organizationId" },
    { name: "parts", column: "organizationId" },
    { name: "maintenance_records", column: "organizationId" },
    { name: "route_prices", column: "organizationId" },
  ];

  for (const table of tables) {
    try {
      // Add column as nullable first
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "${table.name}" 
        ADD COLUMN IF NOT EXISTS "${table.column}" TEXT
      `);

      // Update all rows with default organization
      await prisma.$executeRawUnsafe(`
        UPDATE "${table.name}" 
        SET "${table.column}" = '${organizationId}'
        WHERE "${table.column}" IS NULL
      `);

      // Make column required
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "${table.name}" 
        ALTER COLUMN "${table.column}" SET NOT NULL
      `);

      // Add foreign key constraint
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "${table.name}" 
        ADD CONSTRAINT "${table.name}_organizationId_fkey" 
        FOREIGN KEY ("${table.column}") 
        REFERENCES "organization"(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
      `);

      // Add index
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "${table.name}_${table.column}_idx" 
        ON "${table.name}"("${table.column}")
      `);

      console.log(`✓ Updated table: ${table.name}`);
    } catch (error) {
      console.error(`✗ Failed to update table ${table.name}:`, error);
    }
  }

  console.log("Organization ID addition completed!");
}

async function createDefaultOrganization(): Promise<string> {
  console.log("Creating default organization...");

  const orgId = nanoid();

  await prisma.$executeRaw`
    INSERT INTO "organization" (
      id, name, slug, "createdAt", "updatedAt", "isActive"
    ) VALUES (
      ${orgId},
      'DSPHub Default',
      'default',
      NOW(),
      NOW(),
      true
    )
    ON CONFLICT (slug) DO NOTHING
  `;

  // Get the organization ID (in case it already existed)
  const org = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "organization" WHERE slug = 'default' LIMIT 1
  `;

  const organizationId = org[0]?.id || orgId;
  console.log(`✓ Default organization created with ID: ${organizationId}`);

  return organizationId;
}

async function dropOldTables() {
  console.log("Dropping old tables...");

  try {
    await prisma.$executeRaw`DROP TABLE IF EXISTS "user_sessions" CASCADE`;
    console.log("✓ Dropped user_sessions table");
  } catch (error) {
    console.error("✗ Failed to drop user_sessions:", error);
  }

  try {
    await prisma.$executeRaw`DROP TABLE IF EXISTS "revoked_tokens" CASCADE`;
    console.log("✓ Dropped revoked_tokens table");
  } catch (error) {
    console.error("✗ Failed to drop revoked_tokens:", error);
  }

  try {
    await prisma.$executeRaw`DROP TABLE IF EXISTS "User" CASCADE`;
    console.log("✓ Dropped User table");
  } catch (error) {
    console.error("✗ Failed to drop User table:", error);
  }

  console.log("Old tables dropped!");
}

async function addUniqueConstraints() {
  console.log("Adding unique constraints...");

  const constraints = [
    {
      table: "Driver",
      name: "Driver_organizationId_transporterId_key",
      columns: ["organizationId", "transporterId"],
    },
    {
      table: "contracts",
      name: "contracts_organizationId_name_key",
      columns: ["organizationId", "name"],
    },
    {
      table: "route_prices",
      name: "route_prices_organizationId_routeType_key",
      columns: ["organizationId", "routeType"],
    },
    {
      table: "vans",
      name: "vans_organizationId_vanNumber_key",
      columns: ["organizationId", "vanNumber"],
    },
    {
      table: "vans",
      name: "vans_organizationId_registration_key",
      columns: ["organizationId", "registration"],
    },
  ];

  for (const constraint of constraints) {
    try {
      const columns = constraint.columns.map((c) => `"${c}"`).join(", ");
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "${constraint.table}" 
        ADD CONSTRAINT "${constraint.name}" 
        UNIQUE (${columns})
      `);
      console.log(`✓ Added constraint: ${constraint.name}`);
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        console.log(`- Constraint already exists: ${constraint.name}`);
      } else {
        console.error(`✗ Failed to add constraint ${constraint.name}:`, error);
      }
    }
  }

  console.log("Unique constraints added!");
}

async function main() {
  console.log("=".repeat(60));
  console.log("Better Auth + Multi-Tenancy Migration");
  console.log("=".repeat(60));
  console.log("");

  try {
    // Step 1: Create default organization
    const organizationId = await createDefaultOrganization();
    console.log("");

    // Step 2: Migrate users to Better Auth tables
    await migrateUsers(organizationId);
    console.log("");

    // Step 3: Add organizationId to all tenant-scoped tables
    await addOrganizationIdToTables(organizationId);
    console.log("");

    // Step 4: Add unique constraints
    await addUniqueConstraints();
    console.log("");

    // Step 5: Drop old tables
    await dropOldTables();
    console.log("");

    console.log("=".repeat(60));
    console.log("Migration completed successfully!");
    console.log("=".repeat(60));
    console.log("");
    console.log("Next steps:");
    console.log("1. Run: npx prisma generate");
    console.log("2. Restart your application");
    console.log("3. Test authentication with existing users");
    console.log("");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
