const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedRoutePrices() {
  try {
    console.log('Starting route prices seeding...');
    
    // Get a user to set as the updater
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('No users found. Need a user to create route prices.');
      return;
    }

    console.log(`Found user: ${user.name} (${user.email})`);

    const routePrices = [
      { routeType: 'FULL_ROUTE', dailyRate: 25.00 },
      { routeType: 'HIDE_ALONG', dailyRate: 15.00 },
      { routeType: 'TRAINING_DAY', dailyRate: 20.00 },
      { routeType: 'SAME_DAY', dailyRate: 30.00 },
      { routeType: 'NURSERY_ROUTE', dailyRate: 22.00 },
      { routeType: 'EXTRAS', dailyRate: 18.00 }
    ];

    for (const price of routePrices) {
      const result = await prisma.routePrice.upsert({
        where: { routeType: price.routeType },
        update: {},
        create: {
          routeType: price.routeType,
          dailyRate: price.dailyRate,
          updatedBy: user.id
        }
      });
      console.log(`Created/updated ${price.routeType}: £${price.dailyRate}`);
    }

    console.log('Route prices seeded successfully');
    const count = await prisma.routePrice.count();
    console.log(`Total route prices: ${count}`);
  } catch (error) {
    console.error('Error seeding route prices:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedRoutePrices(); 