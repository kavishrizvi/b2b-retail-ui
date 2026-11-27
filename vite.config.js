import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The browser calls /api/<path>; the /api prefix is stripped and the call goes to the service that owns <path>.
//   Order service      8080  /orders, /admin/orders
//   Inventory service  8081  /products, /admin/inventory/...
//   Reward service     8082  /customers
const orders = process.env.OMS_URL || "http://localhost:8080";
const inventory = process.env.INVENTORY_URL || "http://localhost:8081";
const rewards = process.env.REWARD_URL || "http://localhost:8082";

const to = (target) => ({ target, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") });

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Specific prefixes first; the catch-all "/api" (order service) must stay last.
    proxy: {
      "/api/products": to(inventory),
      "/api/admin/inventory": to(inventory),
      "/api/customers": to(rewards),
      "/api": to(orders),
    },
  },
});
