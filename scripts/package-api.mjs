import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

mkdirSync(join("api", "prisma"), { recursive: true });
const schema = readFileSync(join("prisma", "schema.prisma"), "utf8").replace(
  'provider = "prisma-client-js"',
  'provider = "prisma-client-js"\n  output = "../node_modules/.prisma/client"',
);
writeFileSync(join("api", "prisma", "schema.prisma"), schema);
const install = spawnSync(
  "npm",
  ["ci", "--prefix", "api", "--include=dev", "--no-audit", "--no-fund"],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);
if (install.error) throw install.error;
if (install.status !== 0) process.exit(install.status ?? 1);
const apiRequire = createRequire(resolve("api", "package.json"));
const generate = spawnSync(
  process.execPath,
  [
    apiRequire.resolve("prisma/build/index.js"),
    "generate",
    "--schema",
    join("api", "prisma", "schema.prisma"),
  ],
  { stdio: "inherit", env: { ...process.env, PRISMA_GENERATE_SKIP_AUTOINSTALL: "true" } },
);
if (generate.error) throw generate.error;
if (generate.status !== 0) process.exit(generate.status ?? 1);
const prune = spawnSync(
  "npm",
  ["prune", "--prefix", "api", "--omit=dev", "--no-audit", "--no-fund"],
  { stdio: "inherit", shell: process.platform === "win32" },
);
if (prune.error) throw prune.error;
if (prune.status !== 0) process.exit(prune.status ?? 1);
console.log("Functions package is ready in api. No private local settings were copied.");
