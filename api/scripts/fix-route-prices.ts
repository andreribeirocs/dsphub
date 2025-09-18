import { PrismaClient, RouteType } from "@prisma/client";

const prisma = new PrismaClient();

// Define daily rates for all route types
const ROUTE_RATES: Record<RouteType, number> = {
  // Original route types (existing)
  FULL_ROUTE: 25.0,
  HIDE_ALONG: 15.0,
  TRAINING_DAY: 20.0,
  SAME_DAY: 30.0,
  NURSERY_ROUTE: 22.0,
  EXTRAS: 18.0,

  // New route types (missing rates)
  ORDT_EXTRA_LARGE_CARGO_VAN: 35.0, // Higher rate for extra large cargo
  STANDARD_PARCEL_MEDIUM_VAN: 28.0,
  NURSERY_ROUTE_LEVEL_1: 20.0,
  NURSERY_ROUTE_LEVEL_2: 22.0,
  NURSERY_ROUTE_LEVEL_3: 24.0,
  NURSERY_ROUTE_LEVEL_4: 26.0, // Higher rate for level 4
  STANDARD_PARCEL: 25.0,
  STANDARD_PARCEL_LOW_EMISSION_VEHICLE_LARGE: 32.0, // Higher rate for low emission large
  STANDARD_PARCEL_WITH_HELPER: 40.0, // Higher rate when helper is needed
  STANDARD_PARCEL_RIDE_ALONG_IRONHIDE_MEDIUM_VAN: 18.0, // Ride along (mentoring) - lower rate
  STANDARD_PARCEL_RIDE_ALONG_MENTEE_IRONHIDE_MEDIUM_VAN: 15.0, // Mentee - lowest rate
};

async function checkAndFixRoutePrices(): Promise<void> {
  try {
    console.log("🔍 Checking current route prices...");

    // Get existing route prices
    const existingPrices = await prisma.routePrice.findMany({
      orderBy: { routeType: "asc" },
    });

    console.log(`📊 Found ${existingPrices.length} existing route prices:`);
    existingPrices.forEach((price) => {
      console.log(`  - ${price.routeType}: £${price.dailyRate}`);
    });

    // Find missing route types
    const existingRouteTypes = new Set(existingPrices.map((p) => p.routeType));
    const allRouteTypes = Object.keys(ROUTE_RATES) as RouteType[];
    const missingRouteTypes = allRouteTypes.filter(
      (type) => !existingRouteTypes.has(type)
    );

    console.log(
      `\n❌ Missing ${missingRouteTypes.length} route price configurations:`
    );
    missingRouteTypes.forEach((type) => {
      console.log(`  - ${type}: should be £${ROUTE_RATES[type]}`);
    });

    if (missingRouteTypes.length === 0) {
      console.log("✅ All route prices are configured!");
      return;
    }

    // Get a user to set as the updater (prefer director, fallback to any user)
    const user =
      (await prisma.user.findFirst({
        where: {
          OR: [{ role: "DIRECTOR" }, { role: "MANAGER_FINANCIAL" }],
        },
      })) || (await prisma.user.findFirst());

    if (!user) {
      throw new Error("No user found to set as updater");
    }

    console.log(`\n👤 Using user: ${user.name} (${user.email}) as updater`);

    // Create missing route prices
    console.log(
      `\n🚀 Creating ${missingRouteTypes.length} missing route prices...`
    );

    for (const routeType of missingRouteTypes) {
      const dailyRate = ROUTE_RATES[routeType];

      await prisma.routePrice.create({
        data: {
          routeType,
          dailyRate,
          updatedBy: user.id,
        },
      });

      console.log(`  ✅ Created ${routeType}: £${dailyRate}`);
    }

    console.log("\n🎉 Route prices fix completed!");

    // Show final count
    const finalCount = await prisma.routePrice.count();
    console.log(
      `📊 Total route prices now: ${finalCount}/${allRouteTypes.length}`
    );
  } catch (error) {
    console.error("❌ Error fixing route prices:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  await checkAndFixRoutePrices();
}

if (require.main === module) {
  main().catch(console.error);
}

export { checkAndFixRoutePrices, ROUTE_RATES };


