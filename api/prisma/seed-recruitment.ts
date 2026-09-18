/**
 * Seeds the recruitment pipeline with candidates spread across every stage.
 *
 * Runs on its own (`npx ts-node prisma/seed-recruitment.ts`) and does not touch
 * `seed.ts`, so it can be re-run without rebuilding drivers, vans or payments.
 *
 * Two details here are deliberate and worth keeping:
 *
 * 1. Three candidates sit in the classroom on 2025-02-26. The sample Amazon
 *    report for that day contains exactly ONE paid Training Day line, so the
 *    reconciliation has a real shortfall to find (three trained, one paid,
 *    two owed) instead of a tidy case that proves nothing.
 *
 * 2. Two candidates carry the National Insurance number of someone who already
 *    exists as a driver. That is the returning-driver case: the NIN is what
 *    recognises the same person across a new email and a new transporter ID.
 */

import { PrismaClient, CandidateStatus } from "@prisma/client";

const prisma = new PrismaClient();

/** UK National Insurance format: two letters, six digits, one of A-D */
const nin = (seed: string) => seed;

interface CandidateSeed {
  name: string;
  email: string;
  phoneNumber: string;
  status: CandidateStatus;
  insuranceNumber: string;
  driverLicense?: string;
  address?: string;
  postalCode?: string;
  citizenship?: string;
  age?: number;
  source?: string;
  notes?: string;
  formCompleted?: boolean;
  initialContactDone?: boolean;
  miniInterviewResult?: string;
  trainingTestResult?: string;
  classroomDate?: Date;
  rideAlongDate?: Date;
  /** Days to subtract from today for createdAt, so the list is not all "now" */
  ageDays: number;
}

