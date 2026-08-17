import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { executeScheduledGanttDigestForTask } from "./gantt-digest-scheduler";

export async function scheduledGanttDigestHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    return res.json(await executeScheduledGanttDigestForTask(user.taskUid));
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      context: { url: req.originalUrl, taskUid: (req as any).user?.taskUid ?? null },
    });
  }
}
