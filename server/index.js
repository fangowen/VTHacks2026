// Entry point. Checks the Node version *before* loading the app, because ESM hoists imports:
// on old Node the app's dependencies would otherwise fail with a confusing module error.
//
// If the shell's default `node` is too old (a common nvm/conda situation), we look for a newer
// one that's already installed and re-run ourselves with it, so `npm start` just works.

import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const MIN_MAJOR = 18;
const major = Number(process.versions.node.split(".")[0]);

function findNewerNode() {
  const roots = [join(homedir(), ".nvm/versions/node"), "/opt/homebrew/bin", "/usr/local/bin"];
  const candidates = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    if (root.endsWith("/bin")) { candidates.push(join(root, "node")); continue; }
    for (const dir of readdirSync(root)) {                    // nvm: v18.20.8, v20.x, v22.x …
      const m = /^v(\d+)\./.exec(dir);
      if (m && Number(m[1]) >= MIN_MAJOR) candidates.push(join(root, dir, "bin/node"));
    }
  }
  // Highest version wins
  const versioned = candidates
    .filter((p) => existsSync(p))
    .map((p) => {
      const out = spawnSync(p, ["-v"], { encoding: "utf8" });
      const v = Number(/^v(\d+)\./.exec(out.stdout?.trim() ?? "")?.[1] ?? 0);
      return { path: p, major: v };
    })
    .filter((c) => c.major >= MIN_MAJOR)
    .sort((a, b) => b.major - a.major);
  return versioned[0] ?? null;
}

if (major < MIN_MAJOR) {
  const newer = findNewerNode();
  if (newer) {
    console.log(`Node ${process.version} is too old for this server; using ${newer.path} (v${newer.major}) instead.`);
    const tip = newer.path.includes("/.nvm/versions/node/")
      ? `run "nvm use ${newer.major}"`
      : `put ${newer.path.replace(/\/node$/, "")} earlier in your PATH`;
    console.log(`Tip: ${tip} so your shell picks it up directly.\n`);
    const run = spawnSync(newer.path, [new URL("./app.js", import.meta.url).pathname], { stdio: "inherit" });
    process.exit(run.status ?? 1);
  }
  console.error(`\nThis server needs Node ${MIN_MAJOR} or newer — you're running ${process.version},`);
  console.error(`and no newer Node was found. Install one from https://nodejs.org or run "nvm install 22".\n`);
  process.exit(1);
}

import("./app.js").catch((err) => {
  console.error("Failed to start the Hokie Guide server:\n", err);
  process.exit(1);
});
