const cron = require("node-cron");
const { exec } = require("child_process");
const path = require("path");

const script = path.join(__dirname, "../src/build_rules.py");

// Run every Monday at 3:00 AM
cron.schedule("0 3 * * MON", () => {
  console.log("Running weekly adblock list update…");
  exec(`py "${script}"`);
});
