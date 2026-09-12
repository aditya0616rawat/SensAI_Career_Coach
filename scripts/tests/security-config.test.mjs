import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

test("Neon PostgreSQL connections enforce SSL", () => {
  const source = read("artifacts/api-server/src/db/neon.ts");
  const dbSource = read("lib/db/src/index.ts");
  assert.match(source, /ssl:\s*\{\s*rejectUnauthorized:\s*false\s*\}/);
  assert.match(dbSource, /ssl:\s*\{\s*rejectUnauthorized:\s*false\s*\}/);
});

test("Neon PostgreSQL schema bootstrap uses standard idempotent DDL", () => {
  const dbSource = read("lib/db/src/index.ts");
  assert.match(dbSource, /CREATE TABLE IF NOT EXISTS candidates/);
  assert.match(dbSource, /CREATE TABLE IF NOT EXISTS jobs/);
  assert.match(dbSource, /CREATE TABLE IF NOT EXISTS recruiter_access/);
});

test("agent routes are authenticated and rate limited", () => {
  const source = read("artifacts/api-server/src/routes/agents.ts");
  assert.match(source, /agentsRouter\.use\(requireAuth\)/);
  assert.match(source, /agentsRouter\.use\(rateLimit/);
  assert.match(source, /requireRecruiter/);
});

test("sensitive API routes enforce a server-side role and rate limit", () => {
  const candidate = read("artifacts/api-server/src/routes/candidate.ts");
  const recruiter = read("artifacts/api-server/src/routes/recruiter.ts");
  assert.match(candidate, /candidateRouter\.use\(rateLimit/);
  assert.match(recruiter, /recruiterRouter\.use\(requireRecruiter\)/);
  assert.match(read("artifacts/api-server/src/routes/health.ts"), /router\.get\("\/db-status", requireRecruiter/);
});

test("authenticated users can self-enroll for the recruiter workspace", () => {
  const authRoutes = read("artifacts/api-server/src/routes/auth.ts");
  const database = read("artifacts/api-server/src/db/neon.ts");

  assert.match(authRoutes, /authRouter\.post\("\/enroll", requireAuth/);
  assert.match(authRoutes, /grantRecruiterAccess\(res\.locals\.userId\)/);
  assert.match(database, /recruiter_access/);
  assert.match(database, /async isRecruiter\(userId: string\)/);
});

test("API source contains no embedded service credentials", () => {
  const source = [
    read("artifacts/api-server/src/routes/candidate.ts"),
    read("artifacts/api-server/src/agents/skillsDiscoveryAgent.ts"),
    read("artifacts/api-server/src/agents/jouleCareerAgent.ts"),
    read("artifacts/api-server/src/db/neon.ts"),
    read("artifacts/api-server/src/db/hana.ts"),
  ].join("\n");

  assert.doesNotMatch(source, /gsk_[A-Za-z0-9]{20,}/);
  assert.doesNotMatch(source, /sk_(?:test|live)_[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(source, /password\s*[:=]\s*["'][^"']{5,}["']/i);
});

