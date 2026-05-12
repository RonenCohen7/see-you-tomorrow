import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { SOCKET_EVENTS, verifyAccessToken, logger } from "@syt/shared";

let io: Server | null = null;

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
      next();
    } catch (e) {
      logger.warn("socket auth failed", e);
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const uid = socket.data.userId as string;
    const role = socket.data.role as string;
    socket.join("authenticated");
    socket.join(`user:${uid}`);
    if (role === "admin") socket.join("admins");
  });

  return io;
}

export function getIo(): Server {
  if (!io) throw new Error("socket not initialized");
  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  getIo().to(`user:${userId}`).emit(event, payload);
}

export function emitDashboardRefresh(userIds: string[]) {
  const s = getIo();
  for (const id of userIds) {
    s.to(`user:${id}`).emit(SOCKET_EVENTS.dashboardRefresh, { at: new Date().toISOString() });
  }
  s.to("admins").emit(SOCKET_EVENTS.dashboardRefresh, { at: new Date().toISOString() });
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
  getIo().to("authenticated").emit(SOCKET_EVENTS.systemBroadcast, payload);
}
