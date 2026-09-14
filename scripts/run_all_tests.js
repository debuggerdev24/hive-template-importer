const { execSync } = require("child_process");
const path = require("path");

console.log("================================================================");
console.log("   HIVE INSPECT TEMPLATE IMPORTER — MASTER TEST SUITE");
console.log("================================================================\n");

const tests = [
  { name: "1. Deterministic Spectora Importer & Reader", script: "scripts/test_importer.js" },
  { name: "2. Ground-Truth Source Preservation Verifier", script: "scripts/test_preservation.js" },
  { name: "3. Independent Template Duplication & Deep Copy", script: "scripts/test_duplication.js" },
  { name: "4. Template Editing & Refresh Persistence", script: "scripts/test_editing.js" },
  { name: "5. Import Preservation & Confidence Report", script: "scripts/test_confidence.js" },
  { name: "6. Robust Failure Handling (8 Scenarios)", script: "scripts/test_failures.js" },
];

let totalPassed = 0;
let totalFailed = 0;

tests.forEach(({ name, script }) => {
  console.log(`\n▶ RUNNING: ${name}`);
  console.log(`  File: ${script}`);
  try {
    const output = execSync(`node "${path.resolve(__dirname, "..", script)}"`, {
      encoding: "utf8",
      stdio: "pipe",
    });
    console.log(output);
    totalPassed++;
  } catch (err) {
    console.error(`❌ FAILED: ${name}`);
    if (err.stdout) console.log(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    totalFailed++;
  }
});

console.log("================================================================");
console.log(`MASTER TEST RESULTS: ${totalPassed} SUITES PASSED, ${totalFailed} FAILED`);
console.log("================================================================");

if (totalFailed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL TEST SUITES PASSED SUCCESSFULLY!\n");
}
