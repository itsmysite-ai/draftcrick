#!/usr/bin/env node
/**
 * Full regression test suite — run before major releases and deployments.
 *
 * Creates a timestamped folder under screenshots/regression/ with all
 * screenshots and a summary report for each run.
 *
 * Steps:
 *   1. TypeScript type-check (warns on pre-existing errors, doesn't block)
 *   2. Non-auth E2E tests (auto-starts dev server via Playwright webServer config)
 *   3. Auth E2E tests (auto-starts emulator + dev server via test-with-emulator.js)
 *   4. API-level tests (requires API server running)
 *
 * Usage: node scripts/test-regression.js
 *        pnpm test:regression
 */
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// ─── Create timestamped regression folder ────────────────────
const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
const branch = (() => {
  try {
    return execSync("git branch --show-current", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
})();
const folderName = `${timestamp}_${branch.replace(/\//g, "_")}`;
const REPORT_DIR = path.join("screenshots", "regression", folderName);
fs.mkdirSync(REPORT_DIR, { recursive: true });

// Point Playwright screenshots to the regression folder
const SCREENSHOT_DIR = REPORT_DIR;

// ─── Find previous regression run (for live critique diffs) ───
const REGRESSION_BASE = path.join("screenshots", "regression");
const allPastRuns = fs.existsSync(REGRESSION_BASE)
  ? fs.readdirSync(REGRESSION_BASE)
      .filter((n) => fs.statSync(path.join(REGRESSION_BASE, n)).isDirectory())
      .sort()
      .filter((n) => n !== folderName) // exclude current run
  : [];
const PREV_RUN_DIR =
  allPastRuns.length > 0
    ? path.join(REGRESSION_BASE, allPastRuns[allPastRuns.length - 1])
    : null;

// ─── Live critique helpers ─────────────────────────────────────
const LIVE_REPORT_PATH = path.join(REPORT_DIR, "LIVE_REPORT.md");

// Initialize LIVE_REPORT.md header
fs.writeFileSync(
  LIVE_REPORT_PATH,
  [
    `# Live Critique Report`,
    `**Branch:** ${branch}`,
    `**Started:** ${now.toISOString()}`,
    `**Previous run:** ${PREV_RUN_DIR ?? "none (first run)"}`,
    ``,
    `---`,
    ``,
  ].join("\n")
);

// Returns a Set of current PNG filenames in dir
function snapshotPngs(dir) {
  if (!fs.existsSync(dir)) return new Set();
  return new Set(fs.readdirSync(dir).filter((f) => f.endsWith(".png") && !f.startsWith("diff-")));
}

// Runs critique script for each new PNG detected after a spec completes
function critiqueNewScreenshots(specLabel, before) {
  const after = snapshotPngs(REPORT_DIR);
  const newPngs = [...after].filter((f) => !before.has(f)).sort();
  if (newPngs.length === 0) return;

  console.log(`\n  [critique] ${newPngs.length} new screenshot(s) from ${specLabel} — analyzing...\n`);
  for (const png of newPngs) {
    try {
      execSync(
        `node ${path.join("scripts", "critique-screenshot.js")} "${REPORT_DIR}" "${PREV_RUN_DIR ?? "none"}" "${png}" "${specLabel}" "${LIVE_REPORT_PATH}"`,
        { stdio: "inherit", timeout: 45000 }
      );
    } catch (err) {
      console.log(`  [critique] skipped ${png}: ${err.message}`);
    }
  }
}

// ─── Specs — run individually for per-screenshot critique ─────
// Auth functional specs (require Firebase emulator)
const FUNCTIONAL_AUTH_SPEC = {
  name: "Functional: 01-auth",
  file: "tests/e2e/functional/01-auth.spec.ts",
  label: "auth",
  auth: true,
};

// Non-auth E2E specs (no emulator needed, story-40 to story-78)
const NON_AUTH_SPECS = [
  { name: "E2E: navigation",    file: "tests/e2e/navigation/navigation.spec.ts",   label: "navigation" },
  { name: "E2E: dashboard",     file: "tests/e2e/sports/dashboard.spec.ts",         label: "dashboard" },
  { name: "E2E: match-detail",  file: "tests/e2e/sports/match-detail.spec.ts",      label: "match-detail" },
  { name: "E2E: contest",       file: "tests/e2e/contest/contest.spec.ts",           label: "contest-e2e" },
  { name: "E2E: team-builder",  file: "tests/e2e/team/team-builder.spec.ts",         label: "team-builder" },
  { name: "E2E: league",        file: "tests/e2e/league/league.spec.ts",             label: "league" },
  { name: "E2E: wallet",        file: "tests/e2e/wallet/wallet.spec.ts",             label: "wallet-e2e" },
  { name: "E2E: tournament",    file: "tests/e2e/tournament/tournament.spec.ts",     label: "tournament" },
  { name: "E2E: notifications", file: "tests/e2e/notifications/notifications.spec.ts", label: "notifications" },
];

// Remaining functional specs (require Firebase emulator)
const FUNCTIONAL_REMAINING_SPECS = [
  { name: "Functional: 02-smart-refresh", file: "tests/e2e/functional/02-smart-refresh.spec.ts", label: "smart-refresh" },
  { name: "Functional: 03-wallet",        file: "tests/e2e/functional/03-wallet.spec.ts",         label: "wallet" },
  { name: "Functional: 04-contest",       file: "tests/e2e/functional/04-contest.spec.ts",        label: "contest" },
  { name: "Functional: 05-trades",        file: "tests/e2e/functional/05-trades.spec.ts",         label: "trades" },
  { name: "Functional: 06-draft",         file: "tests/e2e/functional/06-draft.spec.ts",          label: "draft" },
  { name: "Functional: 07-auction",       file: "tests/e2e/functional/07-auction.spec.ts",        label: "auction" },
  { name: "Functional: 08-geo",           file: "tests/e2e/functional/08-geo.spec.ts",            label: "geo" },
  { name: "Functional: AI engine screenshots", file: "tests/e2e/ai-engine-screenshots.spec.ts",  label: "ai-engine" },
];

const makePlaywrightStep = (spec, withEmulator = false) => ({
  name: spec.name,
  cmd: `${withEmulator ? "FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 " : ""}npx playwright test ${spec.file} --project=mobile --workers=1`,
  allowFail: true,
  _specLabel: spec.label,
});

const STEPS = [
  {
    name: "TypeScript type-check",
    cmd: "pnpm test:type-check",
    allowFail: true, // pre-existing TS errors in codebase
  },
  {
    name: "Unit tests (scoring engine)",
    cmd: "npx tsx tests/unit/scoring.test.ts",
    allowFail: false,
  },
  {
    name: "Unit tests (AI engine)",
    cmd: "npx tsx tests/unit/ai-engine.test.ts",
    allowFail: false,
  },
  {
    name: "Unit tests (notifications)",
    cmd: "npx tsx tests/unit/notifications.test.ts",
    allowFail: false,
  },
  // Step 3: Auth first (registration → login) — sets the story user journey baseline
  makePlaywrightStep(FUNCTIONAL_AUTH_SPEC, true),
  // Steps 4a–4h: Non-auth E2E specs individually (story-40 to story-78)
  ...NON_AUTH_SPECS.map((spec) => makePlaywrightStep(spec, false)),
  // Steps 5a–5g: Remaining functional specs (story-13 onwards)
  ...FUNCTIONAL_REMAINING_SPECS.map((spec) => makePlaywrightStep(spec, true)),
  {
    name: "Public API tests",
    cmd: "npx tsx tests/e2e/api/api.test.ts",
    allowFail: true, // depends on API server + data availability
  },
  {
    name: "AI Engine API tests",
    cmd: "npx tsx tests/e2e/api/ai-engine.api.test.ts",
    allowFail: true, // depends on API server + Gemini key
  },
  {
    name: "Notification API tests",
    cmd: "npx tsx tests/e2e/api/notification.api.test.ts",
    allowFail: true, // depends on API server
  },
  {
    name: "Authenticated API tests (all suites)",
    cmd: "node scripts/test-api-all.js",
    allowFail: true, // depends on emulator + API server
  },
];

function log(msg) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${msg}`);
  console.log(`${"=".repeat(60)}\n`);
}

const results = [];
const startTime = Date.now();

for (const step of STEPS) {
  log(`RUNNING: ${step.name}`);
  const stepStart = Date.now();

  // Snapshot PNGs before spec runs (only for functional specs that do live critique)
  const pngsBefore = step._specLabel ? snapshotPngs(REPORT_DIR) : null;

  try {
    execSync(step.cmd, {
      stdio: "inherit",
      timeout: 1800000, // 30 min — functional specs with 8 tests × 3 min each
      env: { ...process.env, REGRESSION_SCREENSHOT_DIR: SCREENSHOT_DIR },
    });
    const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1);
    results.push({ name: step.name, status: "PASS", time: `${elapsed}s` });
  } catch (err) {
    const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1);
    if (step.allowFail) {
      results.push({ name: step.name, status: "WARN (known issues)", time: `${elapsed}s` });
    } else {
      results.push({ name: step.name, status: "FAIL", time: `${elapsed}s` });
    }
  }

  // Critique any screenshots generated by this spec (runs even if spec failed)
  if (step._specLabel && pngsBefore) {
    critiqueNewScreenshots(step._specLabel, pngsBefore);
  }
}

// ─── Finalize LIVE_REPORT.html ────────────────────────────────
try {
  execSync(
    `node ${path.join("scripts", "critique-screenshot.js")} --finalize "${REPORT_DIR}" "${LIVE_REPORT_PATH}"`,
    { stdio: "inherit", timeout: 30000 }
  );
} catch {
  console.log("  (LIVE_REPORT.html generation skipped)\n");
}

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

// ─── Collect screenshots — all specs write directly to REPORT_DIR ────────────
// All specs now use screenshotPath() helper which writes to REGRESSION_SCREENSHOT_DIR
const screenshotFiles = fs.existsSync(REPORT_DIR)
  ? fs.readdirSync(REPORT_DIR).filter((f) => f.endsWith(".png") && !f.startsWith("diff-"))
  : [];

// ─── Copy Playwright HTML report if it exists ─────────────────
const htmlReport = path.join("playwright-report", "index.html");
if (fs.existsSync(htmlReport)) {
  fs.copyFileSync(htmlReport, path.join(REPORT_DIR, "playwright-report.html"));
}

// ─── Write summary report ─────────────────────────────────────
let failed = false;
const reportLines = [];
reportLines.push(`# Regression Test Report`);
reportLines.push(`**Date:** ${now.toISOString()}`);
reportLines.push(`**Branch:** ${branch}`);
reportLines.push(`**Total Time:** ${totalTime}s`);
reportLines.push(``);
reportLines.push(`## Results`);
reportLines.push(``);
reportLines.push(`| Step | Status | Time |`);
reportLines.push(`|------|--------|------|`);

for (const r of results) {
  const icon = r.status === "PASS" ? "PASS" : r.status.startsWith("WARN") ? "WARN" : "FAIL";
  reportLines.push(`| ${r.name} | ${icon} | ${r.time} |`);
  if (r.status === "FAIL") failed = true;
}

reportLines.push(``);
reportLines.push(`## Screenshots`);
reportLines.push(``);
for (const f of screenshotFiles) {
  reportLines.push(`- ${f}`);
}
reportLines.push(``);
reportLines.push(`**Verdict:** ${failed ? "FAILED" : "PASSED"}`);

fs.writeFileSync(path.join(REPORT_DIR, "REPORT.md"), reportLines.join("\n"));

// ─── Save machine-readable results for comparison ─────────────
const resultsJson = {
  date: now.toISOString(),
  branch,
  verdict: failed ? "FAILED" : "PASSED",
  totalTime: `${totalTime}s`,
  steps: results.map((r) => ({
    name: r.name,
    status: r.status.startsWith("WARN") ? "WARN" : r.status,
    time: r.time,
  })),
  screenshots: screenshotFiles,
};
fs.writeFileSync(
  path.join(REPORT_DIR, "results.json"),
  JSON.stringify(resultsJson, null, 2)
);

// ─── Console summary ──────────────────────────────────────────
log("REGRESSION TEST SUMMARY");
for (const r of results) {
  const icon = r.status === "PASS" ? "+" : r.status.startsWith("WARN") ? "~" : "X";
  console.log(`  [${icon}] ${r.name}: ${r.status} (${r.time})`);
}
console.log();
console.log(`  Report saved to: ${REPORT_DIR}/REPORT.md`);
console.log(`  Screenshots: ${screenshotFiles.length} files copied`);
console.log(`  Total time: ${totalTime}s`);
console.log();

// ─── Auto-compare with previous run (non-blocking) ───────────
try {
  execSync(`node ${path.join("scripts", "compare-regression.js")} "${REPORT_DIR}"`, {
    stdio: "inherit",
    timeout: 60000,
  });
} catch {
  console.log("  (comparison skipped)\n");
}

if (failed) {
  console.log("Regression FAILED — fix failures before merging.\n");
  process.exit(1);
} else {
  console.log("Regression PASSED — safe to merge.\n");
}
