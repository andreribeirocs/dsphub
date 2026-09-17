/**
 * Local development only: prepares two DSPs so data isolation can be tested
 * in the browser.
 *
 *   DSP A  "DSPHub - Trial"  → http://localhost:4200   (existing seed data)
 *   DSP B  "DSP Teste B"     → http://127.0.0.1:4200   (small separate dataset)
 *
 * Also links every existing user to the DSP they belong to (the original seed
 * created users without membership, which the API now requires).
 *
 * Run:  npx ts-node scripts/dev-setup-tenants.ts
 * Safe to run more than once.
 */
import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

const DSP_A = { slug: "dsphub-trial", name: "DSPHub - Trial", domain: "localhost" };
const DSP_B = { slug: "dsp-teste-b", name: "DSP Teste B", domain: "127.0.0.1" };
const DSP_B_ADMIN = { email: "admin@dsp-b.test", password: "admin123456", name: "Admin DSP B" };

async function upsertDomain(organizationId: string, domain: string) {
  await prisma.organizationDomain.upsert({
    where: { domain },
    update: { organizationId, isPrimary: true },
    create: { organizationId, domain, isPrimary: true },
  });
}

async function ensureMember(organizationId: string, userId: string, role: string) {
  await prisma.member.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    update: {},
    create: { organizationId, userId, role },
  });
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("dev-setup-tenants must never run in production");
  }

  const orgA = await prisma.organization.findUnique({ where: { slug: DSP_A.slug } });
  if (!orgA) {
    throw new Error(`Organization "${DSP_A.slug}" not found. Run the seed first (npx prisma db seed).`);
  }
  await upsertDomain(orgA.id, DSP_A.domain);

  const orgB = await prisma.organization.upsert({
    where: { slug: DSP_B.slug },
    update: {},
    create: { slug: DSP_B.slug, name: DSP_B.name, isActive: true, operatingModel: "DSP_2_0" },
  });
  await upsertDomain(orgB.id, DSP_B.domain);

  // Leaders of DSP A: every non-driver user created by the seed
  const leaders = await prisma.user.findMany({
    where: { role: { not: UserRole.DRIVER }, email: { not: DSP_B_ADMIN.email } },
    select: { id: true, role: true },
  });
  for (const user of leaders) {
    await ensureMember(orgA.id, user.id, user.role === UserRole.OWNER ? "owner" : "admin");
  }

  // Drivers become members of the DSP that owns their driver profile
  const drivers = await prisma.driver.findMany({ select: { userId: true, organizationId: true } });
  for (const driver of drivers) {
    await ensureMember(driver.organizationId, driver.userId, "member");
  }

  // DSP B: one admin, one depot, two drivers and one van
  const passwordHash = await hashPassword(DSP_B_ADMIN.password);
  const adminB = await prisma.user.upsert({
    where: { email: DSP_B_ADMIN.email },
    update: {},
    create: {
      email: DSP_B_ADMIN.email,
      name: DSP_B_ADMIN.name,
      role: UserRole.DIRECTOR,
      status: "ACTIVE",
      emailVerified: true,
    },
  });
  const credential = await prisma.account.findFirst({
    where: { userId: adminB.id, providerId: "credential" },
  });
  if (!credential) {
    await prisma.account.create({
      data: {
        userId: adminB.id,
        accountId: adminB.id,
        providerId: "credential",
        password: passwordHash,
      },
    });
  }
  await ensureMember(orgB.id, adminB.id, "admin");

  const depotB = await prisma.depot.upsert({
    where: { organizationId_code: { organizationId: orgB.id, code: "TESTB1" } },
    update: {},
    create: { organizationId: orgB.id, code: "TESTB1", name: "Depot Teste B" },
  });

  const now = new Date();
  const inOneYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  for (const n of [1, 2]) {
    const email = `driver${n}@dsp-b.test`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: `Motorista B${n}`, role: UserRole.DRIVER, status: "ACTIVE" },
    });
    await ensureMember(orgB.id, user.id, "member");
    const existing = await prisma.driver.findUnique({ where: { userId: user.id } });
    if (!existing) {
      await prisma.driver.create({
        data: {
          organizationId: orgB.id,
          userId: user.id,
          name: `Motorista B${n}`,
          email,
          phone: `+4477000000${n}0`,
          address: "Somewhere, UK",
          age: 30,
          citizenship: "UK",
          depot: depotB.name,
          homeDepotId: depotB.id,
          transporterId: `TESTB${n}`,
          status: "ACTIVE",
          joinDate: now,
          lastCheck: now,
          nextCheck: inOneYear,
          licenseExpiry: inOneYear,
          passportExpiry: inOneYear,
          rtwExpiry: inOneYear,
        },
      });
    }
  }

  await prisma.van.upsert({
    where: { organizationId_vanNumber: { organizationId: orgB.id, vanNumber: "B01" } },
    update: {},
    create: {
      organizationId: orgB.id,
      vanNumber: "B01",
      registration: "TEST B01",
      make: "Ford",
      model: "Transit",
      depot: depotB.name,
      depotId: depotB.id,
    },
  });

  console.log("✅ DSPs ready for local testing:");
  console.log(`   DSP A (${DSP_A.name}) → http://localhost:4200  login: admin@dsphub.com / admin123456`);
  console.log(`   DSP B (${DSP_B.name}) → http://127.0.0.1:4200  login: ${DSP_B_ADMIN.email} / ${DSP_B_ADMIN.password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
