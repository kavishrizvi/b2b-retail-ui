// All backend knowledge lives in this file. If your OMS endpoints or payloads
// differ from the assumptions below, change them here only.
//
// Assumed contract:
//   GET  /orders              -> Order[]
//   GET  /orders/:id          -> Order (with `events`: the workflow history)
//   POST /orders              -> Order   body: { customerName, lines:[{sku,qty,unitPrice}] }
//   POST /orders/:id/approve  -> Order
//   POST /orders/:id/cancel   -> Order   body: { reason }

const BASE = import.meta.env.VITE_API_BASE || "/api";
const MOCK = import.meta.env.VITE_USE_MOCK === "true";

export const STATUSES = [
  "CREATED", "INVENTORY_RESERVED", "PAYMENT_PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED", "FAILED",
];
export const STATUS_LABEL = {
  CREATED: "Received", INVENTORY_RESERVED: "Stock reserved", PAYMENT_PENDING: "Awaiting payment",
  PAID: "Paid", SHIPPED: "Shipped", DELIVERED: "Delivered", CANCELLED: "Cancelled", FAILED: "Failed",
};

async function http(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).message || ""; } catch { /* body not JSON */ }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

/* ---------- in-memory sample data for VITE_USE_MOCK=true ---------- */
const now = () => new Date().toISOString();
let seq = 1003;
const db = [
  mk(1001, "Northwind Traders", "SHIPPED", [{ sku: "SHELF-120", qty: 40, unitPrice: 54 }]),
  mk(1002, "Alder & Finch", "PAYMENT_PENDING", [{ sku: "LAMP-OAK", qty: 120, unitPrice: 31.5 }]),
];
function mk(id, customerName, status, lines) {
  const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const idx = STATUSES.indexOf(status);
  const events = STATUSES.slice(0, Math.max(idx, 0) + 1)
    .filter((s) => s !== "CANCELLED" && s !== "FAILED")
    .map((s, i) => ({ status: s, at: new Date(Date.now() - (idx - i) * 3600e3).toISOString() }));
  return { id: `ORD-${id}`, customerName, status, lines, total, createdAt: events[0]?.at || now(), events };
}
const mock = {
  list: async () => [...db].reverse(),
  get: async (id) => db.find((o) => o.id === id),
  create: async (body) => {
    const o = mk(seq++, body.customerName, "CREATED", body.lines);
    db.push(o);
    return o;
  },
  approve: async (id) => {
    const o = db.find((x) => x.id === id);
    const next = STATUSES[STATUSES.indexOf(o.status) + 1];
    o.status = next; o.events.push({ status: next, at: now() });
    return o;
  },
  cancel: async (id) => {
    const o = db.find((x) => x.id === id);
    o.status = "CANCELLED"; o.events.push({ status: "CANCELLED", at: now() });
    return o;
  },
};

export const api = MOCK
  ? mock
  : {
      list: () => http("/orders"),
      get: (id) => http(`/orders/${encodeURIComponent(id)}`),
      create: (body) => http("/orders", { method: "POST", body: JSON.stringify(body) }),
      approve: (id) => http(`/orders/${encodeURIComponent(id)}/approve`, { method: "POST" }),
      cancel: (id, reason = "Cancelled from order desk") =>
        http(`/orders/${encodeURIComponent(id)}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
    };
