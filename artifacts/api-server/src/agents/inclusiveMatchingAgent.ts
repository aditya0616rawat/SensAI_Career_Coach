import { JobMatchResponse } from "./types";
import { db } from "../db/neon";

/**
 * Parses and cleans LLM JSON responses.
 */
function cleanAndParseJSON(raw: string): any {
  if (!raw || typeof raw !== "string") return null;

  // Remove <think>...</think> reasoning blocks from DeepSeek / reasoning models
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Remove markdown code fences e.g. ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Find outermost { ... }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      const fixed = cleaned.replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

/**
 * Curated mapping of skill/domain competencies to real public learning courses.
 */
const LEARNING_CATALOG: Record<
  string,
  { title: string; courseUrl: string; competency: string; hours: number }
> = {
  sql: {
    title: "SQL for Data Analysis — Intermediate SQL Querying",
    courseUrl: "https://www.coursera.org/learn/sql-for-data-science",
    competency: "SQL & Relational Data Architecture",
    hours: 5,
  },
  "sql analytics": {
    title: "Advanced SQL for Analytics & Business Intelligence",
    courseUrl: "https://www.linkedin.com/learning/advanced-sql-for-data-scientists",
    competency: "SQL Analytics & Data Insights",
    hours: 6,
  },
  "program strategy": {
    title: "Product Management & Agile Strategy",
    courseUrl: "https://www.coursera.org/learn/uva-darden-agile-development",
    competency: "Product Strategy & Agile Execution",
    hours: 6,
  },
  "stakeholder alignment": {
    title: "Stakeholder Management & Communication for Leaders",
    courseUrl: "https://www.linkedin.com/learning/stakeholder-management",
    competency: "Stakeholder Alignment & Change Management",
    hours: 4,
  },
  "agile execution": {
    title: "Agile Project Management & Scrum",
    courseUrl: "https://www.coursera.org/learn/agile-development",
    competency: "Agile & Sprint Governance",
    hours: 5,
  },
  python: {
    title: "Python for Data Science, AI & Development",
    courseUrl: "https://www.coursera.org/learn/python-for-applied-data-science-ai",
    competency: "Python for AI & Data Science",
    hours: 7,
  },
  "machine learning": {
    title: "Machine Learning Specialization",
    courseUrl: "https://www.coursera.org/specializations/machine-learning-introduction",
    competency: "Enterprise Machine Learning & GenAI",
    hours: 8,
  },
  analytics: {
    title: "Data Analytics & Visualization Fundamentals",
    courseUrl: "https://www.coursera.org/learn/foundations-of-data",
    competency: "Enterprise Analytics & Visualization",
    hours: 6,
  },
  "change management": {
    title: "Organizational Change Management",
    courseUrl: "https://www.linkedin.com/learning/change-management-foundations",
    competency: "Change Management & Org Readiness",
    hours: 5,
  },
};


/**
 * Normalizes an array of skills or skill objects into clean lowercase strings.
 */
function normalizeSkillStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim().toLowerCase();
      if (typeof item === "object" && item && "name" in item && typeof (item as any).name === "string") {
        return (item as any).name.trim().toLowerCase();
      }
      return "";
    })
    .filter(Boolean);
}

/**
 * Extracts candidate skills from candidate profile (direct skills or extractedSkills).
 */
function extractCandidateSkills(candidate: Record<string, unknown>): string[] {
  const direct = normalizeSkillStrings(candidate.skills);
  const extracted = normalizeSkillStrings(candidate.extractedSkills);
  const set = new Set([...direct, ...extracted]);
  return Array.from(set);
}

/**
 * Synonym and token overlap evaluation for resilient semantic heuristic matching.
 */
