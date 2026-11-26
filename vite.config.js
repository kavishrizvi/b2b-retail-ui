import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Browser calls /api/orders -> proxied to http://localhost:8080/orders (the /api prefix is stripped).
const target = process.env.OMS_URL || "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") } },
  },
});