const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = require("./db");
const limiter = require("./middlewares/rateLimiter");
const errorHandler = require("./middlewares/errorHandler");
const executionsRoutes = require("./routes/executions");
const redis = require("./redisClient");

const app = express();
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.use(
  cors({
    origin: [
      "https://interface-monitoring.vercel.app/",
      "http://localhost:5173",
    ], // adjust for frontend hosts or set to true for all in dev
    credentials: true,
  })
);

app.use(limiter);

// Connect DB
connectDB().catch((err) => {
  console.error("DB connect failed:", err);
  process.exit(1);
});

// Routes
app.use("/api/v1/executions", executionsRoutes);

// Health
app.get("/health", (req, res) => res.json({ ok: true }));

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));