function areSkillsSemanticallyRelated(candidateSkill: string, jobSkill: string): boolean {
  if (candidateSkill === jobSkill) return true;
  if (candidateSkill.includes(jobSkill) || jobSkill.includes(candidateSkill)) return true;

  const synonyms: Record<string, string[]> = {
    sql: ["database", "postgres", "postgresql", "mysql", "data modeling", "sql analytics", "rdbms"],
    "sql analytics": ["sql", "database", "analytics", "power bi", "data analysis", "postgres"],
    "product strategy": ["program strategy", "product management", "roadmaps", "strategy", "okrs"],
    "program strategy": ["product strategy", "program management", "roadmaps", "project delivery"],
    "agile execution": ["agile", "scrum", "sprints", "kanban", "agile delivery"],
    "cross-functional alignment": ["stakeholder alignment", "collaboration", "cross-functional", "leadership"],
    "stakeholder alignment": ["cross-functional alignment", "stakeholder management", "change management"],
    python: ["django", "fastapi", "flask", "data science", "machine learning"],
    "react.js": ["react", "frontend", "next.js", "javascript", "typescript"],
  };

  for (const [key, synList] of Object.entries(synonyms)) {
    const matchesKey = candidateSkill.includes(key) || jobSkill.includes(key);
    if (matchesKey) {
      if (synList.some((syn) => candidateSkill.includes(syn) || jobSkill.includes(syn))) {
        return true;
      }
    }
  }

  // Token word boundary overlap
  const candTokens = candidateSkill.split(/[\s,/-]+/).filter((t) => t.length > 2);
  const jobTokens = jobSkill.split(/[\s,/-]+/).filter((t) => t.length > 2);
  const shared = candTokens.filter((t) => jobTokens.includes(t));
  return shared.length > 0 && shared.some((t) => !["and", "for", "the", "with"].includes(t));
}

/**
 * Resolves a gap to an appropriate learning course module.
 */
function resolveLearningModule(gap: string, weekIndex: number) {
  const normalizedGap = gap.toLowerCase().trim();
  for (const [key, info] of Object.entries(LEARNING_CATALOG)) {
    if (normalizedGap.includes(key) || key.includes(normalizedGap)) {
      return {
        week: weekIndex + 1,
        title: info.title,
        courseUrl: info.courseUrl,
        competencyGained: info.competency,
        hoursRequired: info.hours,
      };
    }
  }

  // General fallback module
  const capitalised = gap.charAt(0).toUpperCase() + gap.slice(1);
  return {
    week: weekIndex + 1,
    title: `${capitalised} — Fundamentals & Practice`,
    courseUrl: "https://www.coursera.org",
    competencyGained: capitalised,
    hoursRequired: 5,
  };
}

/**
 * High-precision heuristic fallback engine.
 * Computes match objectively, actively discounts career breaks (0% penalty),
 * and generates transparent rationale.
 */
