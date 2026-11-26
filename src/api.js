// The two calls the UI makes:
//   POST /orders      body: { productId, quantity, amount }
//   GET  /orders/:id
const BASE = import.meta.env.VITE_API_BASE || "/api";
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

async function http(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json" }, ...options });
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch { /* plain-text response */ }
  if (!res.ok) {
    const msg = (data && data.message) || (typeof data === "string" && data.slice(0, 200)) || "";
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data;
}

export const createOrder = (body) => http("/orders", { method: "POST", body: JSON.stringify(body) });
export const getOrder = (id) => http(`/orders/${encodeURIComponent(id)}`);

// The create response may be JSON ({orderId|id}) or plain text; find the order id either way.
export function extractId(data) {
  if (data && typeof data === "object") {
    const direct = data.orderId || data.id || data.order_id || data.workflowId;
    if (direct) return String(direct);
  }
  const m = (typeof data === "string" ? data : JSON.stringify(data || "")).match(UUID);
  return m ? m[0] : "";
}