import { PrismaClient, UserRole } from "@prisma/client";
import { auth } from "../src/auth/better-auth.config";

const prisma = new PrismaClient();

const depots = ["London", "Manchester", "Birmingham", "Liverpool", "Glasgow"];
const statuses = ["ACTIVE", "PENDING", "INACTIVE", "SUSPENDED"];
const contractTypes = ["FULL_TIME", "PART_TIME", "CONTRACTOR"];
const citizenship = ["UK", "EU", "Non-EU"];

function getRandomDate(start: Date, end: Date) {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

function generateTransporterId(): string {
  // Generate a unique transporter ID like A12UAMGEOZD80X
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 14; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateRandomName() {
  const firstNames = [
    "John",
    "Jane",
    "Michael",
    "Sarah",
    "David",
    "Emma",
    "James",
    "Lisa",
    "Robert",
    "Maria",
  ];
  const lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
  ];
  return `${getRandomElement(firstNames)} ${getRandomElement(lastNames)}`;
}

function generateRandomEmail(name: string, index: number) {
  const domains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"];
  const sanitizedName = name.toLowerCase().replace(" ", ".");
  return `${sanitizedName}${index}@${getRandomElement(domains)}`;
}

function generateRandomPhone() {
  return `07${Math.floor(Math.random() * 1000000000)
    .toString()
    .padStart(9, "0")}`;
}

// Generate document status based on expiry date
function generateDocumentStatus(expiryDate: Date): string {
  const now = new Date();
  const diffInDays = Math.ceil(
    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffInDays < 0) {
    return "EXPIRED";
  } else if (diffInDays <= 30) {
    return "EXPIRING";
  } else if (Math.random() < 0.1) {
    return "PENDING"; // 10% chance of pending
  } else {
    return "VERIFIED";
  }
}

// Helper function to create user with Better Auth
async function createUserWithBetterAuth(
  email: string,
  password: string,
  name: string,
  role: UserRole = UserRole.DRIVER
) {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return existingUser;
  }

  // Use Better Auth's internal API to create user
  const result = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name,
    },
  });

  if (!result) {
    throw new Error(`Failed to create user: ${email}`);
  }

  // Update user role and status
  const user = await prisma.user.update({
    where: { email },
    data: {
      role,
      status: "ACTIVE",
    },
  });

  return user;
}

