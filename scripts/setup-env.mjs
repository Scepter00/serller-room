#!/usr/bin/env node
/**
 * Generates a local `.env` from `.env.example` with development defaults
 * (SQLite database, generated AUTH_SECRET, local storage driver).
 * Does not overwrite an existing `.env`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const examplePath = path.join(root, ".env.example");
const envPath = path.join(root, ".env");

if (existsSync(envPath)) {
  console.log("ℹ .env already exists — leaving it untouched.");
  process.exit(0);
}

if (!existsSync(examplePath)) {
  console.error("✖ .env.example not found");
  process.exit(1);
}

let env = readFileSync(examplePath, "utf8");

env = env
  .replace(/^DATABASE_PROVIDER=.*$/m, "DATABASE_PROVIDER=sqlite")
  .replace(
    /^DATABASE_URL=.*$/m,
    "DATABASE_URL=file:./dev.db"
  )
  .replace(
    /^AUTH_SECRET=.*$/m,
    `AUTH_SECRET=${randomBytes(48).toString("hex")}`
  )
  .replace(/^STORAGE_DRIVER=.*$/m, "STORAGE_DRIVER=local");

writeFileSync(envPath, env);
console.log("✓ Created .env with SQLite dev database + generated AUTH_SECRET.");
console.log("  Next: npm run db:generate && npm run db:push && npm run dev");
