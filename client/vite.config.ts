import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    /** Required for ngrok / LAN — `npm run dev -- --host` does not reach Vite (goes to concurrently). */
    host: true,
    // Dev tunnels (ngrok, etc.): otherwise Vite returns "Blocked request" for Host header.
    allowedHosts: [
      ".localhost",
      ".ngrok-free.dev",
      ".ngrok-free.app",
      ".ngrok.io",
    ],
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/health": { target: "http://localhost:4000", changeOrigin: true },
      "/socket.io": { target: "http://localhost:4000", changeOrigin: true, ws: true },
    },
  },
});
