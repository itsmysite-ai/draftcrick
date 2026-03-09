#!/usr/bin/env node
/**
 * Per-screenshot diff tracker — called by test-regression.js after each
 * functional spec completes and new screenshots are detected.
 *
 * For each screenshot:
 *  1. Pixel-diff against the equivalent in the previous regression run
 *  2. Appends diff metadata to LIVE_REPORT.md in the current run folder
 *
 * AI critique is intentionally NOT automated here. When running a regression
 * via Claude Code, Claude reads the screenshots directly and provides
 * contextual critique (codebase-aware, UX/UI/tech/business angles).
 *
 * Usage:
 *   node scripts/critique-screenshot.js <currentDir> <prevDir|"none"> <screenshotName> <specLabel> <liveReportPath>
 *
 * Special usage — finalize (generate LIVE_REPORT.html from accumulated MD):
 *   node scripts/critique-screenshot.js --finalize <currentDir> <liveReportPath>
 */

const fs = require("fs");
const path = require("path");

// ─── Finalize mode ────────────────────────────────────────────
if (process.argv[2] === "--finalize") {
  const currentDir = process.argv[3];
  const liveReportPath = process.argv[4];
  finalizeLiveReport(currentDir, liveReportPath);
  process.exit(0);
}

// ─── Normal mode args ─────────────────────────────────────────
const [, , currentDir, prevDirArg, screenshotName, specLabel, liveReportPath] = process.argv;
const prevDir = prevDirArg === "none" ? null : prevDirArg;

if (!currentDir || !screenshotName || !liveReportPath) {
  console.log(
    "Usage: node scripts/critique-screenshot.js <currentDir> <prevDir|none> <screenshotName> <specLabel> <liveReportPath>"
  );
  process.exit(1);
}

// ─── Guard: pngjs + pixelmatch ────────────────────────────────
let PNG, pixelmatch;
try {
  ({ PNG } = require("pngjs"));
  pixelmatch = require("pixelmatch");
} catch {
  console.log("  [diff] pixelmatch/pngjs not installed — pixel diff skipped");
}

// ─── Pixel diff ───────────────────────────────────────────────
let diffPct = null;
let diffStatus = "no-previous";
let diffFilePath = null;

if (PNG && pixelmatch && prevDir && fs.existsSync(prevDir)) {
  const prevImgPath = path.join(prevDir, screenshotName);
  const currImgPath = path.join(currentDir, screenshotName);

  if (!fs.existsSync(prevImgPath)) {
    diffStatus = "new";
  } else if (fs.existsSync(currImgPath)) {
    try {
      const imgA = PNG.sync.read(fs.readFileSync(prevImgPath));
      const imgB = PNG.sync.read(fs.readFileSync(currImgPath));

      const width = Math.max(imgA.width, imgB.width);
      const height = Math.max(imgA.height, imgB.height);

      function padImage(img, tw, th) {
        if (img.width === tw && img.height === th) return img;
        const padded = new PNG({ width: tw, height: th });
        padded.data.fill(0);
        PNG.bitblt(img, padded, 0, 0, img.width, img.height, 0, 0);
        return padded;
      }

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

      diffPct = parseFloat(((numDiff / (width * height)) * 100).toFixed(2));
      diffStatus = diffPct > 0 ? "changed" : "identical";

      const diffDir = path.join(currentDir, "diff");
      fs.mkdirSync(diffDir, { recursive: true });
      const diffFile = `diff-${screenshotName}`;
      diffFilePath = path.join(diffDir, diffFile);
      fs.writeFileSync(diffFilePath, PNG.sync.write(diffPng));
    } catch (err) {
      diffStatus = "error";
      console.log(`  [diff] error for ${screenshotName}: ${err.message}`);
    }
  }
}

// ─── Append to LIVE_REPORT.md ─────────────────────────────────
const now = new Date().toTimeString().slice(0, 8);
const storyName = screenshotName.replace(".png", "");

const diffLine =
  diffStatus === "new"       ? "**Pixel diff:** NEW — no previous screenshot to compare" :
  diffStatus === "no-previous" ? "**Pixel diff:** No previous run for comparison" :
  diffStatus === "identical" ? "**Pixel diff:** 0.00% — identical to previous run" :
  diffStatus === "changed"   ? `**Pixel diff:** ${diffPct}% pixels changed` :
                               "**Pixel diff:** unavailable";

const section = [
  `## ${storyName}  [${specLabel}]  [${now}]`,
  ``,
  diffLine,
  diffFilePath ? `**Diff image:** diff/diff-${screenshotName}` : "",
  ``,
  `_Claude critique pending — ask Claude to review after regression completes._`,
  ``,
  `---`,
  ``,
].filter((l) => l !== undefined).join("\n");

fs.appendFileSync(liveReportPath, section);

// Console status
const diffLabel =
  diffStatus === "new"       ? "NEW" :
  diffStatus === "identical" ? "0.00% diff" :
  diffStatus === "changed"   ? `${diffPct}% diff` :
  diffStatus;

