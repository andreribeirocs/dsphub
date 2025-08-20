const { PrismaClient } = require('@prisma/client');

async function checkUsers() {
  const prisma = new PrismaClient();

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true
      }
    });

    console.log(`Found ${users.length} users in database:`);
    users.forEach(user => {
      console.log(`- ${user.email} (${user.name}) - Role: ${user.role}, Status: ${user.status}`);
    });

  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
