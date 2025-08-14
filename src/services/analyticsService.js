// Placeholder for advanced analytics functions such as precompute rollups,
// sliding window counters, alert evaluation, etc.
// For now, this file demonstrates a precompute aggregator pattern.

const redis = require("../redisClient");
const InterfaceExecution = require("../models/InterfaceExecution");

async function recompute24hRollup() {
  const end = new Date();
  const start = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const agg = await InterfaceExecution.aggregate([
    { $match: { startTime: { $gte: start, $lte: end } } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  await redis.set(
    `rollup:24h:${start.toISOString()}`,
    JSON.stringify(agg),
    "EX",
    60
  );
}

module.exports = { recompute24hRollup };
