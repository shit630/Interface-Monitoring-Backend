const InterfaceExecution = require("../models/InterfaceExecution");
const redis = require("../redisClient");
const { Types } = require("mongoose");
const ObjectId = Types.ObjectId;

// Helper: build filters from query
function buildFilters(q) {
  const { start, end, status, interfaceName, qtext, minDuration, maxDuration } =
    q;
  const filter = {};
  if (start || end) {
    filter.startTime = {};
    if (start) filter.startTime.$gte = new Date(start);
    if (end) filter.startTime.$lte = new Date(end);
  }
  if (status)
    filter.status = { $in: Array.isArray(status) ? status : [status] };
  if (interfaceName)
    filter.interfaceName = { $regex: new RegExp(interfaceName, "i") };
  if (qtext) filter.$text = { $search: qtext };
  if (minDuration)
    filter.duration = Object.assign(filter.duration || {}, {
      $gte: Number(minDuration),
    });
  if (maxDuration)
    filter.duration = Object.assign(filter.duration || {}, {
      $lte: Number(maxDuration),
    });
  return filter;
}

// Cursor-based pagination
function decodeCursor(cursor) {
  if (!cursor) return null;
  const [ts, id] = Buffer.from(cursor, "base64").toString("utf8").split("|");
  return { ts: new Date(ts), id };
}
function encodeCursor(doc) {
  if (!doc) return null;
  const payload = `${doc.startTime.toISOString()}|${doc._id.toString()}`;
  return Buffer.from(payload).toString("base64");
}

exports.listExecutions = async (req, res, next) => {
  try {
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const cursor = decodeCursor(req.query.cursor);
    const sort = req.query.sort === "asc" ? 1 : -1;

    const filters = buildFilters(req.query);

    const query = { ...filters };
    if (cursor) {
      // descending or ascending
      if (sort === -1) {
        query.$or = [
          { startTime: { $lt: cursor.ts } },
          {
            startTime: cursor.ts,
            _id: { $lt: new ObjectId(cursor.id) },
          },
        ];
      } else {
        query.$or = [
          { startTime: { $gt: cursor.ts } },
          {
            startTime: cursor.ts,
            _id: { $gt: new ObjectId(cursor.id) },
          },
        ];
      }
    }

    const docs = await InterfaceExecution.find(query)
      .sort({ startTime: sort, _id: sort })
      .limit(limit + 1)
      .select(
        "interfaceName integrationKey status startTime duration message severity"
      )
      .lean();

    let nextCursor = null;
    if (docs.length > limit) {
      const last = docs[limit - 1];
      nextCursor = encodeCursor(last);
      docs.splice(limit);
    }
    res.json({ items: docs, nextCursor });
  } catch (err) {
    next(err);
  }
};

exports.getSummary = async (req, res, next) => {
  try {
    const { range = "24h", start, end } = req.query;
    // compute start/end
    let startDt = start ? new Date(start) : null;
    let endDt = end ? new Date(end) : new Date();
    if (!startDt) {
      if (range === "1h") startDt = new Date(Date.now() - 60 * 60 * 1000);
      else if (range === "24h")
        startDt = new Date(Date.now() - 24 * 60 * 60 * 1000);
      else if (range === "7d")
        startDt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      else if (range === "30d")
        startDt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      else startDt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    const cacheKey = `summary:${startDt.toISOString()}:${endDt.toISOString()}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Aggregation pipeline
    const pipeline = [
      { $match: { startTime: { $gte: startDt, $lte: endDt } } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          avgDuration: { $avg: "$duration" },
        },
      },
      { $sort: { count: -1 } },
    ];
    const byStatus = await InterfaceExecution.aggregate(pipeline);

    // totals
    const totalAgg = await InterfaceExecution.aggregate([
      { $match: { startTime: { $gte: startDt, $lte: endDt } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          avgDuration: { $avg: "$duration" },
        },
      },
    ]);

    // top failing interfaces
    const topFailures = await InterfaceExecution.aggregate([
      {
        $match: { startTime: { $gte: startDt, $lte: endDt }, status: "FAILED" },
      },
      { $group: { _id: "$interfaceName", failCount: { $sum: 1 } } },
      { $sort: { failCount: -1 } },
      { $limit: 10 },
    ]);

    const result = {
      range: { start: startDt.toISOString(), end: endDt.toISOString() },
      totals: totalAgg[0] || { total: 0, avgDuration: 0 },
      byStatus,
      topFailures,
    };

    await redis.set(cacheKey, JSON.stringify(result), "EX", 30); // cache 30s
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getChartData = async (req, res, next) => {
  try {
    const { start, end, bucket = "hour" } = req.query;
    const startDt = start
      ? new Date(start)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDt = end ? new Date(end) : new Date();

    // bucket options: hour, minute, day
    let dateTrunc;
    if (bucket === "minute")
      dateTrunc = {
        $dateToString: { format: "%Y-%m-%dT%H:%M", date: "$startTime" },
      };
    else if (bucket === "hour")
      dateTrunc = {
        $dateToString: { format: "%Y-%m-%dT%H:00:00Z", date: "$startTime" },
      };
    else
      dateTrunc = { $dateToString: { format: "%Y-%m-%d", date: "$startTime" } };

    const pipeline = [
      { $match: { startTime: { $gte: startDt, $lte: endDt } } },
      {
        $group: {
          _id: { time: dateTrunc, status: "$status" },
          count: { $sum: 1 },
          avgDuration: { $avg: "$duration" },
        },
      },
      {
        $group: {
          _id: "$_id.time",
          statuses: { $push: { status: "$_id.status", count: "$count" } },
          avgDuration: { $avg: "$avgDuration" },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const rows = await InterfaceExecution.aggregate(pipeline);
    res.json({ rows });
  } catch (err) {
    next(err);
  }
};

exports.generateTestData = async (req, res, next) => {
  // intentionally simple: direct call to seed script or generate small sample
  const { count = 1000 } = req.body;
  try {
    // For safety: don't allow > 2M via endpoint in production
    const n = Math.min(2000000, Number(count));
    // Call seed script function (we'll export one)
    const seed = require("../seed/generateTestData");
    await seed.run(n);
    res.json({ seeded: n });
  } catch (err) {
    next(err);
  }
};