const CANDIDATES: CandidateSeed[] = [
  // --- Stage 1: raw leads, nothing done yet -------------------------------
  {
    name: "Tobias Adeyemi",
    email: "tobias.adeyemi@example.com",
    phoneNumber: "+447700900101",
    status: CandidateStatus.LEAD,
    insuranceNumber: nin("QQ123456A"),
    source: "Indeed",
    ageDays: 2,
  },
  {
    name: "Priya Raghunathan",
    email: "priya.raghunathan@example.com",
    phoneNumber: "+447700900102",
    status: CandidateStatus.LEAD,
    insuranceNumber: nin("QQ123457B"),
    source: "Referral",
    notes: "Referred by Sajith Thazhatherimbli",
    ageDays: 3,
  },

  // --- Stage 2: registration link sent ------------------------------------
  {
    name: "Marek Kowalczyk",
    email: "marek.kowalczyk@example.com",
    phoneNumber: "+447700900103",
    status: CandidateStatus.SMS_SENT,
    insuranceNumber: nin("QQ123458C"),
    source: "Indeed",
    initialContactDone: true,
    ageDays: 5,
  },

  // --- Stage 3: candidate filled the form ---------------------------------
  {
    name: "Aisha Bello",
    email: "aisha.bello@example.com",
    phoneNumber: "+447700900104",
    status: CandidateStatus.FORM_COMPLETED,
    insuranceNumber: nin("QQ123459D"),
    driverLicense: "BELLO906234AB9CD",
    address: "14 Wokingham Road",
    postalCode: "RG12 8TY",
    citizenship: "British",
    age: 29,
    formCompleted: true,
    initialContactDone: true,
    ageDays: 8,
  },

  // --- Stage 4: documents in, awaiting review -----------------------------
  {
    name: "Ionut Preda",
    email: "ionut.preda@example.com",
    phoneNumber: "+447700900105",
    status: CandidateStatus.DOCUMENTS_UPLOADED,
    insuranceNumber: nin("QQ223456A"),
    driverLicense: "PREDA901145EF2GH",
    address: "3 Birch Hill Road",
    postalCode: "RG12 7ZA",
    citizenship: "Romanian",
    age: 34,
    formCompleted: true,
    initialContactDone: true,
    ageDays: 11,
  },

  // --- Stage 5: background check ------------------------------------------
  {
    name: "Daniel Okonkwo",
    email: "daniel.okonkwo@example.com",
    phoneNumber: "+447700900106",
    status: CandidateStatus.BACKGROUND_CHECK,
    insuranceNumber: nin("QQ223457B"),
    driverLicense: "OKONK886512IJ3KL",
    address: "22 Crowthorne Road",
    postalCode: "RG12 7BQ",
    citizenship: "British",
    age: 38,
    formCompleted: true,
    initialContactDone: true,
    miniInterviewResult: "Passed - confident, has own vehicle to get to depot",
    ageDays: 14,
  },
  {
    name: "Grace Mutolo",
    email: "grace.mutolo@example.com",
    phoneNumber: "+447700900107",
    status: CandidateStatus.BACKGROUND_CHECK,
    insuranceNumber: nin("QQ223458C"),
    driverLicense: "MUTOL925471MN4OP",
    address: "7 Bagshot Road",
    postalCode: "RG12 9SE",
    citizenship: "Zimbabwean",
    age: 31,
    formCompleted: true,
    initialContactDone: true,
    miniInterviewResult: "Passed - 3 points on licence, declared upfront",
    ageDays: 15,
  },

  // --- Stage 6: approved, waiting for a classroom slot --------------------
  {
    name: "Callum Fraser",
    email: "callum.fraser@example.com",
    phoneNumber: "+447700900108",
    status: CandidateStatus.APPROVED,
    insuranceNumber: nin("QQ223459D"),
    driverLicense: "FRASE902238QR5ST",
    address: "45 Rectory Row",
    postalCode: "RG12 7GA",
    citizenship: "British",
    age: 26,
    formCompleted: true,
    initialContactDone: true,
    miniInterviewResult: "Passed",
    ageDays: 18,
  },

  // --- Stage 7: in the classroom on 2025-02-26 ----------------------------
  // Amazon paid ONE Training Day that date. These three are the shortfall.
  {
    name: "Abdul Rahman Hakim",
    email: "abdul.hakim@example.com",
    phoneNumber: "+447700900109",
    status: CandidateStatus.CLASSROOM_SCHEDULED,
    insuranceNumber: nin("QQ323456A"),
    driverLicense: "HAKIM881193UV6WX",
    address: "9 Harmans Water Road",
    postalCode: "RG12 9PT",
    citizenship: "British",
    age: 41,
    formCompleted: true,
    initialContactDone: true,
    miniInterviewResult: "Passed",
    classroomDate: new Date("2025-02-26T09:00:00Z"),
    ageDays: 21,
  },
  {
    name: "Beatriz Salgado",
    email: "beatriz.salgado@example.com",
    phoneNumber: "+447700900110",
    status: CandidateStatus.CLASSROOM_SCHEDULED,
    insuranceNumber: nin("QQ323457B"),
    driverLicense: "SALGA934027YZ7AB",
    address: "18 Great Hollands Road",
    postalCode: "RG12 8UX",
    citizenship: "Portuguese",
    age: 27,
    formCompleted: true,
    initialContactDone: true,
    miniInterviewResult: "Passed",
    classroomDate: new Date("2025-02-26T09:00:00Z"),
    ageDays: 21,
  },
  {
    name: "Nathan Boateng",
    email: "nathan.boateng@example.com",
    phoneNumber: "+447700900111",
    status: CandidateStatus.CLASSROOM_SCHEDULED,
    insuranceNumber: nin("QQ323458C"),
    driverLicense: "BOATE897364CD8EF",
    address: "2 Opladen Way",
    postalCode: "RG12 0PE",
    citizenship: "British",
    age: 33,
    formCompleted: true,
    initialContactDone: true,
    miniInterviewResult: "Passed",
    classroomDate: new Date("2025-02-26T09:00:00Z"),
    ageDays: 22,
  },

  // --- Stage 8: classroom done, waiting for the ride along ----------------
  {
    name: "Stefan Iliescu",
    email: "stefan.iliescu@example.com",
    phoneNumber: "+447700900112",
    status: CandidateStatus.CLASSROOM_COMPLETED,
    insuranceNumber: nin("QQ323459D"),
    driverLicense: "ILIES903318GH9IJ",
    address: "31 Binfield Road",
    postalCode: "RG42 4HP",
    citizenship: "Romanian",
    age: 36,
    formCompleted: true,
    initialContactDone: true,
    miniInterviewResult: "Passed",
    trainingTestResult: "Passed - scored 92%",
    classroomDate: new Date("2025-02-19T09:00:00Z"),
    ageDays: 28,
  },

  // --- Stage 9: ride along booked -----------------------------------------
  {
    name: "Chidi Nwosu",
    email: "chidi.nwosu@example.com",
    phoneNumber: "+447700900113",
    status: CandidateStatus.RIDE_ALONG_SCHEDULED,
    insuranceNumber: nin("QQ423456A"),
    driverLicense: "NWOSU884402KL1MN",
    address: "5 Skimped Hill Lane",
    postalCode: "RG12 1LD",
    citizenship: "British",
    age: 30,
    formCompleted: true,
    initialContactDone: true,
    miniInterviewResult: "Passed",
    trainingTestResult: "Passed",
    classroomDate: new Date("2025-02-19T09:00:00Z"),
    rideAlongDate: new Date("2025-02-27T11:00:00Z"),
    ageDays: 30,
  },

  // --- Stage 10: ride along done, about to be hired -----------------------
  {
    name: "Leanne Whitaker",
    email: "leanne.whitaker@example.com",
    phoneNumber: "+447700900114",
    status: CandidateStatus.RIDE_ALONG_COMPLETED,
    insuranceNumber: nin("QQ423457B"),
    driverLicense: "WHITA915589OP2QR",
    address: "60 Bracknell Road",
    postalCode: "RG12 2AA",
    citizenship: "British",
    age: 24,
    formCompleted: true,
    initialContactDone: true,
    miniInterviewResult: "Passed",
    trainingTestResult: "Passed - strong on route discipline",
    classroomDate: new Date("2025-02-12T09:00:00Z"),
    rideAlongDate: new Date("2025-02-20T11:00:00Z"),
    ageDays: 35,
  },

  // --- Rejected -----------------------------------------------------------
  {
    name: "Ryan Hollis",
    email: "ryan.hollis@example.com",
    phoneNumber: "+447700900115",
    status: CandidateStatus.REJECTED,
    insuranceNumber: nin("QQ423458C"),
    address: "11 Wildridings Road",
    postalCode: "RG12 7RD",
    citizenship: "British",
    age: 45,
    formCompleted: true,
    initialContactDone: true,
    miniInterviewResult: "Failed - 9 points, two IN10 convictions",
    notes: "Not eligible under the insurance policy",
    ageDays: 25,
  },

  // --- Returning people: NIN matches an existing driver -------------------
  // These are the cases the NIN cross-reference has to catch. A new email and
  // (later) a new transporter ID, but the same person, with history worth
  // reading before deciding to hire again.
  {
    name: "Kieran Moonan",
    email: "kieran.moonan.2026@example.com",
    phoneNumber: "+447700900116",
    status: CandidateStatus.APPROVED,
    insuranceNumber: nin("QQ523456A"), // reused below on purpose
    driverLicense: "MOONA889901ST3UV",
    address: "88 Rectory Lane",
    postalCode: "RG12 7DP",
    citizenship: "Irish",
    age: 37,
    formCompleted: true,
    initialContactDone: true,
    miniInterviewResult: "Passed - previously with us, left 03/2025",
    notes: "RETURNING: worked here before. Check prior record before hiring.",
    ageDays: 6,
  },
  {
    name: "Zavon Blackman",
    email: "zavon.blackman.new@example.com",
    phoneNumber: "+447700900117",
    status: CandidateStatus.DOCUMENTS_UPLOADED,
    insuranceNumber: nin("QQ523457B"), // reused below on purpose
    driverLicense: "BLACK902276WX4YZ",
    address: "24 Jigs Lane",
    postalCode: "RG42 3AA",
    citizenship: "British",
    age: 32,
    formCompleted: true,
    initialContactDone: true,
    notes: "RETURNING: left for personal reasons, wants to come back.",
    ageDays: 4,
  },
];

