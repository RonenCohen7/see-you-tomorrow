import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@syt/shared/content/supportFaq": path.resolve(rootDir, "../server/shared/src/content/supportFaq.ts"),
    },
  },
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
