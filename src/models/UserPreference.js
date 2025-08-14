const mongoose = require("mongoose");

const UserPreferenceSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  timezone: { type: String, default: "UTC" },
  theme: { type: String, enum: ["dark", "light"], default: "dark" },
  accentColor: { type: String, default: "teal" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("UserPreference", UserPreferenceSchema);