/** The two NINs above, also written onto existing drivers so the match fires */
const RETURNING_NINS: Record<string, string> = {
  "Kieran moonan": "QQ523456A",
  "Zavon Blackman": "QQ523457B",
};

async function main(): Promise<void> {
  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!organization) {
    throw new Error(
      "No organization found. Run the main seed (`npx prisma db seed`) first."
    );
  }

  console.log(`Seeding recruitment pipeline for "${organization.name}"`);

  const now = Date.now();
  let created = 0;
  let skipped = 0;

  for (const c of CANDIDATES) {
    // Idempotent: re-running must not pile up duplicates
    const existing = await prisma.candidate.findFirst({
      where: { organizationId: organization.id, email: c.email },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const createdAt = new Date(now - c.ageDays * 24 * 60 * 60 * 1000);

    await prisma.candidate.create({
      data: {
        organizationId: organization.id,
        name: c.name,
        email: c.email,
        phoneNumber: c.phoneNumber,
        status: c.status,
        source: c.source ?? "Indeed",
        notes: c.notes,
        age: c.age,
        citizenship: c.citizenship,
        address: c.address,
        postalCode: c.postalCode,
        insuranceNumber: c.insuranceNumber,
        driverLicense: c.driverLicense,
        // Expiries spread either side of today so the document widgets have
        // something valid AND something expiring to show
        licenceExpiry: c.driverLicense
          ? new Date(now + (180 + c.ageDays * 10) * 24 * 60 * 60 * 1000)
          : null,
        passportVisaExpiry: c.driverLicense
          ? new Date(now + (400 + c.ageDays * 12) * 24 * 60 * 60 * 1000)
          : null,
        rtwExpiry: c.driverLicense
          ? new Date(now + (300 + c.ageDays * 8) * 24 * 60 * 60 * 1000)
          : null,
        points: c.status === CandidateStatus.REJECTED ? 9 : c.ageDays % 4,
        formCompleted: c.formCompleted ?? false,
        initialContactDone: c.initialContactDone ?? false,
        miniInterviewResult: c.miniInterviewResult,
        trainingTestResult: c.trainingTestResult,
        classroomDate: c.classroomDate,
        rideAlongDate: c.rideAlongDate,
        createdAt,
      },
    });
    created++;
  }

  // Put the matching NINs on the existing drivers, so the returning candidates
  // above actually collide with somebody and the cross-reference has something
  // to find.
  let linked = 0;
  for (const [driverName, ni] of Object.entries(RETURNING_NINS)) {
    const driver = await prisma.driver.findFirst({
      where: { organizationId: organization.id, name: driverName },
    });
    if (driver) {
      await prisma.driver.update({
        where: { id: driver.id },
        data: { insuranceNumber: ni },
      });
      linked++;
    }
  }

  const byStatus = await prisma.candidate.groupBy({
    by: ["status"],
    where: { organizationId: organization.id },
    _count: true,
  });

  console.log(`\n  created: ${created}   already there: ${skipped}`);
  console.log(`  drivers given a matching NIN: ${linked}`);
  console.log("\n  pipeline now holds:");
  for (const row of byStatus.sort((a, b) => a.status.localeCompare(b.status))) {
    console.log(`    ${String(row._count).padStart(3)}  ${row.status}`);
  }
  console.log(
    "\n  3 candidates sit in the classroom on 2025-02-26; the sample Amazon\n" +
      "  report pays 1 Training Day that day, so 2 are owed."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
