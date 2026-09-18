/**
 * Populates a whole believable world so the system can be exercised end to end.
 *
 * Runs on its own and is idempotent:
 *   npx ts-node prisma/seed-simulation.ts
 *
 * The drivers here are named after the delivery associates in the sample
 * Amazon Service Details Report on purpose. That makes the whole chain line up
 * instead of each piece being demonstrable only in isolation:
 *
 *   - import the sample report and the names match real driver records
 *   - Salvyn Kisitu is a sweeper, so his three-routes-one-shift day is real
 *   - Kieran helping Farayi on CA_A177 becomes a payment transfer between two
 *     drivers who both exist
 *   - Kieran and Zavon are OFFBOARDED carrying the National Insurance numbers
 *     of two candidates in seed-recruitment.ts, so the returning-driver
 *     cross-reference has something true to find
 *   - Abdul, Beatriz and Nathan sit in the classroom on 2025-02-26, the date
 *     the report pays exactly ONE Training Day - a real shortfall of two
 *
 * Run `seed-recruitment.ts` as well to get the candidate side of that.
 */

import {
  PrismaClient,
  UserRole,
  UserStatus,
  DriverExitReason,
  DriverDocumentType,
  ScheduleStatus,
} from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "driver123456";
const DEPOT_NAME = "Portsmouth (DPO1)";

type Shape =
  /** Working now, one uninterrupted engagement */
  | "active"
  /** Working now, but this is their SECOND time here */
  | "returning"
  /** Gone. Their record and history stay. */
  | "offboarded"
  /** Hired out of recruitment, still in onboarding: no transporter ID yet */
  | "onboarding";

interface Person {
  name: string;
  shape: Shape;
  /** Amazon's transporter ID for the CURRENT engagement; none while onboarding */
  transporterId?: string;
  nin: string;
  age: number;
  citizenship: string;
  /** Months ago the first engagement started */
  startedMonthsAgo: number;
  /** Only for offboarded / returning */
  leftMonthsAgo?: number;
  exitReason?: DriverExitReason;
  exitNotes?: string;
  /** Second engagement start, for returning people */
  returnedMonthsAgo?: number;
  returnTransporterId?: string;
  note?: string;
}

const PEOPLE: Person[] = [
  // --- Straightforward actives, named after the report --------------------
  { name: "Farayi Muchemenyi", shape: "active", transporterId: "A1FRY001", nin: "SC742318A", age: 34, citizenship: "Zimbabwean", startedMonthsAgo: 26 },
  { name: "Salvyn Kisitu", shape: "active", transporterId: "A1SLV002", nin: "SC742319B", age: 29, citizenship: "Ugandan", startedMonthsAgo: 14, note: "Works as a sweeper: covers other people's routes rather than holding one" },
  { name: "Daniel Stapley", shape: "active", transporterId: "A1DAN003", nin: "SC742320C", age: 41, citizenship: "British", startedMonthsAgo: 31 },
  { name: "Matthew Cottrell", shape: "active", transporterId: "A1MAT004", nin: "SC742321D", age: 37, citizenship: "British", startedMonthsAgo: 19 },
  { name: "Joshua Scott", shape: "active", transporterId: "A1JOS005", nin: "SC742322A", age: 25, citizenship: "British", startedMonthsAgo: 8 },
  { name: "Luke Davis", shape: "active", transporterId: "A1LUK006", nin: "SC742323B", age: 28, citizenship: "British", startedMonthsAgo: 11 },
  { name: "Matthew Scattergood", shape: "active", transporterId: "A1MSC007", nin: "SC742324C", age: 44, citizenship: "British", startedMonthsAgo: 22 },
  { name: "Sebin Thindiyathil Pothen", shape: "active", transporterId: "A1SEB008", nin: "SC742325D", age: 30, citizenship: "Indian", startedMonthsAgo: 16 },

  // --- Someone on their SECOND engagement ---------------------------------
  // Two stints, two transporter IDs, two logins, one person. This is the case
  // the whole DriverStint design exists for.
  {
    name: "Oscar Hill Perales",
    shape: "returning",
    nin: "SC742326A",
    age: 33,
    citizenship: "Spanish",
    startedMonthsAgo: 40,
    leftMonthsAgo: 20,
    exitReason: DriverExitReason.PERSONAL,
    exitNotes: "Went back to Spain for a year. Left on good terms.",
    returnedMonthsAgo: 7,
    transporterId: "A1OSC009B", // current, second engagement
    returnTransporterId: "A1OSC009B",
    note: "Second engagement. First one ran under transporter ID A1OSC009A.",
  },

  // --- Gone, and matching the returning candidates -------------------------
  // Their NINs are the ones seed-recruitment.ts puts on two new candidates,
  // so the cross-reference fires on a real pair.
  {
    name: "Kieran moonan",
    shape: "offboarded",
    transporterId: "A1KIE010",
    nin: "QQ523456A",
    age: 37,
    citizenship: "Irish",
    startedMonthsAgo: 29,
    leftMonthsAgo: 6,
    exitReason: DriverExitReason.PERSONAL,
    exitNotes: "Family reasons. Said he would come back when settled.",
    note: "Has applied again - see the candidate with the same NI number",
  },
  {
    name: "Zavon Blackman",
    shape: "offboarded",
    transporterId: "A1ZAV011",
    nin: "QQ523457B",
    age: 32,
    citizenship: "British",
    startedMonthsAgo: 24,
    leftMonthsAgo: 9,
    exitReason: DriverExitReason.RESIGNED,
    exitNotes: "Took a job closer to home.",
    note: "Has applied again - see the candidate with the same NI number",
  },
  {
    name: "Lampros Georgopoulos",
    shape: "offboarded",
    transporterId: "A1LAM012",
    nin: "SC742327B",
    age: 46,
    citizenship: "Greek",
    startedMonthsAgo: 33,
    leftMonthsAgo: 3,
    exitReason: DriverExitReason.ABSENTEEISM,
    exitNotes: "Repeated no-shows over six weeks despite two conversations.",
    note: "Exit reason is a record for whoever reads it later, not a block",
  },

  // --- Still in onboarding: no transporter ID yet -------------------------
  // The case that forced transporterId to become nullable. This person shows
  // in Driver Availability but cannot be booked on a route.
  {
    name: "Leanne Whitaker",
    shape: "onboarding",
    nin: "SC742328C",
    age: 24,
    citizenship: "British",
    startedMonthsAgo: 0,
    note: "Hired out of recruitment; ride along done, awaiting activation",
  },
];

