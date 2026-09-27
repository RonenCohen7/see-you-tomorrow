import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { SOCKET_EVENTS, getRequestTenantSlug, verifyAccessToken, logger } from "@syt/shared";

let io: Server | null = null;

function tenantRoom(kind: "user" | "admins" | "authenticated", userId?: string): string {
  const slug = getRequestTenantSlug();
  const prefix = slug ? `t:${slug}:` : "";
  if (kind === "user") return `${prefix}user:${userId}`;
  return `${prefix}${kind}`;
}

export function initSocket(httpServer: HttpServer) {
  const corsOrigin = process.env.CORS_ORIGIN?.split(",") ?? "*";
  io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
    path: "/socket.io",
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token as string | undefined;
      if (!token) throw new Error("missing token");
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      socket.data.tenant = payload.tenant;
      next();
    } catch (e) {
      logger.warn("socket auth failed", e);
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const uid = socket.data.userId as string;
    const role = socket.data.role as string;
    const tenant = typeof socket.data.tenant === "string" ? socket.data.tenant : "";
    const prefix = tenant ? `t:${tenant}:` : "";
    socket.join(`${prefix}authenticated`);
    socket.join(`${prefix}user:${uid}`);
    if (role === "admin") socket.join(`${prefix}admins`);
  });

  return io;
}

export function getIo(): Server {
  if (!io) throw new Error("socket not initialized");
  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  getIo().to(tenantRoom("user", userId)).emit(event, payload);
}

export function emitDashboardRefresh(userIds: string[]) {
  const s = getIo();
  for (const id of userIds) {
    s.to(tenantRoom("user", id)).emit(SOCKET_EVENTS.dashboardRefresh, { at: new Date().toISOString() });
  }
  s.to(tenantRoom("admins")).emit(SOCKET_EVENTS.dashboardRefresh, { at: new Date().toISOString() });
}

/** All JWT-authenticated sockets — for bulk schedule changes (e.g. purge future rows). */
export function emitAuthenticatedDashboardRefresh() {
  getIo().to(tenantRoom("authenticated")).emit(SOCKET_EVENTS.dashboardRefresh, { at: new Date().toISOString() });
}

export type SystemBroadcastPayload = {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
  at: string;
};

/** All sockets that passed JWT handshake (room `authenticated`). */
export function emitSystemBroadcast(payload: SystemBroadcastPayload) {
  getIo().to(tenantRoom("authenticated")).emit(SOCKET_EVENTS.systemBroadcast, payload);
}
