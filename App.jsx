import { useCallback, useEffect, useState } from "react";
import { api, STATUSES, STATUS_LABEL } from "./api.js";

const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const when = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "");
const FLOW = ["CREATED", "INVENTORY_RESERVED", "PAYMENT_PENDING", "PAID", "SHIPPED", "DELIVERED"];
const isOpen = (s) => !["DELIVERED", "CANCELLED", "FAILED"].includes(s);

function Badge({ status }) {
  return <span className={`badge s-${status}`}>{STATUS_LABEL[status] || status}</span>;
}

/* Polls so Temporal workflow progress shows up without a manual refresh. */
function useOrders(intervalMs = 5000) {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { setOrders(await api.list()); setError(""); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, intervalMs);
    return () => clearInterval(t);
  }, [load, intervalMs]);
  return { orders, error, loading, reload: load };
}

function NewOrder({ onClose, onCreated }) {
  const [customerName, setCustomer] = useState("");
  const [lines, setLines] = useState([{ sku: "", qty: 1, unitPrice: 0 }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const setLine = (i, k, v) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const valid = customerName.trim() && lines.every((l) => l.sku.trim() && l.qty > 0 && l.unitPrice >= 0);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try { onCreated(await api.create({ customerName: customerName.trim(), lines })); }
    catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>New order</h2>
        <label>Customer<input value={customerName} onChange={(e) => setCustomer(e.target.value)} autoFocus /></label>
        <div className="lines">
          {lines.map((l, i) => (
            <div className="line" key={i}>
              <label>SKU<input value={l.sku} onChange={(e) => setLine(i, "sku", e.target.value)} /></label>
              <label>Qty<input type="number" min="1" value={l.qty} onChange={(e) => setLine(i, "qty", +e.target.value)} /></label>
              <label>Unit price<input type="number" min="0" step="0.01" value={l.unitPrice} onChange={(e) => setLine(i, "unitPrice", +e.target.value)} /></label>
              {lines.length > 1 && <button type="button" className="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</button>}
            </div>
          ))}
        </div>
        <button type="button" className="ghost" onClick={() => setLines([...lines, { sku: "", qty: 1, unitPrice: 0 }])}>Add line</button>
        {error && <p className="err" role="alert">{error}</p>}
        <div className="row end">
          <strong className="grow">Total {money(total)}</strong>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!valid || busy}>{busy ? "Placing…" : "Place order"}</button>
        </div>
      </form>
    </div>
  );
}

function Detail({ id, onClose, onChanged }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    const load = () => api.get(id).then((o) => live && setOrder(o)).catch((e) => live && setError(e.message));
    load();
    const t = setInterval(load, 4000);
    return () => { live = false; clearInterval(t); };
  }, [id]);

  async function act(fn) {
    setBusy(true); setError("");
    try { setOrder(await fn()); onChanged(); } catch (e) { setError(e.message); }
    setBusy(false);
  }

  if (!order) return <aside className="drawer"><button className="ghost" onClick={onClose}>Close</button><p>{error || "Loading…"}</p></aside>;
  const reached = new Set((order.events || []).map((e) => e.status));
  const at = Object.fromEntries((order.events || []).map((e) => [e.status, e.at]));

  return (
    <aside className="drawer">
      <div className="row"><h2 className="grow">{order.id}</h2><button className="ghost" onClick={onClose}>Close</button></div>
      <p className="muted">{order.customerName} · {when(order.createdAt)}</p>
      <Badge status={order.status} />
      <h3>Progress</h3>
      <ol className="track">
        {FLOW.map((s) => (
          <li key={s} className={reached.has(s) ? "done" : ""}>
            <span>{STATUS_LABEL[s]}</span><time>{at[s] ? when(at[s]) : ""}</time>
          </li>
        ))}
      </ol>
      {["CANCELLED", "FAILED"].includes(order.status) && <p className="err">This order is {STATUS_LABEL[order.status].toLowerCase()}.</p>}
      <h3>Items</h3>
      <table><tbody>
        {order.lines?.map((l, i) => (
          <tr key={i}><td>{l.sku}</td><td className="num">{l.qty} × {money(l.unitPrice)}</td><td className="num">{money(l.qty * l.unitPrice)}</td></tr>
        ))}
        <tr className="total"><td colSpan="2">Total</td><td className="num">{money(order.total)}</td></tr>
      </tbody></table>
      {error && <p className="err" role="alert">{error}</p>}
      {isOpen(order.status) && (
        <div className="row">
          <button className="primary" disabled={busy} onClick={() => act(() => api.approve(order.id))}>Approve next step</button>
          <button className="danger" disabled={busy} onClick={() => window.confirm(`Cancel ${order.id}?`) && act(() => api.cancel(order.id))}>Cancel order</button>
        </div>
      )}
    </aside>
  );
}

export default function App() {
  const { orders, error, loading, reload } = useOrders();
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);

  const shown = orders.filter((o) =>
    (filter === "ALL" || o.status === filter) &&
    `${o.id} ${o.customerName}`.toLowerCase().includes(query.toLowerCase()));
  const count = (s) => orders.filter((o) => o.status === s).length;

  return (
    <div className={`app ${selected ? "has-drawer" : ""}`}>
      <header>
        <h1>Order desk</h1>
        <input className="search" placeholder="Search by order or customer" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search orders" />
        <button className="primary" onClick={() => setCreating(true)}>New order</button>
      </header>

      <nav className="filters" aria-label="Filter by status">
        <button className={filter === "ALL" ? "on" : ""} onClick={() => setFilter("ALL")}>All <b>{orders.length}</b></button>
        {STATUSES.map((s) => (
          <button key={s} className={filter === s ? "on" : ""} onClick={() => setFilter(s)}>{STATUS_LABEL[s]} <b>{count(s)}</b></button>
        ))}
      </nav>

      {error && <p className="err banner" role="alert">Can't reach the order service: {error}. Retrying every few seconds.</p>}

      <main>
        <div className="scroll">
          <table className="orders">
            <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th className="num">Total</th><th>Placed</th></tr></thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id} tabIndex={0} className={selected === o.id ? "sel" : ""}
                    onClick={() => setSelected(o.id)} onKeyDown={(e) => e.key === "Enter" && setSelected(o.id)}>
                  <td className="id">{o.id}</td><td>{o.customerName}</td><td><Badge status={o.status} /></td>
                  <td className="num">{money(o.total)}</td><td>{when(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && shown.length === 0 && <p className="empty">No orders match. Clear the filter or place a new order.</p>}
        </div>
        {selected && <Detail id={selected} onClose={() => setSelected(null)} onChanged={reload} />}
      </main>

      {creating && <NewOrder onClose={() => setCreating(false)} onCreated={(o) => { setCreating(false); setSelected(o.id); reload(); }} />}
    </div>
  );
}
