import { Fragment, useCallback, useEffect, useState } from "react";
import { listAdminOrders, receiveStock } from "./api.js";
import { Result, STATUSES, Status, num, reasonText, when } from "./shared.jsx";

const KEY = "oms-ui-admin-key";
const CHANNELS = [["", "All channels"], ["ONLINE", "Online"], ["OFFLINE", "Offline"], ["REWARD", "Reward points"]];
const readKey = () => { try { return sessionStorage.getItem(KEY) || ""; } catch { return ""; } };

// What the order is worth: money, or points for REWARD orders (plus any points earned).
function Value({ o }) {
  if (o.channel === "REWARD") return o.pointsRedeemed != null ? <span className="pts">{num(o.pointsRedeemed)} points</span> : <span className="muted">—</span>;
  return <>{num(o.amount)}{o.pointsEarned > 0 && <><br /><span className="pts">+{num(o.pointsEarned)} points</span></>}</>;
}

export default function Admin({ active, products, onStockChanged }) {
  const [adminKey, setAdminKey] = useState(readKey);
  const [draft, setDraft] = useState(readKey);

  const [filters, setFilters] = useState({ channel: "", status: "" });
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState("");

  const [stock, setStock] = useState({ productId: "", quantity: "", reference: "" });
  const [stockBusy, setStockBusy] = useState(false);
  const [stockMsg, setStockMsg] = useState("");
  const [stockErr, setStockErr] = useState("");

  const load = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true); setError("");
    try { setData(await listAdminOrders({ ...filters, page, size: 20 }, adminKey)); }
    catch (e) { setData(null); setError(e.message); }
    setLoading(false);
  }, [adminKey, filters, page]);

  useEffect(() => { if (active) load(); }, [active, load]);

  function saveKey(e) {
    e.preventDefault();
    const key = draft.trim();
    setAdminKey(key);
    try { sessionStorage.setItem(KEY, key); } catch { /* storage unavailable */ }
  }

  const filter = (k) => (e) => { setFilters({ ...filters, [k]: e.target.value }); setPage(0); setOpen(""); };
  const setS = (k) => (e) => setStock({ ...stock, [k]: e.target.value });

  async function submitStock(e) {
    e.preventDefault();
    setStockBusy(true); setStockErr(""); setStockMsg("");
    try {
      const res = await receiveStock({
        productId: stock.productId,
        quantity: Number(stock.quantity),
        reference: stock.reference.trim() || undefined,
      }, adminKey);
      setStockMsg(res.duplicate
        ? `Delivery ${stock.reference.trim()} was already received. Nothing was added.`
        : `Added ${num(stock.quantity)} units to ${stock.productId}. Now ${num(res.available)} in stock.`);
      if (!res.duplicate) setStock({ productId: "", quantity: "", reference: "" });
      onStockChanged();
    } catch (err) { setStockErr(err.message); }
    setStockBusy(false);
  }

  const rows = Array.isArray(data) ? data : data?.content || [];
  const totalPages = data?.totalPages || 1;
  const stockValid = stock.productId && Number(stock.quantity) > 0;

  return (
    <>
      <section className="card">
        <form className="who" onSubmit={saveKey}>
          <label>Admin key<input type="password" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" /></label>
          <button disabled={!draft.trim() || draft.trim() === adminKey}>Unlock admin</button>
        </form>
      </section>

      {!adminKey ? (
        <p className="muted pad">Enter the admin key to see all orders and receive stock.</p>
      ) : (
        <>
          <section className="card gap">
            <div className="head">
              <h2>All orders</h2>
              <select value={filters.channel} onChange={filter("channel")} aria-label="Channel">
                {CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select value={filters.status} onChange={filter("status")} aria-label="Status">
                <option value="">All statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
            </div>
            {error && <p className="err" role="alert">Couldn't load orders: {error}</p>}
            <div className="scroll">
              <table className="grid">
                <thead>
                  <tr><th>Order</th><th>Customer</th><th>Channel</th><th>Status</th><th>Item</th><th className="r">Value</th><th>Placed</th></tr>
                </thead>
                <tbody>
                  {rows.map((o) => {
                    const id = String(o.orderId || o._id || "");
                    return (
                      <Fragment key={id}>
                        <tr className="click" onClick={() => setOpen(open === id ? "" : id)}>
                          <td><button className="link" aria-expanded={open === id} onClick={(e) => { e.stopPropagation(); setOpen(open === id ? "" : id); }}><code>{id.slice(0, 8)}</code></button></td>
                          <td>{o.customerId}</td>
                          <td>{o.channel || <span className="muted">—</span>}</td>
                          <td><Status value={o.status} />{o.failureReason && <><br /><span className="muted">{reasonText(o.failureReason)}</span></>}</td>
                          <td>{o.productId} × {o.quantity}</td>
                          <td className="r"><Value o={o} /></td>
                          <td>{when(o.createdAt)}</td>
                        </tr>
                        {open === id && <tr><td colSpan={7}><Result data={o} /></td></tr>}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!loading && !error && rows.length === 0 && <p className="muted">No orders match these filters.</p>}
            {totalPages > 1 && (
              <div className="pager">
                <button onClick={() => setPage(page - 1)} disabled={page === 0 || loading}>Previous</button>
                <span>Page {page + 1} of {totalPages}</span>
                <button onClick={() => setPage(page + 1)} disabled={page + 1 >= totalPages || loading}>Next</button>
              </div>
            )}
          </section>

          <section className="card gap">
            <h2>Inventory</h2>
            <div className="scroll">
              <table className="grid">
                <thead><tr><th>Product</th><th className="r">Available</th><th className="r">Reserved</th></tr></thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.productId}>
                      <td>{p.name}<br /><code>{p.productId}</code></td>
                      <td className="r">{num(p.available)}</td>
                      <td className="r">{num(p.reserved)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>Receive new stock</h3>
            <form onSubmit={submitStock}>
              <div className="three">
                <label>Product
                  <select value={stock.productId} onChange={setS("productId")}>
                    <option value="">Choose a product</option>
                    {products.map((p) => <option key={p.productId} value={p.productId}>{p.productId} · {p.name}</option>)}
                  </select>
                </label>
                <label>Quantity<input type="number" min="1" value={stock.quantity} onChange={setS("quantity")} /></label>
                <label>Delivery note <input value={stock.reference} onChange={setS("reference")} placeholder="Optional, e.g. DN-2041" /></label>
              </div>
              <button className="primary" disabled={!stockValid || stockBusy}>{stockBusy ? "Saving…" : "Receive stock"}</button>
            </form>
            {stockErr && <p className="err" role="alert">Couldn't receive stock: {stockErr}</p>}
            {stockMsg && <div className="ok"><p>{stockMsg}</p></div>}
          </section>
        </>
      )}
    </>
  );
}
