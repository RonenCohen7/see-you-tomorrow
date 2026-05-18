import type { Response } from "express";
import { AppError, SCHEDULING_RULE_TYPES, type AuthRequest } from "@syt/shared";
import { z } from "zod";
import * as proposals from "../services/schedulingRuleProposalService.js";

const proposalBody = z.object({
  ruleType: z.enum(SCHEDULING_RULE_TYPES),
  payload: z.record(z.unknown()),
  isActive: z.boolean().optional(),
  explanationHe: z.string().min(1),
  explanationEn: z.string().optional(),
  locations: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
});

const submitBody = proposalBody.extend({
  explanationHe: z.string().optional(),
});

export async function list(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const status = req.query.status as "pending" | "approved" | "rejected" | undefined;
  const items = await proposals.listProposals(status);
  res.json({ items });
}

export async function create(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = proposalBody.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const item = await proposals.createProposal({
    ...parsed.data,
    createdByUserId: req.user.id,
    locationNames: parsed.data.locations,
  });
  res.status(201).json(item);
}

export async function submit(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = submitBody.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const result = await proposals.submitRule({
    ruleType: parsed.data.ruleType,
    payload: parsed.data.payload,
    isActive: parsed.data.isActive,
    explanationHe: parsed.data.explanationHe,
    explanationEn: parsed.data.explanationEn,
    createdByUserId: req.user.id,
    locationNames: parsed.data.locations,
  });
  res.status(result.outcome === "created" ? 201 : 202).json(result);
}

export async function approve(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const result = await proposals.approveProposal(req.params.id, req.user.id);
  res.json(result);
}

export async function reject(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const item = await proposals.rejectProposal(req.params.id, req.user.id);
  res.json(item);
}
