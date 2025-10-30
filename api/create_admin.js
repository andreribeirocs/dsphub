const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

async function createAdmin() {
  const prisma = new PrismaClient();

  try {
    // Create a default admin user
    const hashedPassword = await bcrypt.hash("Andre123#", 10);

    const admin = await prisma.user.create({
      data: {
        email: "andre@dsphub.co.uk",
        password: hashedPassword,
        name: "Andre",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        emailVerified: true,
      },
    });

    console.log("✅ Admin user created successfully!");
    console.log("📧 Email: andre@dsphub.co.uk");
    console.log("🔑 Password: Andre123#");
    console.log("⚠️  Please change this password after logging in!");
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
