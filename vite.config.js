import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev proxy: browser calls /api/* -> your OMS service (avoids CORS in development).
const target = process.env.OMS_URL || "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": { target, changeOrigin: true } } },
});
