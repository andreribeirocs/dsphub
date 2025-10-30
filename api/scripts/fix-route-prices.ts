import { PrismaClient, RouteType } from "@prisma/client";

const prisma = new PrismaClient();

// Define daily rates for all route types
const ROUTE_RATES: Record<RouteType, number> = {
  // Original route types
  FULL_ROUTE: 121.5,
  HIDE_ALONG: 121.5,
  TRAINING_DAY: 121.5,
  SAME_DAY: 121.5,
  NURSERY_ROUTE: 121.5,
  EXTRAS: 121.5,

  // Standard route types
  ORDT_EXTRA_LARGE_CARGO_VAN: 121.5,
  STANDARD_PARCEL_MEDIUM_VAN: 121.5,
  NURSERY_ROUTE_LEVEL_1: 121.5,
  NURSERY_ROUTE_LEVEL_2: 121.5,
  NURSERY_ROUTE_LEVEL_3: 121.5,
  NURSERY_ROUTE_LEVEL_4: 121.5,
  STANDARD_PARCEL: 121.5,
  STANDARD_PARCEL_LOW_EMISSION_VEHICLE_LARGE: 121.5,
  STANDARD_PARCEL_WITH_HELPER: 121.5,
  STANDARD_PARCEL_RIDE_ALONG_IRONHIDE_MEDIUM_VAN: 121.5,
  STANDARD_PARCEL_RIDE_ALONG_MENTEE_IRONHIDE_MEDIUM_VAN: 121.5,

  // New OSM and specialized route types
  OSM_RATE: 140.0,
  OSM_COVER: 130.0,
  HELPER_FLEET: 130.0,
  SWEEPER: 121.5,
  HELPER: 121.5,
  ROUTE_9H: 121.5,
  LEAD_DRIVER: 10.0,
  RESCUE_2: 39.5,
  RESCUE_6: 118.0,
};

async function checkAndFixRoutePrices(): Promise<void> {
  try {
    // Ensure default organization exists
    let organization = await prisma.organization.findUnique({
      where: { slug: "default" },
    });

    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name: "DSPHub Default",
          slug: "default",
          isActive: true,
        },
      });
    }

    const organizationId = organization.id;
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
          organizationId,
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
