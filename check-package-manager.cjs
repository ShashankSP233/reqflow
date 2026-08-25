// Runs before "pnpm install". Enforces pnpm and clears stray lockfiles from
// other package managers. Written in plain Node (no shell syntax) so it
// works identically on Windows, macOS, and Linux — the previous version
// used `sh -c '...'`, which fails on Windows because `sh` isn't available
// there by default outside of Git Bash/WSL.
const fs = require("fs");

for (const file of ["package-lock.json", "yarn.lock"]) {
  if (fs.existsSync(file)) {
    fs.rmSync(file);
  }
}

const userAgent = process.env.npm_config_user_agent || "";
if (!userAgent.startsWith("pnpm/")) {
  console.error("\nThis project uses pnpm. Please run \"pnpm install\" instead of \"npm install\" or \"yarn install\".");
  console.error("Don't have pnpm yet? Install it with: npm install -g pnpm\n");
  process.exit(1);
}
