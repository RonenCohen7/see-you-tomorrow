import type { Role } from "./roles.js";

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  /** Company slug. Present when the token was issued for a tenant database. */
  tenant?: string;
  iat?: number;
  exp?: number;
}
