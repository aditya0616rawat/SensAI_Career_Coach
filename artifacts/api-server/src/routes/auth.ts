import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { db } from "../db/neon";
import { sendInternalError } from "../lib/http";

const authRouter = Router();

authRouter.get("/me", requireAuth, (_req, res) => {
  res.json({ success: true, userId: res.locals.userId, role: res.locals.role });
});

authRouter.post("/enroll", requireAuth, async (req, res) => {
  try {
    if (req.body?.role !== "recruiter") {
      return res.status(400).json({ success: false, error: "Only recruiter self-enrollment is supported." });
    }

    await db.grantRecruiterAccess(res.locals.userId);
    return res.status(201).json({ success: true, role: "recruiter" });
  } catch (error) {
    return sendInternalError(res, error, "Recruiter enrollment failed");
  }
});

export default authRouter;
