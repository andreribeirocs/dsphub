import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("=".repeat(60));
  console.log("Creating Better Auth Tables");
  console.log("=".repeat(60));
  console.log("");

  try {
    // Read the SQL file
    const sqlFile = path.join(__dirname, "create-better-auth-tables.sql");
    const sql = fs.readFileSync(sqlFile, "utf-8");

    // Split by semicolon and execute each statement
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    console.log(`Executing ${statements.length} SQL statements...`);
    console.log("");

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await prisma.$executeRawUnsafe(statement);
        console.log(`✓ Statement ${i + 1}/${statements.length} executed`);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (
          error.message?.includes("already exists") ||
          error.message?.includes("duplicate")
        ) {
          console.log(
            `- Statement ${i + 1}/${statements.length} skipped (already exists)`
          );
        } else {
          console.error(
            `✗ Statement ${i + 1}/${statements.length} failed:`,
            error.message
          );
        }
      }
    }

    console.log("");
    console.log("=".repeat(60));
    console.log("Better Auth tables created successfully!");
    console.log("=".repeat(60));
    console.log("");
    console.log("Next step: Run 'npm run migrate:better-auth'");
    console.log("");
  } catch (error) {
    console.error("Failed to create tables:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
