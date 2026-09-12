import type { RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { db } from "../db/neon";

export type AppRole = "candidate" | "recruiter";

function recruiterUserIds(): Set<string> {
  return new Set(
    (process.env.RECRUITER_USER_IDS ?? "")
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean),
  );
}

export async function getAppRole(userId: string): Promise<AppRole> {
  if (recruiterUserIds().has(userId)) return "recruiter";
  return (await db.isRecruiter(userId)) ? "recruiter" : "candidate";
}

async function authenticate(req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]): Promise<AppRole | null> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ success: false, error: "Unauthorized. Please sign in." });
    return null;
  }

  const role = await getAppRole(userId);
  res.locals.userId = userId;
  res.locals.role = role;
  return role;
}

/**
 * Middleware that enforces a valid Clerk session.
 * Attaches the authenticated userId to `res.locals.userId`.
 *
 * Mount this AFTER clerkMiddleware() in app.ts.
 * Apply it to any route that requires authentication.
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  void authenticate(req, res)
    .then((role) => {
      if (role) next();
    })
    .catch(next);
};

export const requireRecruiter: RequestHandler = (req, res, next) => {
  void authenticate(req, res)
    .then((role) => {
      if (!role) return;
      if (role !== "recruiter") {
        res.status(403).json({ success: false, error: "Recruiter access is required." });
        return;
      }
      next();
    })
    .catch(next);
};
