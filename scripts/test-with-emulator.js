#!/usr/bin/env node
/**
 * Fully automated auth E2E test runner — production-like environment.
 *
 * Starts the FULL stack:
 *   1. Redis (if not already running)
 *   2. Firebase Auth Emulator
 *   3. API server (Hono + tRPC, port 3001)
 *   4. Expo web dev server (port 8081)
 *   5. Runs Playwright auth tests
 *   6. Cleans up all processes it started
 *
 * Usage: node scripts/test-with-emulator.js
 *        pnpm test:emulator
 */
const { spawn, execSync } = require("child_process");
const http = require("http");
const path = require("path");

const PROJECT_ID = "demo-draftplay";
const EMULATOR_PORT = 9099;
const API_PORT = 3001;
const DEV_SERVER_PORT = 8081;
const REDIS_PORT = 6379;

const ROOT_DIR = path.resolve(__dirname, "..");

function log(msg) {
  console.log(`\n[test-stack] ${msg}`);
}

function isPortInUse(port) {
  try {
    execSync(`lsof -i :${port}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function waitForPort(port, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://localhost:${port}`, () => {
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Port ${port} not ready after ${timeoutMs / 1000}s`));
        } else {
          setTimeout(check, 2000);
        }
      });
      req.end();
    };
    check();
  });
}

function waitForEmulatorReady(proc, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Emulator startup timed out")),
      timeoutMs,
    );
    const onData = (data) => {
      if (data.toString().includes("All emulators ready")) {
        clearTimeout(timeout);
        resolve();
      }
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("error", (err) => { clearTimeout(timeout); reject(err); });
    proc.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(timeout);
        reject(new Error(`Emulator exited with code ${code}`));
      }
    });
  });
}

async function main() {
  const started = { redis: false, emulator: false, api: false, expo: false };
  const procs = {};

  // Env vars shared by all child processes
  const testEnv = {
    ...process.env,
    FIREBASE_AUTH_EMULATOR_HOST: `localhost:${EMULATOR_PORT}`,
    EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: `localhost:${EMULATOR_PORT}`,
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID,
    EXPO_PUBLIC_FIREBASE_API_KEY: "fake-api-key",
    NODE_ENV: "development",
  };

  try {
    // ── 1. Redis ──
    if (isPortInUse(REDIS_PORT)) {
      log(`Redis already running on port ${REDIS_PORT}`);
    } else {
      log("Starting Redis...");
      procs.redis = spawn("redis-server", ["--port", String(REDIS_PORT), "--daemonize", "no"], {
        stdio: "pipe",
        env: testEnv,
      });
      started.redis = true;
      // Wait briefly for Redis to start
      await new Promise((resolve) => setTimeout(resolve, 1000));
      log("Redis started");
    }

    // ── 2. Firebase Auth Emulator ──
    if (isPortInUse(EMULATOR_PORT)) {
      log(`Firebase Auth Emulator already running on port ${EMULATOR_PORT}`);
    } else {
      log("Starting Firebase Auth Emulator...");
      procs.emulator = spawn(
        "npx",
        ["firebase", "emulators:start", "--only", "auth", "--project", PROJECT_ID],
        { stdio: "pipe", env: testEnv, cwd: ROOT_DIR },
      );
      await waitForEmulatorReady(procs.emulator);
      started.emulator = true;
      log("Firebase Auth Emulator ready");
    }

    // ── 3. API Server ──
    if (isPortInUse(API_PORT)) {
      log(`API server already running on port ${API_PORT}`);
    } else {
      log("Starting API server...");
      procs.api = spawn(
        "pnpm",
        ["--filter", "@draftplay/api", "dev"],
        { stdio: "pipe", env: testEnv, cwd: ROOT_DIR, shell: true },
      );
      procs.api.stdout.on("data", (data) => {
        process.stdout.write(`[api:out] ${data.toString()}`);
      });
      procs.api.stderr.on("data", (data) => {
        process.stderr.write(`[api:err] ${data.toString()}`);
      });
      procs.api.on("exit", (code) => {
        log(`API server exited with code ${code}`);
      });
      log(`Waiting for API server on port ${API_PORT}...`);
      await waitForPort(API_PORT, 60000);
      started.api = true;
      log("API server ready");
    }

    // ── 4. Expo Dev Server ──
    if (isPortInUse(DEV_SERVER_PORT)) {
      log(`Expo dev server already running on port ${DEV_SERVER_PORT}`);
    } else {
      log("Starting Expo dev server (web)...");
      procs.expo = spawn(
        "npx",
        ["expo", "start", "--web", "--port", String(DEV_SERVER_PORT)],
        { stdio: "pipe", cwd: path.join(ROOT_DIR, "apps/mobile"), env: testEnv },
      );
      procs.expo.on("error", (err) => {
        log(`Expo error: ${err.message}`);
      });
      log(`Waiting for Expo on port ${DEV_SERVER_PORT}...`);
      await waitForPort(DEV_SERVER_PORT, 90000);
      started.expo = true;
      log("Expo dev server ready");
    }

    // ── 5. Run all E2E tests (auth + non-auth) ──
    const testDirs = process.argv.includes("--auth-only")
      ? "tests/e2e/functional/"
      : "tests/e2e/";

    log(`=== Full stack ready — running E2E tests (${testDirs}) ===`);
    execSync(`npx playwright test ${testDirs} --project=mobile`, {
      stdio: "inherit",
      env: testEnv,
      cwd: ROOT_DIR,
    });

    log("All E2E tests passed!");
  } catch (err) {
    if (err.status) {
      log(`Tests failed with exit code ${err.status}`);
      process.exitCode = err.status;
    } else {
      console.error(err);
      process.exitCode = 1;
    }
  } finally {
    // ── 6. Cleanup — only kill what we started ──
    if (started.expo && procs.expo) {
      log("Stopping Expo dev server...");
      procs.expo.kill("SIGTERM");
    }
    if (started.api && procs.api) {
      log("Stopping API server...");
      procs.api.kill("SIGTERM");
    }
    if (started.emulator && procs.emulator) {
      log("Stopping Firebase Auth Emulator...");
      procs.emulator.kill("SIGTERM");
    }
    if (started.redis && procs.redis) {
      log("Stopping Redis...");
      procs.redis.kill("SIGTERM");
    }
  }
}

main();
