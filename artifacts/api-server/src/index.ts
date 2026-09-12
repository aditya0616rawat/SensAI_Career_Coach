import fs from "node:fs";
import path from "node:path";

// Auto-load .env file from root or working directory if present
const possibleEnvPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), "../.env")
];
for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch {}
  }
}

import app from "./app";
import { logger } from "./lib/logger";
import { neonDb } from "./db/neon";

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer() {
  // ── 1. Connect to Neon Serverless PostgreSQL (or fall back to in-memory) ───
  const connected = await neonDb.connect();

  if (connected) {
    // ── 2. Bootstrap schema — idempotent, safe to run on every deploy ────────
    await neonDb.bootstrapSchema();
    logger.info("Database mode: NEON_CONNECTED — data persisted to Neon Serverless PostgreSQL.");
  } else {
    logger.warn(
      "Database mode: IN_MEMORY — data will be lost on restart. " +
      "Set DATABASE_URL to enable Neon PostgreSQL persistence."
    );
  }

  // ── 3. Start HTTP server ───────────────────────────────────────────────────
  app.listen(port, (err?: any) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, `Server listening — status: ${neonDb.getStatus().mode}`);
  });
}

startServer().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});