const monthsAgo = (n: number): Date => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
};

const slug = (name: string) =>
  name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, ".");

async function makeUser(
  email: string,
  name: string,
  organizationId: string,
  active: boolean
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  const user = await prisma.user.create({
    data: {
      email,
      name,
      emailVerified: true,
      role: UserRole.DRIVER,
      // A person who left keeps their record but loses the ability to log in
      status: active ? UserStatus.ACTIVE : UserStatus.INACTIVE,
    },
  });
  await prisma.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: await hashPassword(DEFAULT_PASSWORD),
    },
  });
  await prisma.member.create({
    data: { userId: user.id, organizationId, role: "member" },
  });
  return user;
}

/** Documents for one engagement. A returning person re-submits everything. */
async function makeDocuments(
  organizationId: string,
  driverId: string,
  stintId: string,
  collectedAt: Date,
  superseded: boolean
) {
  const plus = (days: number) =>
    new Date(collectedAt.getTime() + days * 24 * 60 * 60 * 1000);

  const docs: {
    type: DriverDocumentType;
    number: string;
    expires: Date | null;
  }[] = [
    { type: DriverDocumentType.PASSPORT, number: `P${driverId.slice(0, 6).toUpperCase()}`, expires: plus(1800) },
    { type: DriverDocumentType.DRIVING_LICENCE, number: `DL${driverId.slice(0, 6).toUpperCase()}`, expires: plus(1200) },
    { type: DriverDocumentType.RIGHT_TO_WORK, number: `RTW${driverId.slice(0, 5).toUpperCase()}`, expires: plus(900) },
    { type: DriverDocumentType.DBS, number: `DBS${driverId.slice(0, 5).toUpperCase()}`, expires: plus(1095) },
  ];

  for (const doc of docs) {
    await prisma.driverDocument.create({
      data: {
        organizationId,
        driverId,
        stintId,
        type: doc.type,
        number: doc.number,
        expiresAt: doc.expires,
        status: "VERIFIED",
        collectedAt,
        // The old engagement's copies are kept, marked as replaced. An audit
        // asks which document was valid on a date; a single current value
        // cannot answer that.
        supersededAt: superseded ? plus(30) : null,
      },
    });
  }
}

