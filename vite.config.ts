import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    // All /api requests go to RFP backend (auth, users, proposals, etc.)
    // Uses VITE_API_BASE_URL from client/.env when set; otherwise localhost:8000
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL?.trim() || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
