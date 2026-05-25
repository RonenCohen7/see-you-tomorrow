import type { Request, Response } from "express";
import { revokeRefreshTokensForUser } from "../services/tokenRevokeService.js";

export async function revokeUserTokens(req: Request, res: Response) {
  const userId = req.params.userId;
  if (!userId?.trim()) {
    res.status(400).json({ error: "userId required", code: "BAD_REQUEST" });
    return;
  }
  const deleted = await revokeRefreshTokensForUser(userId);
  res.json({ ok: true, deleted });
}