console.log(`  [diff] ${screenshotName} → ${diffLabel}`);

// ─── Finalize: generate LIVE_REPORT.html ──────────────────────
function finalizeLiveReport(dir, mdPath) {
  if (!fs.existsSync(mdPath)) {
    console.log("  [diff] No LIVE_REPORT.md found — skipping HTML generation");
    return;
  }

  const md = fs.readFileSync(mdPath, "utf-8");
  const sections = md.split(/^## /m).filter(Boolean);
  const headerRaw = md.startsWith("# ") ? md.split(/^## /m)[0] : "";
  const headerHtml = headerRaw
    .replace(/^# .+\n/, "")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, " &nbsp;·&nbsp; ")
    .trim();

  function imgToBase64(p) {
    if (!p || !fs.existsSync(p)) return null;
    return `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
  }

  const cards = sections.map((section) => {
    const lines = section.split("\n");
    const heading = lines[0].trim();
    const body = lines.slice(1).join("\n").trim();

    const storyMatch = heading.match(/^(story-[\w-]+)/);
    const storyName = storyMatch ? storyMatch[1] : heading.split(/\s+/)[0];
    const pngName = `${storyName}.png`;

    const currImg = imgToBase64(path.join(dir, pngName));
    const diffImg = imgToBase64(path.join(dir, "diff", `diff-${pngName}`));

    const diffMatch = body.match(/\*\*Pixel diff:\*\* ([\d.]+)%/);
    const diffPctVal = diffMatch ? parseFloat(diffMatch[1]) : null;
    const badgeCls =
      body.includes("NEW") ? "badge-new" :
      body.includes("identical") ? "badge-pass" :
      diffPctVal === null ? "badge-none" :
      diffPctVal === 0 ? "badge-pass" :
      diffPctVal < 5 ? "badge-warn" : "badge-fail";

    const badgeLabel =
      body.includes("NEW") ? "NEW" :
      body.includes("identical") ? "IDENTICAL" :
      diffPctVal !== null ? `${diffPctVal}% CHANGED` : "—";

    const bodyHtml = body
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .replace(/\n/g, "<br>");

    return `
<div class="card">
  <div class="card-header">
    <span class="card-title">${heading}</span>
    <span class="diff-badge ${badgeCls}">${badgeLabel}</span>
  </div>
  <div class="card-body">
    <div class="panels">
      <div class="panel">
        <div class="panel-label">Screenshot</div>
        ${currImg ? `<img src="${currImg}" alt="${storyName}">` : `<div class="no-img">No image</div>`}
      </div>
      <div class="panel">
        <div class="panel-label">Pixel Diff</div>
        ${diffImg ? `<img src="${diffImg}" alt="diff">` : `<div class="no-img">No diff</div>`}
      </div>
      <div class="panel notes-panel">
        <div class="panel-label">Diff Notes</div>
        <div class="notes-text">${bodyHtml}</div>
        <div class="critique-placeholder">
          💬 Ask Claude to critique this screenshot for UX / UI / technical / business gaps.
        </div>
      </div>
    </div>
  </div>
</div>`;
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Live Diff Report</title>
<style>
*,*::before,*::after{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f5f7;color:#1a1a2e;margin:0;padding:20px;font-size:14px;line-height:1.6}
h1{font-size:22px;margin:0 0 4px}
.meta{color:#666;font-size:13px;margin-bottom:24px}
.card{background:white;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.1);margin-bottom:20px;overflow:hidden}
.card-header{padding:12px 20px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;gap:12px}
.card-title{font-family:monospace;font-weight:700;font-size:13px;color:#333}
.diff-badge{font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;white-space:nowrap}
.badge-pass{background:#d4edda;color:#155724}
.badge-warn{background:#fff3cd;color:#856404}
.badge-fail{background:#f8d7da;color:#721c24}
.badge-new{background:#cce5ff;color:#004085}
.badge-none{background:#f0f0f0;color:#888}
.card-body{padding:16px 20px}
.panels{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}
.panel{text-align:center;min-width:180px}
.panel-label{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#999;margin-bottom:6px;font-weight:600}
.panel img{max-width:220px;max-height:400px;border:1px solid #ddd;border-radius:6px;display:block}
.notes-panel{flex:1;min-width:260px;text-align:left}
.notes-text{font-size:13px;line-height:1.7;color:#444;margin-bottom:12px}
.critique-placeholder{background:#f8f9fa;border:1px dashed #ccc;border-radius:6px;padding:10px 14px;font-size:12px;color:#666;font-style:italic}
.no-img{width:200px;height:150px;background:#f8f8f8;border:2px dashed #ddd;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:12px}
</style>
</head>
<body>
<h1>Live Diff Report</h1>
<div class="meta">${headerHtml}</div>
${cards.join("\n")}
</body>
</html>`;

  const htmlPath = path.join(dir, "LIVE_REPORT.html");
  fs.writeFileSync(htmlPath, html);
  console.log(`  [diff] LIVE_REPORT.html → ${htmlPath}`);
}
