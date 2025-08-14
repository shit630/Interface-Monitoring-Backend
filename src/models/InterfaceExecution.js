const mongoose = require("mongoose");

const InterfaceExecutionSchema = new mongoose.Schema({
  interfaceName: { type: String, index: true, required: true },
  integrationKey: { type: String, index: true, required: true },
  status: {
    type: String,
    enum: ["SUCCESS", "FAILED", "WARNING", "PENDING"],
    index: true,
  },
  startTime: { type: Date, index: true },
  endTime: { type: Date },
  duration: { type: Number, index: true },
  message: { type: String, text: true },
  errorDetails: { type: mongoose.Schema.Types.Mixed },
  severity: {
    type: String,
    enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    default: "LOW",
    index: true,
  },
  tags: [String],
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

InterfaceExecutionSchema.index({ startTime: -1, status: 1 });
InterfaceExecutionSchema.index({ interfaceName: 1, startTime: -1 });

module.exports = mongoose.model("InterfaceExecution", InterfaceExecutionSchema);
