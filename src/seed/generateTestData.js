// NOTE: This script is resource-heavy. Use on dev machines and ensure Mongo can accept the write load.
const mongoose = require("mongoose");
const connectDB = require("../db");
const InterfaceExecution = require("../models/InterfaceExecution");
const { faker } = require("@faker-js/faker"); // modern faker package

async function run(n = 500000, batchSize = 1000) {
  console.log(`Connecting to DB...`);
  await connectDB();
  console.log(
    `Connected. Generating ${n} documents in batches of ${batchSize}`
  );

  const interfaces = [
    "SF_EmployeeSync_To_ECP",
    "SF_ManagerSync",
    "SF_TimeOffExport",
    "SF_PayrollExport",
    "SF_3rdParty_RMS",
    "SF_BenefitsSync",
  ];

  const statuses = ["SUCCESS", "FAILED", "WARNING", "PENDING"];
  const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

  let created = 0;

  try {
    while (created < n) {
      const batch = [];

      for (let i = 0; i < batchSize && created < n; i++, created++) {
        const iface = faker.helpers.arrayElement(interfaces);
        const status = faker.helpers.arrayElement(statuses);
        const severity =
          status === "FAILED"
            ? faker.helpers.arrayElement(severities.slice(1)) // MEDIUM, HIGH, CRITICAL
            : "LOW";

        const duration = faker.number.int({ min: 100, max: 10000 });
        const startTime = faker.date.recent({ days: 30 });

        batch.push({
          interfaceName: iface,
          integrationKey: `${iface.toLowerCase()}_${faker.number.int({
            min: 1,
            max: 2000000,
          })}`,
          status,
          startTime,
          endTime: new Date(startTime.getTime() + duration),
          duration,
          message:
            status === "FAILED"
              ? `Error code ${faker.number.int({
                  min: 1,
                  max: 999,
                })} - ${faker.hacker.phrase()}`
              : "OK",
          errorDetails:
            status === "FAILED"
              ? {
                  code: `E${faker.number.int({ min: 1, max: 999 })}`,
                  trace: faker.lorem.sentence(),
                }
              : null,
          severity,
          tags: ["generated"],
        });
      }

      try {
        await InterfaceExecution.insertMany(batch, { ordered: false });
        console.log(`Inserted: ${created}/${n}`);
      } catch (err) {
        console.error(`Batch insert error at record ${created}:`, err.message);
      }

      // Prevent hammering MongoDB
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    console.log("✅ Data generation completed.");
  } catch (err) {
    console.error("❌ Fatal error:", err);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

module.exports = { run };

// Run directly
if (require.main === module) {
  const count = Number(process.argv[2] || 10000);
  const batchSize = Number(process.argv[3] || 1000);
  run(count, batchSize);
}
