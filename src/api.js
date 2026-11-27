// Endpoints the UI calls (the /api prefix is stripped by the Vite proxy, which also routes
// each path to the service that owns it - see vite.config.js):
//   Order service     POST /orders                  body: { customerId, channel, productId, quantity, amount }
//                     GET  /orders/:id
//                     GET  /admin/orders            ?channel=&status=&page=&size=  -> { content, page, size, totalElements, totalPages }
//   Inventory service GET  /products                -> [{ productId, name, price, pointsPrice, available, reserved }]
//                     POST /admin/inventory/receive body: { productId, quantity, reference? }
//   Reward service    GET  /customers/:id           -> { customerId, name, rewardPoints }
// /admin/* calls send the admin key in the X-Api-Key header.
const BASE = import.meta.env.VITE_API_BASE || "/api";
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

async function http(path, options = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(`${BASE}${path}`, { ...rest, headers: { "Content-Type": "application/json", ...headers } });
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch { /* plain-text response */ }
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || (typeof data === "string" && data.slice(0, 200)) || "";
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data;
}

const asAdmin = (key) => ({ "X-Api-Key": key });

export const createOrder = (body) => http("/orders", { method: "POST", body: JSON.stringify(body) });
export const getOrder = (id) => http(`/orders/${encodeURIComponent(id)}`);
export const listProducts = () => http("/products");
export const getCustomer = (id) => http(`/customers/${encodeURIComponent(id)}`);

export function listAdminOrders({ channel, status, page = 0, size = 20 }, key) {
  const q = new URLSearchParams({ page, size });
  if (channel) q.set("channel", channel);
  if (status) q.set("status", status);
  return http(`/admin/orders?${q}`, { headers: asAdmin(key) });
}
export const receiveStock = (body, key) =>
  http("/admin/inventory/receive", { method: "POST", body: JSON.stringify(body), headers: asAdmin(key) });

// The create response may be JSON ({orderId|id}) or plain text; find the order id either way.
export function extractId(data) {
  if (data && typeof data === "object") {
    const direct = data.orderId || data.id || data.order_id || data.workflowId;
    if (direct) return String(direct);
  }
  const m = (typeof data === "string" ? data : JSON.stringify(data || "")).match(UUID);
  return m ? m[0] : "";
}
