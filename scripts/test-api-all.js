#!/usr/bin/env node
/**
 * Run all authenticated API test suites.
 *
 * Requires:
 *   - Firebase Auth Emulator running on localhost:9099
 *   - API server running on localhost:3001
 *
 * Usage: node scripts/test-api-all.js
 *        pnpm test:api:auth
 */
const { execSync } = require("child_process");
const path = require("path");

const API_TEST_DIR = path.join("tests", "e2e", "api");

const SUITES = [
  // Public API tests (existing)
  { name: "Public API tests", file: "api.test.ts" },
  // Single-user authenticated tests
  { name: "Auth API", file: "auth.api.test.ts" },
  { name: "Wallet API", file: "wallet.api.test.ts" },
  { name: "Geo API", file: "geo.api.test.ts" },
  { name: "League API", file: "league.api.test.ts" },
  { name: "Contest API", file: "contest.api.test.ts" },
  { name: "Team API", file: "team.api.test.ts" },
  // Multi-user tests
  { name: "League Multi-User", file: "league-multi.api.test.ts" },
  { name: "Draft Multi-User", file: "draft-multi.api.test.ts" },
  { name: "Trade Multi-User", file: "trade-multi.api.test.ts" },
  { name: "Auction Multi-User", file: "auction-multi.api.test.ts" },
];

function log(msg) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${msg}`);
  console.log(`${"=".repeat(60)}\n`);
}

const results = [];
const startTime = Date.now();

for (const suite of SUITES) {
  const filePath = path.join(API_TEST_DIR, suite.file);
  log(`RUNNING: ${suite.name} (${suite.file})`);
  const stepStart = Date.now();
  try {
    execSync(`npx tsx ${filePath}`, {
      stdio: "inherit",
      timeout: 120000,
    });
    const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1);
    results.push({ name: suite.name, status: "PASS", time: `${elapsed}s` });
  } catch (err) {
    const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1);
    results.push({ name: suite.name, status: "FAIL", time: `${elapsed}s` });
  }
}

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

// Summary
log("API TEST SUMMARY");
let failed = 0;
for (const r of results) {
  const icon = r.status === "PASS" ? "+" : "X";
  console.log(`  [${icon}] ${r.name}: ${r.status} (${r.time})`);
  if (r.status === "FAIL") failed++;
}
console.log();
console.log(`  Total: ${results.length} suites, ${results.length - failed} passed, ${failed} failed`);
console.log(`  Total time: ${totalTime}s`);
console.log();

if (failed > 0) {
  console.log("API tests FAILED.\n");
  process.exit(1);
} else {
  console.log("All API tests PASSED.\n");
}