async function main() {
  try {
    // Create DSPHub - Trial organization
    let organization = await prisma.organization.findUnique({
      where: { slug: "dsphub-trial" },
    });

    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name: "DSPHub - Trial",
          slug: "dsphub-trial",
          isActive: true,
        },
      });
      console.log("✅ Created organization: DSPHub - Trial");
    }

    const organizationId = organization.id;

    // Create admin users with Better Auth
    const adminUser = await createUserWithBetterAuth(
      "admin@dsphub.com",
      "admin123456",
      "Admin User",
      UserRole.DIRECTOR
    );
    console.log("✅ Created admin user: admin@dsphub.com / admin123456");

    // Create Triun admin user
    const triunUser = await createUserWithBetterAuth(
      "admin@triun.com",
      "admin123456",
      "Triun Admin",
      UserRole.DIRECTOR
    );
    console.log("✅ Created Triun admin: admin@triun.com / admin123456");

    // Create specific drivers first
    const specificDrivers = [
      {
        name: "Mario Candido",
        phone: "+5562992317121",
        email: "mario.candido@example.com",
      },
      {
        name: "Andre Ribeiro",
        phone: "+447403162161",
        email: "andre.ribeiro@example.com",
      },
    ];

    console.log("Creating specific drivers...");
    for (let i = 0; i < specificDrivers.length; i++) {
      const driverData = specificDrivers[i];
      const status = getRandomElement(statuses);
      const depot = getRandomElement(depots);
      const contractType = getRandomElement(contractTypes);
      const citizenshipType = getRandomElement(citizenship);

      // Generate random dates
      const now = new Date();
      const joinDate = getRandomDate(new Date(2020, 0, 1), now);

      // Generate expiry dates with some variety (some past, some near future, some far future)
      const passportExpiry = getRandomDate(
        new Date(2023, 0, 1),
        new Date(2026, 11, 31)
      );
      const licenseExpiry = getRandomDate(
        new Date(2023, 6, 1),
        new Date(2026, 5, 31)
      );
      const rtwExpiry = getRandomDate(
        new Date(2023, 0, 1),
        new Date(2025, 11, 31)
      );
      const medicalExpiry = getRandomDate(
        new Date(2023, 0, 1),
        new Date(2025, 11, 31)
      );
      const dbsExpiry = getRandomDate(
        new Date(2023, 0, 1),
        new Date(2026, 11, 31)
      );

      const lastCheck = getRandomDate(new Date(2023, 0, 1), now);
      const nextCheck = getRandomDate(now, new Date(2024, 11, 31));

      // Generate document statuses based on expiry dates
      const passportStatus = generateDocumentStatus(passportExpiry);
      const licenseStatus = generateDocumentStatus(licenseExpiry);
      const rtwStatus = generateDocumentStatus(rtwExpiry);
      const medicalStatus = generateDocumentStatus(medicalExpiry);
      const dbsStatus = generateDocumentStatus(dbsExpiry);

      // Create user for driver with Better Auth
      const user = await createUserWithBetterAuth(
        driverData.email,
        "driver123456",
        driverData.name,
        UserRole.DRIVER
      );

      // Create driver
      await prisma.driver.create({
        data: {
          organizationId,
          transporterId: generateTransporterId(),
          name: driverData.name,
          email: driverData.email,
          phone: driverData.phone,
          status,
          depot,
          address: `${Math.floor(Math.random() * 100)} ${getRandomElement(["High Street", "Main Road", "Church Lane", "Park Avenue"])}`,
          citizenship: citizenshipType,
          contractType,
          passportExpiry,
          licenseExpiry,
          rtwExpiry,
          points: Math.floor(Math.random() * 12),
          lastCheck,
          nextCheck,
          age: Math.floor(Math.random() * 30) + 20, // Age between 20-50
          hasEndorsements: Math.random() > 0.5,
          joinDate,
          completionRate: Math.floor(Math.random() * 100),
          rating: Math.floor(Math.random() * 5) + 1,
          totalTrips: Math.floor(Math.random() * 1000),
          documents: {
            passport: { status: passportStatus, expiry: passportExpiry },
            license: { status: licenseStatus, expiry: licenseExpiry },
            rtw: { status: rtwStatus, expiry: rtwExpiry },
            medical: { status: medicalStatus, expiry: medicalExpiry },
            dbs: { status: dbsStatus, expiry: dbsExpiry },
          },
          passportStatus,
          licenseStatus,
          rtwStatus,
          medicalStatus,
          dbsStatus,
          onboardingComplete: Math.random() > 0.2,
          classroomComplete: Math.random() > 0.2,
          userId: user.id,
        },
      });

      console.log(
        `Created specific driver ${i + 1}/${specificDrivers.length}: ${driverData.name} (${driverData.phone}) - Documents: P:${passportStatus}, L:${licenseStatus}, R:${rtwStatus}, M:${medicalStatus}, D:${dbsStatus}`
      );
    }

    // Create remaining random drivers (48 more to make 50 total)
    const remainingDrivers = 50 - specificDrivers.length;
    console.log(`Creating ${remainingDrivers} random drivers...`);

    for (let i = 0; i < remainingDrivers; i++) {
      const name = generateRandomName();
      const email = generateRandomEmail(name, i + specificDrivers.length);
      const phone = generateRandomPhone();
      const status = getRandomElement(statuses);
      const depot = getRandomElement(depots);
      const contractType = getRandomElement(contractTypes);
      const citizenshipType = getRandomElement(citizenship);

      // Generate random dates
      const now = new Date();
      const joinDate = getRandomDate(new Date(2020, 0, 1), now);

      // Generate expiry dates with some variety (some past, some near future, some far future)
      const passportExpiry = getRandomDate(
        new Date(2023, 0, 1),
        new Date(2026, 11, 31)
      );
      const licenseExpiry = getRandomDate(
        new Date(2023, 6, 1),
        new Date(2026, 5, 31)
      );
      const rtwExpiry = getRandomDate(
        new Date(2023, 0, 1),
        new Date(2025, 11, 31)
      );
      const medicalExpiry = getRandomDate(
        new Date(2023, 0, 1),
        new Date(2025, 11, 31)
      );
      const dbsExpiry = getRandomDate(
        new Date(2023, 0, 1),
        new Date(2026, 11, 31)
      );

      const lastCheck = getRandomDate(new Date(2023, 0, 1), now);
      const nextCheck = getRandomDate(now, new Date(2024, 11, 31));

      // Generate document statuses based on expiry dates
      const passportStatus = generateDocumentStatus(passportExpiry);
      const licenseStatus = generateDocumentStatus(licenseExpiry);
      const rtwStatus = generateDocumentStatus(rtwExpiry);
      const medicalStatus = generateDocumentStatus(medicalExpiry);
      const dbsStatus = generateDocumentStatus(dbsExpiry);

      // Create user for driver with Better Auth
      const user = await createUserWithBetterAuth(
        email,
        "driver123456",
        name,
        UserRole.DRIVER
      );

      // Create driver
      await prisma.driver.create({
        data: {
          organizationId,
          transporterId: generateTransporterId(),
          name,
          email,
          phone,
          status,
          depot,
          address: `${Math.floor(Math.random() * 100)} ${getRandomElement(["High Street", "Main Road", "Church Lane", "Park Avenue"])}`,
          citizenship: citizenshipType,
          contractType,
          passportExpiry,
          licenseExpiry,
          rtwExpiry,
          points: Math.floor(Math.random() * 12),
          lastCheck,
          nextCheck,
          age: Math.floor(Math.random() * 30) + 20, // Age between 20-50
          hasEndorsements: Math.random() > 0.5,
          joinDate,
          completionRate: Math.floor(Math.random() * 100),
          rating: Math.floor(Math.random() * 5) + 1,
          totalTrips: Math.floor(Math.random() * 1000),
          documents: {
            passport: { status: passportStatus, expiry: passportExpiry },
            license: { status: licenseStatus, expiry: licenseExpiry },
            rtw: { status: rtwStatus, expiry: rtwExpiry },
            medical: { status: medicalStatus, expiry: medicalExpiry },
            dbs: { status: dbsStatus, expiry: dbsExpiry },
          },
          passportStatus,
          licenseStatus,
          rtwStatus,
          medicalStatus,
          dbsStatus,
          onboardingComplete: Math.random() > 0.2,
          classroomComplete: Math.random() > 0.2,
          userId: user.id,
        },
      });

      console.log(
        `Created random driver ${i + 1}/${remainingDrivers}: ${name} - Documents: P:${passportStatus}, L:${licenseStatus}, R:${rtwStatus}, M:${medicalStatus}, D:${dbsStatus}`
      );
    }

    console.log("Seed completed successfully");
  } catch (error) {
    console.error("Error during seeding:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
