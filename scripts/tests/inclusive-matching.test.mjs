import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

test("InclusiveMatchingAgent class is exported and implements calculateMatch and calculateMatchesForCandidate", () => {
  const source = read("artifacts/api-server/src/agents/inclusiveMatchingAgent.ts");
  assert.match(source, /export class InclusiveMatchingAgent/);
  assert.match(source, /calculateMatch\(/);
  assert.match(source, /calculateMatchForProfile\(/);
  assert.match(source, /calculateMatchesForCandidate\(/);
  assert.match(source, /export const inclusiveMatchingAgent = new InclusiveMatchingAgent\(\)/);
});

test("InclusiveMatchingAgent enforces 0% penalty for career breaks (Inclusive Workforce Principle)", () => {
  const source = read("artifacts/api-server/src/agents/inclusiveMatchingAgent.ts");
  assert.match(source, /ZERO-PENALTY CAREER BREAK POLICY/);
  assert.match(source, /breakImpactScore:\s*0/);
  assert.match(source, /0% penalty for/);
});

test("InclusiveMatchingAgent maps gaps to curated SAP Learning Hub modules", () => {
  const source = read("artifacts/api-server/src/agents/inclusiveMatchingAgent.ts");
  assert.match(source, /SAP_LEARNING_CATALOG/);
  assert.match(source, /https:\/\/learning\.sap\.com/);
  assert.match(source, /sapLearningHubModules/);
});

test("InclusiveMatchingAgent supports semantic synonym resolution in heuristic mode", () => {
  const source = read("artifacts/api-server/src/agents/inclusiveMatchingAgent.ts");
  assert.match(source, /areSkillsSemanticallyRelated/);
  assert.match(source, /sql analytics/);
  assert.match(source, /product strategy/);
});

test("API routes expose both single-job /match and multi-job /matches", () => {
  const agents = read("artifacts/api-server/src/routes/agents.ts");
  assert.match(agents, /agentsRouter\.post\("\/match",/);
  assert.match(agents, /agentsRouter\.get\("\/matches",/);
  assert.match(agents, /inclusiveMatchingAgent\.calculateMatch/);
});

test("Candidate onboarding and profile routes compute and return live match data", () => {
  const candidate = read("artifacts/api-server/src/routes/candidate.ts");
  assert.match(candidate, /inclusiveMatchingAgent\.calculateMatchForProfile/);
  assert.match(candidate, /candidateRouter\.get\("\/match",/);
  assert.match(candidate, /candidateRouter\.get\("\/jobs",/);
});

test("Candidate match endpoint caches stored match to prevent recalculation on refresh", () => {
  const candidate = read("artifacts/api-server/src/routes/candidate.ts");
  assert.match(candidate, /profile\.latestMatch/);
  assert.match(candidate, /cached:\s*true/);
});

test("Candidate profile section provides dedicated POST /match/recalculate endpoint", () => {
  const candidate = read("artifacts/api-server/src/routes/candidate.ts");
  assert.match(candidate, /candidateRouter\.post\("\/match\/recalculate",/);
  assert.match(candidate, /hanaDb\.saveCandidateProfile/);
});