function runHeuristicMatch(
  candidate: Record<string, unknown>,
  job: Record<string, unknown>
): JobMatchResponse {
  const rawJobSkills = normalizeSkillStrings(job.skills);
  const candidateSkills = extractCandidateSkills(candidate);

  const matchedSkills: string[] = [];
  const gapSkills: string[] = [];

  for (const reqSkill of rawJobSkills) {
    const found = candidateSkills.find((candSkill) =>
      areSkillsSemanticallyRelated(candSkill, reqSkill)
    );
    if (found) {
      matchedSkills.push(reqSkill);
    } else {
      gapSkills.push(reqSkill);
    }
  }

  const skillAlignmentScore =
    rawJobSkills.length === 0
      ? 80
      : Math.round((matchedSkills.length / rawJobSkills.length) * 100);

  // Evidence scoring based on projects, work history, and education
  const projects = Array.isArray(candidate.projects) ? candidate.projects : [];
  const experience = Array.isArray(candidate.experience) ? candidate.experience : [];
  const education = Array.isArray(candidate.education) ? candidate.education : [];
  const certifications = Array.isArray(candidate.certifications) ? candidate.certifications : [];

  const evidenceItemCount =
    projects.length + experience.length + education.length + certifications.length;
  const evidenceScore = Math.min(100, Math.max(50, evidenceItemCount * 18));

  // Weighted overall fit score: 75% skill alignment + 25% demonstrable project evidence
  const overallFitScore = Math.min(
    96,
    Math.max(65, Math.round(skillAlignmentScore * 0.75 + evidenceScore * 0.25))
  );

  // Zero-penalty gap discount
  const breakYears = Number(candidate.careerBreakYears || 0);
  const breakExplanation =
    breakYears > 0
      ? `Evaluated with 0% penalty for ${breakYears}-year career break (${candidate.breakContext || "Personal/Family care"}). Fit score is derived 100% from demonstrated capabilities and project outcomes.`
      : "Evaluated with 100% objective skills-first methodology.";

  const threeWeekBoostProjected = Math.min(
    96,
    overallFitScore + Math.min(15, Math.max(5, gapSkills.length * 4))
  );

  // Curate 3-week learning pathway
  const modulesToMap = gapSkills.length > 0 ? gapSkills.slice(0, 3) : ["Enterprise Cloud Architecture"];
  const learningModules = modulesToMap.map((gap, idx) =>
    resolveLearningModule(gap, idx)
  );

  const jobTitle = typeof job.title === "string" ? job.title : "Target Role";
  const company = typeof job.company === "string" ? job.company : "Enterprise Employer";

  const matchingStrengths =
    matchedSkills.length > 0
      ? matchedSkills.map((s) => `Demonstrated competency in ${s}`)
      : candidateSkills.slice(0, 3).map((s) => `Transferable baseline capability in ${s}`);

  const evidenceHighlights = projects.slice(0, 2).map((p: any) => {
    const title = p.title || "Applied project";
    const stack = Array.isArray(p.techStack) ? ` using ${p.techStack.join(", ")}` : "";
    return `Verified capability demonstrated in "${title}"${stack}.`;
  });

  return {
    jobId: Number(job.id || 1),
    jobTitle,
    company,
    overallFitScore,
    skillAlignmentScore,
    breakImpactScore: 0,
    breakNeutralityExplanation: breakExplanation,
    matchSummary: `Strong alignment for ${jobTitle} at ${company}. Candidate brings verified capabilities in ${matchedSkills.slice(0, 3).join(", ") || "core technical execution"} with demonstrable project experience.`,
    matchingStrengths,
    transferableStrengths: candidateSkills.slice(0, 4),
    evidenceHighlights: evidenceHighlights.length > 0 ? evidenceHighlights : ["Demonstrated self-directed technical execution and continuous learning."],
    skillGaps: gapSkills.length > 0 ? gapSkills : ["No critical skill gaps identified."],
    threeWeekBoostProjected,
    learningModules,
  };
}

export class InclusiveMatchingAgent {
  /**
   * Inclusive Matching Agent
   * Matches candidate capability to job requirements based on verified skills,
   * non-traditional evidence, and transferable capabilities.
   *
   * Actively discounts career break duration (0% penalty) and institution prestige.
   */
  async calculateMatch(
    candidateId: string,
    jobId: number,
    apiKey?: string
  ): Promise<JobMatchResponse> {
    const [candidate, job] = await Promise.all([
      db.getCandidateProfile(candidateId),
      db.getJob(jobId),
    ]);

    if (!candidate) {
      throw new Error(`Candidate profile for ID "${candidateId}" was not found.`);
    }
    if (!job) {
      throw new Error(`Job requisition with ID "${jobId}" was not found.`);
    }

    return this.calculateMatchForProfile(candidate, job, apiKey);
  }

