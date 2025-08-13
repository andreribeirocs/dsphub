#!/usr/bin/env ts-node

import { EnvGenerator } from "../src/config/env-generator.util";

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "secrets":
      EnvGenerator.logNewSecrets();
      break;

    case "template":
      const environment =
        (args[1] as "development" | "production") || "development";
      console.log(EnvGenerator.generateEnvironmentTemplate(environment));
      break;

    case "validate":
      const secret = args[1];
      if (!secret) {
        console.error("❌ Please provide a secret to validate");
        console.log('Usage: npm run generate-env validate "your-secret-here"');
        process.exit(1);
      }

      const validation = EnvGenerator.validateSecretStrength(secret);
      console.log(`🔍 Secret Validation Results:`);
      console.log(`   Strength Score: ${validation.score}/10`);
      console.log(`   Valid: ${validation.isValid ? "✅" : "❌"}`);
      console.log(`   Feedback:`);
      validation.feedback.forEach((feedback) => {
        console.log(`   - ${feedback}`);
      });
      break;

    default:
      console.log("🔐 Environment Variable Generator");
      console.log("");
      console.log("Available commands:");
      console.log("  secrets     - Generate JWT and session secrets");
      console.log("  template    - Generate complete .env template");
      console.log(
        "              Usage: npm run generate-env template [development|production]"
      );
      console.log("  validate    - Validate secret strength");
      console.log(
        '              Usage: npm run generate-env validate "your-secret"'
      );
      console.log("");
      console.log("Examples:");
      console.log("  npm run generate-env secrets");
      console.log("  npm run generate-env template production");
      console.log('  npm run generate-env validate "mySecret123"');
  }
}

if (require.main === module) {
  main();
}
