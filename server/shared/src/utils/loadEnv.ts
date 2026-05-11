import { config as dotenvConfig } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the monorepo root by walking up looking for the workspace package.json.
 * Each service is started in its own workspace directory, so the default `.env`
 * lookup misses the root file. We explicitly load it from the root.
 */
function findRepoRoot(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate) && fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

let loaded = false;

export function loadRootEnv() {
  if (loaded) return;
  loaded = true;

  // Always try the cwd first (for backwards compatibility / Docker `command` entries).
  dotenvConfig();

  const root = findRepoRoot(here) ?? findRepoRoot(process.cwd());
  if (root) {
    dotenvConfig({ path: path.join(root, ".env"), override: false });
  }
}
