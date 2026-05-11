import type { Request, Response } from "express";
import * as svc from "../services/locationService.js";

export async function getOne(req: Request, res: Response) {
  try {
    const item = await svc.getById(req.params.id);
    res.json(item);
  } catch {
    res.status(404).json({ error: "לא נמצא" });
  }
}
