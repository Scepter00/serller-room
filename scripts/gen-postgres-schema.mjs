#!/usr/bin/env node
/**
 * Generate the PostgreSQL Prisma schema from the canonical SQLite schema.
 *
 * Prisma 6 removed env() in the provider, so Serller keeps two schema files:
 *   - prisma/schema.prisma          → SQLite (local dev + CI)
 *   - prisma/schema.postgres.prisma → PostgreSQL (production, generated)
 *
 * Run `npm run db:sync:prod` after any model change; commit the generated
 * file so production deploys never depend on a runtime generator step.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "prisma/schema.prisma";
const OUT = "prisma/schema.postgres.prisma";

const schema = readFileSync(SRC, "utf8");

const datasourceBlock = schema.match(/datasource db \{[\s\S]*?\n\}/);
if (!datasourceBlock) {
  console.error("✖ Could not locate the datasource block in", SRC);
  process.exit(1);
}

const postgresDatasource = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}`;

const header = `// GENERATED FILE — do not edit directly.
// Source of truth: prisma/schema.prisma (SQLite).
// Regenerate with: npm run db:sync:prod
// Production (PostgreSQL) schema for Serller.
`;

const out = header + "\n" + schema.replace(datasourceBlock[0], postgresDatasource);
writeFileSync(OUT, out);
console.log(`✓ Wrote ${OUT} (PostgreSQL)`);
