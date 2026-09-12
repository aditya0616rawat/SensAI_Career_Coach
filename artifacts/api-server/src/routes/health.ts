import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

import { db } from "../db/neon";
import { requireRecruiter } from "../middlewares/requireAuth";

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/db-status", requireRecruiter, (_req, res) => {
  res.json(db.getStatus());
});

export default router;