async function main(): Promise<void> {
  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!organization) {
    throw new Error("No organization found. Run `npx prisma db seed` first.");
  }
  const organizationId = organization.id;

  let depot = await prisma.depot.findFirst({
    where: { organizationId, name: DEPOT_NAME },
  });
  if (!depot) {
    depot = await prisma.depot.findFirst({ where: { organizationId, isActive: true } });
  }

  console.log(`Simulating a full world for "${organization.name}"`);
  if (depot) console.log(`  depot: ${depot.name}`);

  let created = 0;
  let skipped = 0;

  for (const p of PEOPLE) {
    const email = `${slug(p.name)}@dsphub-sim.com`;
    const already = await prisma.driver.findFirst({
      where: { organizationId, email },
    });
    if (already) {
      skipped++;
      continue;
    }

    const isGone = p.shape === "offboarded";
    const user = await makeUser(email, p.name, organizationId, !isGone);
    const firstStart = monthsAgo(p.startedMonthsAgo);

    const status =
      p.shape === "offboarded"
        ? "OFFBOARDED"
        : p.shape === "onboarding"
          ? "PENDING"
          : "ACTIVE";

    const driver = await prisma.driver.create({
      data: {
        organizationId,
        userId: user.id,
        name: p.name,
        email,
        phone: `+4477009${String(created).padStart(5, "0")}`,
        // Null for anyone not yet activated: Amazon only issues it on activation
        transporterId: p.shape === "onboarding" ? null : p.transporterId,
        status,
        depot: depot?.name ?? DEPOT_NAME,
        homeDepotId: depot?.id ?? null,
        address: `${10 + created} Bracknell Road`,
        age: p.age,
        citizenship: p.citizenship,
        insuranceNumber: p.nin,
        licenseNumber: `DL${p.nin.slice(2, 8)}`,
        joinDate: firstStart,
        lastCheck: monthsAgo(2),
        nextCheck: monthsAgo(-4),
        licenseExpiry: monthsAgo(-30),
        passportExpiry: monthsAgo(-48),
        rtwExpiry: monthsAgo(-24),
        onboardingComplete: p.shape !== "onboarding",
        classroomComplete: true,
        backgroundCheckDone: true,
      },
    });

    // --- Engagements -------------------------------------------------------
    if (p.shape === "returning") {
      // First engagement, closed, with its own transporter ID
      const first = await prisma.driverStint.create({
        data: {
          organizationId,
          driverId: driver.id,
          userId: user.id,
          transporterId: `${p.transporterId!.slice(0, -1)}A`,
          startDate: firstStart,
          endDate: monthsAgo(p.leftMonthsAgo!),
          exitReason: p.exitReason,
          exitNotes: p.exitNotes,
        },
      });
      await makeDocuments(organizationId, driver.id, first.id, firstStart, true);

      // Second engagement, open, new transporter ID, documents collected afresh
      const second = await prisma.driverStint.create({
        data: {
          organizationId,
          driverId: driver.id,
          userId: user.id,
          transporterId: p.returnTransporterId,
          startDate: monthsAgo(p.returnedMonthsAgo!),
        },
      });
      await makeDocuments(
        organizationId,
        driver.id,
        second.id,
        monthsAgo(p.returnedMonthsAgo!),
        false
      );
    } else {
      const stint = await prisma.driverStint.create({
        data: {
          organizationId,
          driverId: driver.id,
          userId: user.id,
          transporterId: p.shape === "onboarding" ? null : p.transporterId,
          startDate: firstStart,
          endDate: isGone ? monthsAgo(p.leftMonthsAgo!) : null,
          exitReason: isGone ? p.exitReason : null,
          exitNotes: isGone ? p.exitNotes : null,
        },
      });
      await makeDocuments(organizationId, driver.id, stint.id, firstStart, false);
    }

    // --- A fortnight of availability for whoever is working -----------------
    if (p.shape !== "offboarded") {
      const today = new Date();
      for (let offset = -7; offset <= 6; offset++) {
        const day = new Date(today);
        day.setDate(today.getDate() + offset);
        day.setHours(0, 0, 0, 0);
        const weekday = day.getDay();

        let scheduleStatus: ScheduleStatus;
        if (weekday === 0) {
          scheduleStatus = ScheduleStatus.OFF;
        } else if (p.shape === "onboarding") {
          // Somebody still in onboarding can only be booked for training and
          // the ride along - never a route.
          scheduleStatus =
            offset < -2
              ? ScheduleStatus.TRAINING_DAY
              : offset < 1
                ? ScheduleStatus.RIDE_ALONG
                : ScheduleStatus.OFF;
        } else if ((created + offset) % 9 === 0) {
          scheduleStatus = ScheduleStatus.HOLIDAY;
        } else {
          scheduleStatus = ScheduleStatus.FULL_ROUTE;
        }

        await prisma.driverSchedule.create({
          data: {
            driverId: driver.id,
            date: day,
            status: scheduleStatus,
            startTime: scheduleStatus === ScheduleStatus.FULL_ROUTE ? "11:20" : null,
            endTime: scheduleStatus === ScheduleStatus.FULL_ROUTE ? "20:30" : null,
          },
        });
      }
    }

    created++;
  }

  // --- What the world looks like now ---------------------------------------
  const [byStatus, stints, docs, schedules] = await Promise.all([
    prisma.driver.groupBy({ by: ["status"], where: { organizationId }, _count: true }),
    prisma.driverStint.count({ where: { organizationId } }),
    prisma.driverDocument.count({ where: { organizationId } }),
    prisma.driverSchedule.count({ where: { driver: { organizationId } } }),
  ]);

  console.log(`\n  drivers created: ${created}   already there: ${skipped}`);
  for (const row of byStatus.sort((a, b) => a.status.localeCompare(b.status))) {
    console.log(`    ${String(row._count).padStart(3)}  ${row.status}`);
  }
  console.log(`\n  engagements: ${stints}   documents: ${docs}   schedule days: ${schedules}`);
  console.log(`\n  worth clicking on:`);
  console.log(`    - Oscar Hill Perales: two engagements, two transporter IDs,`);
  console.log(`      old documents kept and marked as replaced`);
  console.log(`    - Leanne Whitaker: in onboarding, NO transporter ID, bookable`);
  console.log(`      only for training and the ride along`);
  console.log(`    - Kieran moonan / Zavon Blackman: gone, and their NI numbers`);
  console.log(`      match two candidates who have applied again`);
  console.log(`\n  every login is ${DEFAULT_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
