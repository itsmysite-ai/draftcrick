#!/usr/bin/env node
/**
 * Regression run comparator — called automatically by test-regression.js
 * and runnable standalone via `pnpm test:compare`.
 *
 * Compares the two most recent regression runs and produces:
 *   COMPARISON.md   — quick terminal diff view
 *   COMPARISON.html — full visual HTML report with before/after/diff images
 *   diff/           — pixel diff PNGs (red = changed pixels)
 *
 * Usage:
 *   node scripts/compare-regression.js [currentRunPath]
 *   pnpm test:compare
 */

const fs = require("fs");
const path = require("path");

// ─── Guard: check deps are installed ──────────────────────────
let PNG, pixelmatch;
try {
  ({ PNG } = require("pngjs"));
  pixelmatch = require("pixelmatch");
} catch {
  console.log(
    "\n  [compare] ERROR: pixelmatch and pngjs are required.\n" +
      "  [compare] Install them with: pnpm add -D pixelmatch pngjs\n"
  );
  process.exit(0);
}

// ─── A. Find the two runs to compare ──────────────────────────
const REGRESSION_BASE = path.join("screenshots", "regression");

if (!fs.existsSync(REGRESSION_BASE)) {
  console.log("\n  [compare] No regression runs found yet.\n");
  process.exit(0);
}

const allRuns = fs
  .readdirSync(REGRESSION_BASE)
  .filter((name) =>
    fs.statSync(path.join(REGRESSION_BASE, name)).isDirectory()
  )
  .sort(); // ISO timestamp prefix → lexicographic = chronological

if (allRuns.length < 2) {
  console.log(
    "\n  [compare] Only 1 regression run found — no previous run to compare against.\n" +
      "  [compare] Run `pnpm test:regression` again to enable comparison.\n"
  );
  process.exit(0);
}

const explicitCurrent = process.argv[2]
  ? path.basename(process.argv[2])
  : null;
const currentRunName = explicitCurrent ?? allRuns[allRuns.length - 1];
const currentIdx = allRuns.indexOf(currentRunName);
const previousRunName =
  currentIdx > 0 ? allRuns[currentIdx - 1] : allRuns[allRuns.length - 2];

const currentDir = path.join(REGRESSION_BASE, currentRunName);
const previousDir = path.join(REGRESSION_BASE, previousRunName);

console.log(`\n${"=".repeat(60)}`);
console.log(`  REGRESSION COMPARISON`);
console.log(`${"=".repeat(60)}`);
console.log(`  Current:  ${currentRunName}`);
console.log(`  Previous: ${previousRunName}\n`);

