import { Router } from "express";
import { db } from "../db/neon";
import { sendInternalError } from "../lib/http";
import { requireRecruiter } from "../middlewares/requireAuth";

const recruiterRouter = Router();

recruiterRouter.use(requireRecruiter);

recruiterRouter.get("/jobs", async (_req, res) => {
  try {
    return res.json({ success: true, jobs: await db.getJobs() });
  } catch (error) {
    return sendInternalError(res, error, "Recruiter job lookup failed");
  }
});

recruiterRouter.post("/jobs", async (req, res) => {
  try {
    const { title, company, location, mode, salary, skills, description } = req.body;
    if (typeof title !== "string" || title.trim().length === 0 || title.length > 256) {
      return res.status(400).json({ success: false, error: "title must be a non-empty string up to 256 characters." });
    }

    const job = await db.createJob({
      title: title.trim(),
      company: typeof company === "string" ? company.trim().slice(0, 256) : "",
      location: typeof location === "string" ? location.trim().slice(0, 256) : "",
      mode: typeof mode === "string" ? mode.trim().slice(0, 64) : "",
      salary: typeof salary === "string" ? salary.trim().slice(0, 128) : "",
      skills: Array.isArray(skills)
        ? skills.filter((skill): skill is string => typeof skill === "string").map((skill) => skill.trim()).filter(Boolean).slice(0, 25)
        : [],
      description: typeof description === "string" ? description.trim().slice(0, 10_000) : "",
      createdBy: res.locals.userId,
    });

    return res.status(201).json({ success: true, job });
  } catch (error) {
    return sendInternalError(res, error, "Recruiter job creation failed");
  }
});

recruiterRouter.get("/candidates", async (_req, res) => {
  try {
    const candidates = await db.getCandidates();
    return res.json({ success: true, candidates });
  } catch (error) {
    return sendInternalError(res, error, "Recruiter candidate lookup failed");
  }
});

export default recruiterRouter;
