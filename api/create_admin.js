const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function createAdmin() {
  const prisma = new PrismaClient();

  try {
    // Create a default admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const admin = await prisma.user.create({
      data: {
        email: 'admin@dsphub.co.uk',
        password: hashedPassword,
        name: 'Administrator',
        role: 'DIRECTOR',
        status: 'ACTIVE'
      }
    });

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@dsphub.co.uk');
    console.log('🔑 Password: admin123');
    console.log('⚠️  Please change this password after logging in!');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
