import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "../services/api";

export function useSocket(userId?: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId) {
      setSocket(null);
      setConnected(false);
      return;
    }
    const token = getAccessToken();
    if (!token) return;

    const s = io({
      path: "/socket.io",
      auth: { token },
      transports: ["websocket"],
    });
    setSocket(s);
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    return () => {
      s.close();
    };
  }, [userId]);

  return { socket, connected };
}
