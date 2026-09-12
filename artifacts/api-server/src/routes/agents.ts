import { Router } from "express";
import { skillsDiscoveryAgent } from "../agents/skillsDiscoveryAgent";
import { inclusiveMatchingAgent } from "../agents/inclusiveMatchingAgent";
import { biasAuditAgent } from "../agents/biasAuditAgent";
import { careerCoachAgent } from "../agents/jouleCareerAgent";
import { hanaDb } from "../db/hana";
import { sendInternalError } from "../lib/http";
import { rateLimit } from "../middlewares/rateLimit";
import { requireAuth, requireRecruiter } from "../middlewares/requireAuth";

export const agentsRouter = Router();

agentsRouter.use(requireAuth);
agentsRouter.use(rateLimit({ max: 30, windowMs: 15 * 60 * 1000 }));

function textInput(value: unknown, maxLength = 60_000): string | null {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    return null;
  }
  return value.trim();
}

// 1. Skills Discovery Agent Endpoint
agentsRouter.post("/extract-skills", async (req, res) => {
  try {
    const text = textInput(req.body.text);
    if (!text) return res.status(400).json({ success: false, error: "text must be a non-empty string up to 60,000 characters." });
    const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
    const result = await skillsDiscoveryAgent.extractSkills(text, apiKey);
    return res.json({ success: true, data: result, framework: "Skills Discovery Agent" });
  } catch (error) {
    return sendInternalError(res, error, "Skills extraction failed");
  }
});

// 2. Inclusive Matching Agent Endpoints
agentsRouter.post("/match", async (req, res) => {
  try {
    const jobId = Number(req.body.jobId || 1);
    if (!Number.isInteger(jobId) || jobId < 1) {
      return res.status(400).json({ success: false, error: "jobId must be a positive integer." });
    }

    const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
    const clientProfile = req.body.profile;

    let result;
    if (clientProfile && typeof clientProfile === "object") {
      const job = await hanaDb.getJob(jobId);
      if (!job) return res.status(404).json({ success: false, error: "Job requisition not found." });
      result = await inclusiveMatchingAgent.calculateMatchForProfile(clientProfile, job, apiKey);
    } else {
      result = await inclusiveMatchingAgent.calculateMatch(res.locals.userId, jobId, apiKey);
    }

    return res.json({ success: true, data: result, framework: "Inclusive Matching Agent" });
  } catch (error) {
    return sendInternalError(res, error, "Candidate matching failed");
  }
});

agentsRouter.get("/matches", async (_req, res) => {
  try {
    const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
    const matches = await inclusiveMatchingAgent.calculateMatchesForCandidate(res.locals.userId, apiKey);
    return res.json({ success: true, data: matches, framework: "Inclusive Matching Agent" });
  } catch (error) {
    return sendInternalError(res, error, "Candidate multi-job matching failed");
  }
});

// 3. Bias Audit Agent Endpoint
agentsRouter.get("/bias-audit", requireRecruiter, async (_req, res) => {
  try {
    const result = await biasAuditAgent.runAudit();
    return res.json({ success: true, data: result, framework: "Bias Audit & Governance Agent" });
  } catch (error) {
    return sendInternalError(res, error, "Bias audit failed");
  }
});

// 4. AI Career Coach Endpoint (Fully Grounded in DB Candidate Profile)
agentsRouter.post("/chat", async (req, res) => {
  try {
    const message = textInput(req.body.message, 12_000);
    if (!message) return res.status(400).json({ success: false, error: "message must be a non-empty string up to 12,000 characters." });
    const { history, profile } = req.body;
    const authenticatedUserId = res.locals.userId as string;

    // Actively query the database for the candidate's real profile
    let dbProfile: any = null;
    if (authenticatedUserId) {
      try {
        dbProfile = await hanaDb.getCandidateProfile(authenticatedUserId);
      } catch (err) {
        console.warn("Could not query DB for candidate profile:", err);
      }
    }

    // Merge: client-supplied context with saved DB profile
    const mergedProfile = {
      ...(dbProfile || {}),
      ...(profile || {}),
      name: profile?.name || dbProfile?.name || dbProfile?.candidateName || "",
      targetRole: profile?.targetRole || dbProfile?.targetRole || dbProfile?.title || "",
      targetCompany: profile?.targetCompany || dbProfile?.targetCompany || "",
      location: profile?.location || dbProfile?.location || "",
      skills: (Array.isArray(profile?.skills) && profile.skills.length > 0)
        ? profile.skills
        : (Array.isArray(dbProfile?.skills) ? dbProfile.skills.map((s: any) => typeof s === 'string' ? s : s.name) : []),
      projects: (Array.isArray(profile?.projects) && profile.projects.length > 0)
        ? profile.projects
        : (dbProfile?.projects || []),
      education: (Array.isArray(profile?.education) && profile.education.length > 0)
        ? profile.education
        : (dbProfile?.education || []),
      experience: (Array.isArray(profile?.experience) && profile.experience.length > 0)
        ? profile.experience
        : (dbProfile?.experience || []),
      fit: profile?.fit ?? dbProfile?.fit ?? 85,
      readinessRating: profile?.readinessRating ?? dbProfile?.readinessRating ?? 88,
    };

    const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
    const reply = await careerCoachAgent.chat(message, Array.isArray(history) ? history.slice(-10) : [], mergedProfile, apiKey);
    return res.json({ success: true, reply, agent: "SensAI Career Coach", profile: mergedProfile });
  } catch (error) {
    return sendInternalError(res, error, "Career assistant request failed");
  }
});
