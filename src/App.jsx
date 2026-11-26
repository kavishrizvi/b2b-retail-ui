import { useCallback, useEffect, useState } from "react";
import { createOrder, getOrder, extractId } from "./api.js";

const KEY = "oms-ui-history";
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const when = (iso) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const show = (v) => (v !== null && typeof v === "object" ? JSON.stringify(v) : String(v));

function Result({ data }) {
  if (data === null || data === undefined) return null;
  if (typeof data !== "object") return <pre className="raw">{String(data)}</pre>;
  return (
    <table className="kv"><tbody>
      {Object.entries(data).map(([k, v]) => (
        <tr key={k}><th>{k}</th><td>{k.toLowerCase().includes("status") ? <span className="badge">{show(v)}</span> : show(v)}</td></tr>
      ))}
    </tbody></table>
  );
}

export default function App() {
  const [form, setForm] = useState({ productId: "P1", quantity: 2, amount: 499 });
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [placed, setPlaced] = useState(null);

  const [history, setHistory] = useState(loadHistory);
  const [lookupId, setLookupId] = useState("");
  const [order, setOrder] = useState(null);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [auto, setAuto] = useState(false);

  const remember = (entry) => {
    const next = [entry, ...history.filter((h) => h.id !== entry.id)].slice(0, 25);
    setHistory(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };

  const lookup = useCallback(async (id, quiet = false) => {
    if (!id) return;
    if (!quiet) setLooking(true);
    setLookupError("");
    try { setOrder(await getOrder(id.trim())); }
    catch (e) { setOrder(null); setLookupError(e.message); }
    setLooking(false);
  }, []);

  useEffect(() => {
    if (!auto || !lookupId) return;
    const t = setInterval(() => lookup(lookupId, true), 3000);
    return () => clearInterval(t);
  }, [auto, lookupId, lookup]);

  async function submit(e) {
    e.preventDefault();
    setPlacing(true); setPlaceError(""); setPlaced(null);
    try {
      const body = { productId: form.productId.trim(), quantity: Number(form.quantity), amount: Number(form.amount) };
      const data = await createOrder(body);
      const id = extractId(data);
      setPlaced({ data, id });
      if (id) {
        remember({ id, ...body, at: new Date().toISOString() });
        setLookupId(id);
        lookup(id);
      }
    } catch (err) { setPlaceError(err.message); }
    setPlacing(false);
  }

  const valid = form.productId.trim() && form.quantity > 0 && form.amount >= 0;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="page">
      <h1>Order desk</h1>
      <div className="cols">
        <section className="card">
          <h2>Place an order</h2>
          <form onSubmit={submit}>
            <label>Product ID<input value={form.productId} onChange={set("productId")} /></label>
            <div className="two">
              <label>Quantity<input type="number" min="1" value={form.quantity} onChange={set("quantity")} /></label>
              <label>Amount<input type="number" min="0" step="0.01" value={form.amount} onChange={set("amount")} /></label>
            </div>
            <button className="primary" disabled={!valid || placing}>{placing ? "Placing…" : "Place order"}</button>
          </form>
          {placeError && <p className="err" role="alert">Order failed: {placeError}</p>}
          {placed && (
            <div className="ok">
              <p>{placed.id ? <>Order placed. ID: <code>{placed.id}</code></> : "Order placed, but no order ID was found in the response:"}</p>
              {!placed.id && <Result data={placed.data} />}
            </div>
          )}
        </section>

        <section className="card">
          <h2>Order history</h2>
          <form className="lookup" onSubmit={(e) => { e.preventDefault(); lookup(lookupId); }}>
            <input value={lookupId} onChange={(e) => setLookupId(e.target.value)} placeholder="Order ID" aria-label="Order ID" />
            <button className="primary" disabled={!lookupId.trim() || looking}>{looking ? "Checking…" : "Check order"}</button>
          </form>
          <label className="check"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Refresh every 3 seconds</label>
          {lookupError && <p className="err" role="alert">Couldn't load order: {lookupError}</p>}
          <Result data={order} />

          {history.length > 0 && (
            <>
              <h3>Orders placed from this browser</h3>
              <ul className="hist">
                {history.map((h) => (
                  <li key={h.id}>
                    <button className="ghost" onClick={() => { setLookupId(h.id); lookup(h.id); }}>
                      <code>{h.id}</code>
                      <span>{h.productId} × {h.quantity} · {h.amount} · {when(h.at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}