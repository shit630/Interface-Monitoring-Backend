const rateLimit = require("express-rate-limit");
const DOT = process.env.RATE_LIMIT_WINDOW_MS || 60000;
const MAX = process.env.RATE_LIMIT_MAX || 120;

const limiter = rateLimit({
  windowMs: Number(DOT),
  max: Number(MAX),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});

module.exports = limiter;
