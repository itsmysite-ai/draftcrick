import * as fs from "fs";
import * as path from "path";

const DEFAULT_DIR = "tests/e2e/functional/screenshots";

/**
 * Returns the correct path for a screenshot.
 * - When running via `pnpm test:regression`, uses REGRESSION_SCREENSHOT_DIR (timestamped folder).
 * - When running standalone, falls back to tests/e2e/functional/screenshots/.
 */
export function screenshotPath(name: string): string {
  const dir = process.env.REGRESSION_SCREENSHOT_DIR ?? DEFAULT_DIR;
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, name);
}