  /**
   * Evaluates a candidate profile against a job specification.
   * Uses Groq / Gemini LLM reasoning when API key is available, with graceful heuristic fallback.
   */
  async calculateMatchForProfile(
    candidate: Record<string, unknown>,
    job: Record<string, unknown>,
    apiKey?: string
  ): Promise<JobMatchResponse> {
    const groqKey = apiKey || process.env.GROQ_API_KEY;

    if (groqKey) {
      try {
        const candidateSkills = extractCandidateSkills(candidate);
        const candidateProjects = Array.isArray(candidate.projects) ? candidate.projects : [];
        const candidateExperience = Array.isArray(candidate.experience) ? candidate.experience : [];
        const candidateEducation = Array.isArray(candidate.education) ? candidate.education : [];
        const breakYears = Number(candidate.careerBreakYears || 0);
        const breakContext = typeof candidate.breakContext === "string" ? candidate.breakContext : "";

        const prompt = `You are the Inclusive Matching Agent on SensAI Career Coach.
Your role is to evaluate candidate capability against job requisitions based on verified skills, transferable competencies, and demonstrated project evidence.

CRITICAL INCLUSIVE MATCHING PRINCIPLES:
1. ZERO-PENALTY CAREER BREAK POLICY: Career breaks (for caregiving, family, health, relocation, or learning) MUST receive 0% penalty. Never down-score a candidate for chronological gaps.
2. CAPABILITY OVER CREDENTIALS: Focus strictly on demonstrable skills, applied projects, code artifacts, and problem-solving. Disregard university prestige or brand-name past employers.
3. TRANSFERABLE SKILL RECOGNITION: Actively recognize synonymous, adjacent, and transferable technical capabilities (e.g. SQL and relational databases; Scrum and agile delivery; frontend state and UI design).
4. PRESCRIBE 3-WEEK BRIDGE: For any identified gaps, prescribe a realistic 3-week learning pathway with course modules (from Coursera, LinkedIn Learning, or similar platforms) so the candidate can elevate their readiness.

==================================================
CANDIDATE CAPABILITY PROFILE:
- Name: ${candidate.name || candidate.candidateName || "Candidate"}
- Target Role: ${candidate.targetRole || "Software Engineer"}
${Number(breakYears) > 0 ? `- Career Break: ${breakYears} years (${breakContext || "Caregiving / Personal break"})` : "- Career Status: Continuous progression / No career break"}
- Verified Skills: ${candidateSkills.join(", ") || "None listed"}
- Key Projects: ${candidateProjects.map((p: any) => `${p.title} [${Array.isArray(p.techStack) ? p.techStack.join(", ") : ""}] - ${p.description || ""}`).join("; ") || "Self-directed work"}
- Past Experience: ${candidateExperience.map((e: any) => `${e.role} at ${e.company} (${e.duration})`).join("; ") || "Non-traditional / Project-based"}
- Education: ${candidateEducation.map((ed: any) => `${ed.degree} from ${ed.institution}`).join("; ") || "Relevant foundational study"}

==================================================
JOB REQUISITION:
- Job Title: ${job.title || "Untitled Role"}
- Company: ${job.company || "Enterprise Employer"}
- Location & Mode: ${job.location || "Hybrid"} · ${job.mode || "Hybrid"}
- Required Skills: ${Array.isArray(job.skills) ? job.skills.join(", ") : ""}
- Role Description: ${job.description || ""}

==================================================
INSTRUCTIONS:
Return a valid JSON object ONLY. Adhere strictly to this schema:
{
  "overallFitScore": number (between 70 and 96, reflecting real alignment based on skills and projects),
  "skillAlignmentScore": number (percentage of required capabilities covered or transferable),
  "breakImpactScore": 0,
  "breakNeutralityExplanation": ${Number(breakYears) > 0 ? `"string (explicit statement detailing that the ${breakYears}-year career break had zero negative weight in scoring)"` : `""`},
  "matchSummary": "string (2-3 concise sentences detailing why this candidate is a strong fit based on their projects and verified skills)",
  "matchingStrengths": ["string", "string", "string"],
  "transferableStrengths": ["string", "string"],
  "evidenceHighlights": ["string citing specific project or experience evidence"],
  "skillGaps": ["string", "string"],
  "threeWeekBoostProjected": number (projected fit score after completing the 3-week bridge, e.g. 91-96),
  "learningModules": [
    {
      "week": 1,
      "title": "string (Specific course title, e.g. from Coursera or LinkedIn Learning)",
      "courseUrl": "https://www.coursera.org",
      "competencyGained": "string",
      "hoursRequired": number (between 4 and 8)
    },
    {
      "week": 2,
      "title": "string",
      "courseUrl": "https://www.coursera.org",
      "competencyGained": "string",
      "hoursRequired": number
    },
    {
      "week": 3,
      "title": "string",
      "courseUrl": "https://www.coursera.org",
      "competencyGained": "string",
      "hoursRequired": number
    }
  ]
}`;

        const modelsToTry = [
          "openai/gpt-oss-120b",
          "qwen/qwen3.6-27b",
          "openai/gpt-oss-20b",
          "llama-3.3-70b-versatile",
          "llama-3.1-8b-instant",
        ];

        for (const model of modelsToTry) {
          try {
            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${groqKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
                temperature: 0.2,
                max_tokens: 1200,
              }),
            });

            if (res.ok) {
              const data = (await res.json()) as any;
              const text = data.choices?.[0]?.message?.content;
              if (text) {
                const parsed = cleanAndParseJSON(text);
                if (parsed && typeof parsed.overallFitScore === "number") {
                  return {
                    jobId: Number(job.id || 1),
                    jobTitle: typeof job.title === "string" ? job.title : "Target Role",
                    company: typeof job.company === "string" ? job.company : "Enterprise Employer",
                    overallFitScore: Math.min(100, Math.max(0, parsed.overallFitScore)),
                    skillAlignmentScore: Math.min(100, Math.max(0, parsed.skillAlignmentScore || 80)),
                    breakImpactScore: 0,
                    breakNeutralityExplanation:
                      Number(breakYears) > 0
                        ? (parsed.breakNeutralityExplanation || `Evaluated with 0% penalty for ${breakYears}-year career break.`)
                        : "",
                    matchSummary: parsed.matchSummary || "",
                    matchingStrengths: Array.isArray(parsed.matchingStrengths)
                      ? parsed.matchingStrengths
                      : ["Verified capability alignment"],
                    transferableStrengths: Array.isArray(parsed.transferableStrengths)
                      ? parsed.transferableStrengths
                      : [],
                    evidenceHighlights: Array.isArray(parsed.evidenceHighlights)
                      ? parsed.evidenceHighlights
                      : [],
                    skillGaps: Array.isArray(parsed.skillGaps)
                      ? parsed.skillGaps
                      : ["Continuous learning path"],
                    threeWeekBoostProjected: Math.min(
                      100,
                      Math.max(parsed.overallFitScore, parsed.threeWeekBoostProjected || 92)
                    ),
                    learningModules: Array.isArray(parsed.learningModules) &&
                    parsed.learningModules.length > 0
                      ? parsed.learningModules
                      : [
                          resolveLearningModule("SQL", 0),
                          resolveLearningModule("Stakeholder Alignment", 1),
                          resolveLearningModule("Agile Execution", 2),
                        ],
                  };
                }
              }
            }
          } catch (modelErr) {
            console.warn(`Groq model ${model} matching attempt failed:`, modelErr);
          }
        }
      } catch (err) {
        console.warn("LLM Inclusive Matching failed, falling back to heuristic engine:", err);
      }
    }

    // High-precision fallback when LLM is offline or no API key is provided
    return runHeuristicMatch(candidate, job);
  }

  /**
   * Matches candidate capability against all active jobs in the database.
   */
  async calculateMatchesForCandidate(
    candidateId: string,
    apiKey?: string
  ): Promise<JobMatchResponse[]> {
    const [candidate, allJobs] = await Promise.all([
      db.getCandidateProfile(candidateId),
      db.getJobs(),
    ]);

    if (!candidate) {
      throw new Error(`Candidate profile for ID "${candidateId}" was not found.`);
    }

    const jobs = Array.isArray(allJobs) && allJobs.length > 0 ? allJobs : [];
    const matchPromises = jobs.map((job) =>
      this.calculateMatchForProfile(candidate, job, apiKey)
    );

    const matches = await Promise.all(matchPromises);
    return matches.sort((a, b) => b.overallFitScore - a.overallFitScore);
  }
}

export const inclusiveMatchingAgent = new InclusiveMatchingAgent();
