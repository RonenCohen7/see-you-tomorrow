import jwt, { type SignOptions } from "jsonwebtoken";
import type { JwtPayload } from "../types/jwt.js";
import type { Role } from "../types/roles.js";

export function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is required");
  return s;
}

export function signAccessToken(payload: Pick<JwtPayload, "sub" | "email" | "role">): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? "15m") as NonNullable<SignOptions["expiresIn"]>;
  return jwt.sign(payload, getJwtSecret(), { expiresIn });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload;
}

export function signRefreshToken(userId: string, role: Role, email: string): string {
  const expiresIn = (process.env.JWT_REFRESH_EXPIRES_IN ?? "7d") as NonNullable<SignOptions["expiresIn"]>;
  return jwt.sign({ sub: userId, role, email, typ: "refresh" }, getJwtSecret(), { expiresIn });
}
