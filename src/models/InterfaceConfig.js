const mongoose = require("mongoose");

const InterfaceConfigSchema = new mongoose.Schema({
  integrationKey: { type: String, unique: true, required: true },
  interfaceName: { type: String, required: true },
  description: String,
  owner: String,
  enabled: { type: Boolean, default: true },
  meta: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("InterfaceConfig", InterfaceConfigSchema);
