const express = require("express");
const router = express.Router();
const controller = require("../controllers/executionsController");

// list (cursor pagination)
router.get("/", controller.listExecutions);

// summary for dashboard
router.get("/summary", controller.getSummary);

// chart data
router.get("/chart-data", controller.getChartData);

// dev: generate test data (POST)
router.post("/generate-test-data", controller.generateTestData);

module.exports = router;