// ─── B. Load results.json from each run ───────────────────────
function loadResults(dir) {
  const p = path.join(dir, "results.json");
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

const currentResults = loadResults(currentDir);
const previousResults = loadResults(previousDir);

// ─── B2. Compute step delta ────────────────────────────────────
function classifyChange(prev, curr) {
  if (!prev) return "new";
  if (!curr) return "removed";
  if (prev === curr) return "unchanged";
  if (curr === "PASS") return "improved";
  if (curr === "FAIL") return "regressed";
  if (curr === "WARN" && prev === "PASS") return "degraded";
  if (curr === "WARN" && prev === "FAIL") return "improved";
  return "unchanged";
}

const stepDelta = [];
if (currentResults && previousResults) {
  const prevMap = {};
  for (const s of previousResults.steps) prevMap[s.name] = s.status;

  for (const s of currentResults.steps) {
    const prev = prevMap[s.name] ?? null;
    stepDelta.push({
      name: s.name,
      prev,
      curr: s.status,
      change: classifyChange(prev, s.status),
      time: s.time,
    });
    delete prevMap[s.name];
  }
  // Steps in previous but not in current
  for (const [name, status] of Object.entries(prevMap)) {
    stepDelta.push({ name, prev: status, curr: null, change: "removed", time: null });
  }
}

// ─── C. Pixel-diff screenshots ────────────────────────────────
function listPngs(dir) {
  return fs
    .readdirSync(dir)
    .filter(
      (f) =>
        f.endsWith(".png") &&
        !f.startsWith("diff-") &&
        !f.includes("playwright-report")
    );
}

const currentScreenshots = currentResults?.screenshots ?? listPngs(currentDir);
const previousScreenshots = previousResults?.screenshots ?? listPngs(previousDir);

const diffDir = path.join(currentDir, "diff");
fs.mkdirSync(diffDir, { recursive: true });

// Pad a PNG to a target canvas size (fill extra pixels with zeros/transparent)
function padImage(img, targetW, targetH) {
  if (img.width === targetW && img.height === targetH) return img;
  const padded = new PNG({ width: targetW, height: targetH });
  padded.data.fill(0);
  PNG.bitblt(img, padded, 0, 0, img.width, img.height, 0, 0);
  return padded;
}

const allNames = [
  ...new Set([...currentScreenshots, ...previousScreenshots]),
].sort();

const screenshotDelta = [];

for (const name of allNames) {
  const inCurrent = currentScreenshots.includes(name);
  const inPrevious = previousScreenshots.includes(name);

  if (inCurrent && !inPrevious) {
    screenshotDelta.push({ name, status: "new", diffPct: null, diffFile: null });
    continue;
  }
  if (!inCurrent && inPrevious) {
    screenshotDelta.push({ name, status: "missing", diffPct: null, diffFile: null });
    continue;
  }

  // Both exist — pixel diff
  try {
    const rawA = fs.readFileSync(path.join(previousDir, name));
    const rawB = fs.readFileSync(path.join(currentDir, name));
    const imgA = PNG.sync.read(rawA);
    const imgB = PNG.sync.read(rawB);

    const width = Math.max(imgA.width, imgB.width);
    const height = Math.max(imgA.height, imgB.height);
    const canvasA = padImage(imgA, width, height);
    const canvasB = padImage(imgB, width, height);

    const diffPng = new PNG({ width, height });
    const numDiff = pixelmatch(
      canvasA.data,
      canvasB.data,
      diffPng.data,
      width,
      height,
      { threshold: 0.1, alpha: 0.3, diffColor: [255, 0, 0] }
    );

    const diffPct = parseFloat(((numDiff / (width * height)) * 100).toFixed(2));
    const diffFile = `diff-${name}`;
    fs.writeFileSync(path.join(diffDir, diffFile), PNG.sync.write(diffPng));

    screenshotDelta.push({
      name,
      status: diffPct > 0 ? "changed" : "identical",
      diffPct,
      diffFile: path.join("diff", diffFile),
    });
  } catch (err) {
    console.log(`  [compare] WARN: could not diff ${name}: ${err.message}`);
    screenshotDelta.push({ name, status: "error", diffPct: null, diffFile: null });
  }
}

// ─── D. Summary stats ─────────────────────────────────────────
const stats = {
  improved: stepDelta.filter((s) => s.change === "improved").length,
  regressed: stepDelta.filter((s) => s.change === "regressed").length,
  degraded: stepDelta.filter((s) => s.change === "degraded").length,
  screenshotsChanged: screenshotDelta.filter((s) => s.status === "changed").length,
  screenshotsNew: screenshotDelta.filter((s) => s.status === "new").length,
  screenshotsMissing: screenshotDelta.filter((s) => s.status === "missing").length,
  screenshotsIdentical: screenshotDelta.filter((s) => s.status === "identical").length,
};

// ─── E. Write COMPARISON.md ───────────────────────────────────
function fmtDate(iso) {
  return iso ? iso.replace("T", " ").slice(0, 19) : "unknown";
}

const mdLines = [];
mdLines.push(`# Regression Comparison`);
mdLines.push(``);
mdLines.push(
  `**Current:**  ${fmtDate(currentResults?.date ?? currentRunName)} · branch: ${currentResults?.branch ?? "?"} · ${currentResults?.verdict ?? "?"}`
);
mdLines.push(
  `**Previous:** ${fmtDate(previousResults?.date ?? previousRunName)} · branch: ${previousResults?.branch ?? "?"} · ${previousResults?.verdict ?? "?"}`
);
mdLines.push(``);
mdLines.push(`---`);

if (stepDelta.length > 0) {
  mdLines.push(``);
  mdLines.push(`## Test Step Delta`);
  mdLines.push(``);
  mdLines.push(`| Step | Previous | Current | Change |`);
  mdLines.push(`|------|----------|---------|--------|`);
  for (const s of stepDelta) {
    const changeLabel = {
      improved: "IMPROVED",
      regressed: "REGRESSED",
      degraded: "DEGRADED",
      unchanged: "—",
      new: "NEW",
      removed: "REMOVED",
    }[s.change] ?? s.change.toUpperCase();
    mdLines.push(
      `| ${s.name} | ${s.prev ?? "—"} | ${s.curr ?? "—"} | ${changeLabel} |`
    );
  }
} else {
  mdLines.push(``);
  mdLines.push(
    `## Test Step Delta\n\n_Step comparison unavailable (no results.json in one or both runs)._`
  );
}

mdLines.push(``);
mdLines.push(`---`);
mdLines.push(``);
mdLines.push(`## Screenshot Delta`);
mdLines.push(``);
mdLines.push(`| Screenshot | Status | Diff % |`);
mdLines.push(`|------------|--------|--------|`);
for (const s of screenshotDelta) {
  const pct = s.diffPct !== null ? `${s.diffPct}%` : "—";
  mdLines.push(`| ${s.name} | ${s.status.toUpperCase()} | ${pct} |`);
}

mdLines.push(``);
mdLines.push(`---`);
mdLines.push(``);
mdLines.push(`## Summary`);
mdLines.push(``);
mdLines.push(`- Step improvements:      ${stats.improved}`);
mdLines.push(`- Step regressions:       ${stats.regressed}`);
mdLines.push(`- Step degradations:      ${stats.degraded}`);
mdLines.push(`- Screenshots changed:    ${stats.screenshotsChanged}`);
mdLines.push(`- Screenshots new:        ${stats.screenshotsNew}`);
mdLines.push(`- Screenshots missing:    ${stats.screenshotsMissing}`);
mdLines.push(`- Screenshots identical:  ${stats.screenshotsIdentical}`);
mdLines.push(``);
mdLines.push(`**Diff images:** ${path.join(currentDir, "diff")}`);
mdLines.push(`**HTML report:** ${path.join(currentDir, "COMPARISON.html")}`);

fs.writeFileSync(path.join(currentDir, "COMPARISON.md"), mdLines.join("\n"));

// ─── F. Write COMPARISON.html ─────────────────────────────────
function imgToBase64(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return `data:image/png;base64,${fs.readFileSync(filePath).toString("base64")}`;
}

function statusBadge(status) {
  if (!status) return `<span class="badge badge-none">—</span>`;
  const cls = { PASS: "pass", WARN: "warn", FAIL: "fail" }[status] ?? "none";
  return `<span class="badge badge-${cls}">${status}</span>`;
}

function changeBadge(change) {
  const map = {
    improved: ["improved", "IMPROVED"],
    regressed: ["regressed", "REGRESSED"],
    degraded: ["degraded", "DEGRADED"],
    new: ["new-step", "NEW"],
    removed: ["removed", "REMOVED"],
    unchanged: ["unchanged", "—"],
  };
  const [cls, label] = map[change] ?? ["unchanged", "—"];
  return `<span class="badge badge-${cls}">${label}</span>`;
}

const allIdentical =
  stats.improved === 0 &&
  stats.regressed === 0 &&
  stats.degraded === 0 &&
  stats.screenshotsChanged === 0 &&
  stats.screenshotsNew === 0 &&
  stats.screenshotsMissing === 0;

const statsHtml = allIdentical
  ? `<div class="stat-pill pill-identical">ALL IDENTICAL</div>`
  : [
      stats.improved > 0
        ? `<div class="stat-pill pill-improved">${stats.improved} IMPROVED</div>`
        : "",
      stats.regressed > 0
        ? `<div class="stat-pill pill-regressed">${stats.regressed} REGRESSED</div>`
        : "",
      stats.degraded > 0
        ? `<div class="stat-pill pill-degraded">${stats.degraded} DEGRADED</div>`
        : "",
      stats.screenshotsChanged > 0
        ? `<div class="stat-pill pill-changed">${stats.screenshotsChanged} SCREENSHOTS CHANGED</div>`
        : "",
      stats.screenshotsNew > 0
        ? `<div class="stat-pill pill-new">${stats.screenshotsNew} NEW SCREENSHOTS</div>`
        : "",
      stats.screenshotsMissing > 0
        ? `<div class="stat-pill pill-missing">${stats.screenshotsMissing} MISSING SCREENSHOTS</div>`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

const stepTableRows =
  stepDelta.length > 0
    ? stepDelta
        .map(
          (s) => `
    <tr class="row-${s.change}">
      <td>${s.name}</td>
      <td>${statusBadge(s.prev)}</td>
      <td>${statusBadge(s.curr)}</td>
      <td>${changeBadge(s.change)}</td>
      <td>${s.time ?? "—"}</td>
    </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:#888;font-style:italic">
        Step comparison unavailable — no results.json in one or both runs
      </td></tr>`;

function screenshotCardHtml(s) {
  const prevPath = path.join(previousDir, s.name);
  const currPath = path.join(currentDir, s.name);
  const diffPath = s.diffFile ? path.join(currentDir, s.diffFile) : null;

  const prevB64 = imgToBase64(prevPath);
  const currB64 = imgToBase64(currPath);
  const diffB64 = imgToBase64(diffPath);

  const placeholder = `<div class="img-placeholder">—</div>`;

  const changeCls = {
    changed: "changed",
    identical: "identical",
    new: "new-ss",
    missing: "missing",
    error: "error",
  }[s.status] ?? "";

  const changeLabel = {
    changed: `CHANGED ${s.diffPct}%`,
    identical: `IDENTICAL`,
    new: `NEW`,
    missing: `MISSING`,
    error: `ERROR`,
  }[s.status] ?? s.status.toUpperCase();

  return `
<div class="screenshot-card">
  <div class="screenshot-header">
    <span class="screenshot-name">${s.name}</span>
    <span class="change-badge ${changeCls}">${changeLabel}</span>
  </div>
  <div class="screenshot-panels">
    <div class="panel">
      <div class="panel-label">Previous</div>
      ${prevB64 ? `<img src="${prevB64}" alt="previous">` : placeholder}
    </div>
    <div class="panel">
      <div class="panel-label">Diff</div>
      ${diffB64 ? `<img src="${diffB64}" alt="diff">` : placeholder}
    </div>
    <div class="panel">
      <div class="panel-label">Current</div>
      ${currB64 ? `<img src="${currB64}" alt="current">` : placeholder}
    </div>
  </div>
</div>`;
}

const screenshotCards = screenshotDelta.map(screenshotCardHtml).join("\n");

const verdictCls = (v) =>
  ({ PASSED: "pass", FAILED: "fail" }[v] ?? "warn");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Regression Comparison — ${currentRunName}</title>
<style>
*, *::before, *::after { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #f4f5f7; color: #1a1a2e; margin: 0; padding: 20px;
  font-size: 14px; line-height: 1.5;
}
h1 { margin: 0 0 20px; font-size: 22px; color: #1a1a2e; }
h2 { font-size: 16px; margin: 28px 0 12px; color: #333; border-bottom: 2px solid #e0e0e0; padding-bottom: 6px; }

/* Run header cards */
.run-header { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.run-card {
  flex: 1; min-width: 260px; background: white; border-radius: 10px;
  padding: 16px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.1);
}
.run-card-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
                  color: #888; margin-bottom: 6px; }
.run-card-date { font-size: 15px; font-weight: 600; margin-bottom: 2px; }
.run-card-branch { font-size: 12px; color: #555; margin-bottom: 8px; font-family: monospace; }
.run-card-meta { font-size: 12px; color: #777; }

/* Stats strip */
.stats-strip { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
.stat-pill {
  padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 700;
  letter-spacing: 0.03em;
}
.pill-improved  { background: #d4edda; color: #155724; }
.pill-regressed { background: #f8d7da; color: #721c24; }
.pill-degraded  { background: #fff3cd; color: #856404; }
.pill-changed   { background: #fff3cd; color: #856404; }
.pill-new       { background: #cce5ff; color: #004085; }
.pill-missing   { background: #f8d7da; color: #721c24; }
.pill-identical { background: #d4edda; color: #155724; }

/* Status + change badges */
.badge {
  display: inline-block; padding: 2px 8px; border-radius: 12px;
  font-size: 11px; font-weight: 700; text-transform: uppercase;
}
.badge-pass     { background: #d4edda; color: #155724; }
.badge-warn     { background: #fff3cd; color: #856404; }
.badge-fail     { background: #f8d7da; color: #721c24; }
.badge-none     { background: #f0f0f0; color: #888; }
.badge-improved { background: #d4edda; color: #155724; }
.badge-regressed{ background: #f8d7da; color: #721c24; }
.badge-degraded { background: #fff3cd; color: #856404; }
.badge-new-step { background: #cce5ff; color: #004085; }
.badge-removed  { background: #e2e3e5; color: #383d41; }
.badge-unchanged{ background: #f0f0f0; color: #888; }

/* Step table */
.step-table { width: 100%; border-collapse: collapse; background: white;
              border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.1);
              margin-bottom: 8px; }
.step-table th {
  background: #f0f0f0; padding: 10px 14px; text-align: left;
  font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #555;
  border-bottom: 2px solid #e0e0e0;
}
.step-table td { padding: 10px 14px; border-bottom: 1px solid #f0f0f0; }
.step-table tr:last-child td { border-bottom: none; }
.row-improved  td { background: #f0fff4; }
.row-regressed td { background: #fff5f5; }
.row-degraded  td { background: #fffbf0; }
.row-new       td { background: #f0f7ff; }
.row-removed   td { background: #f9f9f9; color: #888; }
.row-unchanged td { background: white; }

/* Screenshot cards */
.screenshot-card {
  background: white; border-radius: 10px; padding: 16px 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1); margin-bottom: 16px;
}
.screenshot-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 14px;
}
.screenshot-name { font-family: monospace; font-size: 13px; font-weight: 600; color: #333; }
.change-badge {
  font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px;
}
.change-badge.changed   { background: #fff3cd; color: #856404; }
.change-badge.identical { background: #d4edda; color: #155724; }
.change-badge.new-ss    { background: #cce5ff; color: #004085; }
.change-badge.missing   { background: #f8d7da; color: #721c24; }
.change-badge.error     { background: #e2e3e5; color: #383d41; }

.screenshot-panels { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
.panel { text-align: center; }
.panel-label {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
  color: #999; margin-bottom: 6px; font-weight: 600;
}
.panel img { max-width: 280px; max-height: 500px; border: 1px solid #ddd;
             border-radius: 6px; display: block; }
.img-placeholder {
  width: 280px; height: 200px; background: #f8f8f8; border: 2px dashed #ddd;
  border-radius: 6px; display: flex; align-items: center; justify-content: center;
  color: #bbb; font-size: 24px;
}
</style>
</head>
<body>

<h1>Regression Comparison</h1>

<div class="run-header">
  <div class="run-card">
    <div class="run-card-label">Previous Run</div>
    <div class="run-card-date">${fmtDate(previousResults?.date ?? previousRunName)}</div>
    <div class="run-card-branch">${previousResults?.branch ?? previousRunName}</div>
    <div class="run-card-meta">
      Verdict: ${statusBadge(previousResults?.verdict ? (previousResults.verdict === "PASSED" ? "PASS" : "FAIL") : null)}
      &nbsp;&nbsp;Time: ${previousResults?.totalTime ?? "—"}
    </div>
  </div>
  <div class="run-card">
    <div class="run-card-label">Current Run</div>
    <div class="run-card-date">${fmtDate(currentResults?.date ?? currentRunName)}</div>
    <div class="run-card-branch">${currentResults?.branch ?? currentRunName}</div>
    <div class="run-card-meta">
      Verdict: ${statusBadge(currentResults?.verdict ? (currentResults.verdict === "PASSED" ? "PASS" : "FAIL") : null)}
      &nbsp;&nbsp;Time: ${currentResults?.totalTime ?? "—"}
    </div>
  </div>
</div>

<div class="stats-strip">
${statsHtml}
</div>

<h2>Test Step Delta</h2>
<table class="step-table">
  <thead>
    <tr>
      <th>Step</th>
      <th>Previous</th>
      <th>Current</th>
      <th>Change</th>
      <th>Time</th>
    </tr>
  </thead>
  <tbody>
    ${stepTableRows}
  </tbody>
</table>

<h2>Screenshot Comparison (${screenshotDelta.length} screenshots)</h2>
${screenshotCards}

</body>
</html>`;

fs.writeFileSync(path.join(currentDir, "COMPARISON.html"), html);

// ─── G. Terminal summary ───────────────────────────────────────
console.log(`  Step changes:`);
for (const s of stepDelta.filter((x) => x.change !== "unchanged")) {
  const icon =
    { improved: "+", regressed: "X", degraded: "~", new: "+", removed: "-" }[
      s.change
    ] ?? "?";
  const label = s.change.toUpperCase();
  console.log(`    [${icon}] ${s.name}: ${s.prev ?? "—"} → ${s.curr ?? "—"} (${label})`);
}
if (stepDelta.every((s) => s.change === "unchanged")) {
  console.log(`    All test steps unchanged.`);
}

console.log();
console.log(`  Screenshots: ${stats.screenshotsIdentical} identical, ${stats.screenshotsChanged} changed, ${stats.screenshotsNew} new, ${stats.screenshotsMissing} missing`);
console.log();
console.log(`  COMPARISON.md  → ${path.join(currentDir, "COMPARISON.md")}`);
console.log(`  COMPARISON.html → ${path.join(currentDir, "COMPARISON.html")}`);
if (screenshotDelta.some((s) => s.diffFile)) {
  console.log(`  Diff images    → ${diffDir}/`);
}
console.log();
