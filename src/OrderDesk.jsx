import { useCallback, useEffect, useState } from "react";
import { createOrder, getOrder, extractId } from "./api.js";
import { FINAL, Result, num, when } from "./shared.jsx";

const KEY = "oms-ui-history";
const CHANNELS = [["ONLINE", "Online"], ["OFFLINE", "Offline"], ["REWARD", "Reward points"]];
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };

export default function OrderDesk({ customerId, customer, products, pick, onSettled }) {
  const [form, setForm] = useState({ channel: "ONLINE", productId: "", quantity: 1, amount: "" });
  const [amountTouched, setAmountTouched] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [placed, setPlaced] = useState(null);

  const [history, setHistory] = useState(loadHistory);
  const [lookupId, setLookupId] = useState("");
  const [order, setOrder] = useState(null);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [auto, setAuto] = useState(false);

  const isReward = form.channel === "REWARD";
  const product = products.find((p) => p.productId === form.productId.trim());
  const qty = Number(form.quantity) || 0;
  const pointsCost = product && product.pointsPrice > 0 ? product.pointsPrice * qty : null;

  // Problems we can already see from the catalog and the customer's balance.
  let rewardIssue = "";
  if (isReward && product) {
    if (!(product.pointsPrice > 0)) rewardIssue = "This product can't be bought with reward points.";
    else if (customer && pointsCost > customer.rewardPoints)
      rewardIssue = `This order needs ${num(pointsCost)} points. The customer has ${num(customer.rewardPoints)}.`;
  }
  const stockWarning = product && qty > product.available ? `Only ${num(product.available)} in stock.` : "";

  // Product chosen on the Products tab.
  useEffect(() => {
    if (!pick) return;
    setForm((f) => ({ ...f, productId: pick.productId }));
    setAmountTouched(false);
  }, [pick]);

  // Suggest the list price until the amount is typed in by hand.
  useEffect(() => {
    if (amountTouched || !product) return;
    setForm((f) => ({ ...f, amount: String(+(product.price * (Number(f.quantity) || 0)).toFixed(2)) }));
  }, [product, form.quantity, amountTouched]);

  const remember = (entry) => {
    const next = [entry, ...history.filter((h) => h.id !== entry.id)].slice(0, 25);
    setHistory(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };

  const lookup = useCallback(async (id, quiet = false) => {
    if (!id) return;
    if (!quiet) setLooking(true);
    setLookupError("");
    try {
      const data = await getOrder(id.trim());
      setOrder(data);
      if (FINAL.includes(data?.status)) onSettled?.();   // points and stock may have changed
    } catch (e) { setOrder(null); setLookupError(e.message); }
    setLooking(false);
  }, [onSettled]);

  // Keep refreshing until the order reaches SUCCESSFUL or FAILED.
  useEffect(() => {
    if (!auto || !lookupId || FINAL.includes(order?.status)) return;
    const t = setInterval(() => lookup(lookupId, true), 3000);
    return () => clearInterval(t);
  }, [auto, lookupId, order?.status, lookup]);

  async function submit(e) {
    e.preventDefault();
    setPlacing(true); setPlaceError(""); setPlaced(null);
    try {
      const body = {
        customerId,
        channel: form.channel,
        productId: form.productId.trim(),
        quantity: Number(form.quantity),
        amount: isReward ? 0 : Number(form.amount),
      };
      const data = await createOrder(body);
      const id = extractId(data);
      setPlaced({ data, id });
      if (id) {
        remember({ id, ...body, at: new Date().toISOString() });
        setLookupId(id);
        setAuto(true);
        lookup(id);
      }
    } catch (err) { setPlaceError(err.message); }
    setPlacing(false);
  }

  const valid = customerId && form.productId.trim() && qty > 0 && !rewardIssue
    && (isReward || (form.amount !== "" && Number(form.amount) > 0));
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="cols">
      <section className="card">
        <h2>Place an order</h2>
        <form onSubmit={submit}>
          <fieldset className="seg">
            <legend>Channel</legend>
            <div>
              {CHANNELS.map(([value, label]) => (
                <label key={value} className={form.channel === value ? "on" : ""}>
                  <input type="radio" name="channel" value={value} checked={form.channel === value} onChange={set("channel")} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <label>Product ID
            <input list="product-ids" value={form.productId} onChange={set("productId")} />
          </label>
          <datalist id="product-ids">
            {products.map((p) => <option key={p.productId} value={p.productId}>{p.name}</option>)}
          </datalist>
          {product && <p className="hint">{product.name} · {num(product.available)} in stock</p>}

          <div className="two">
            <label>Quantity<input type="number" min="1" value={form.quantity} onChange={set("quantity")} /></label>
            {isReward ? (
              <label>Points cost<input readOnly value={pointsCost === null ? "" : num(pointsCost)} placeholder="Choose a product" /></label>
            ) : (
              <label>Amount
                <input type="number" min="0" step="0.01" value={form.amount}
                  onChange={(e) => { setAmountTouched(true); set("amount")(e); }} />
              </label>
            )}
          </div>

          {!customerId && <p className="hint warn">Enter a customer ID above to place an order.</p>}
          {rewardIssue && <p className="hint bad" role="alert">{rewardIssue}</p>}
          {stockWarning && <p className="hint warn">{stockWarning}</p>}
          {form.channel === "ONLINE" && <p className="hint">The customer earns reward points when the payment goes through.</p>}
          {form.channel === "OFFLINE" && <p className="hint">Payment is collected outside the system. No reward points are earned.</p>}

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
                    <span>
                      {h.channel ? `${h.channel} · ` : ""}{h.productId} × {h.quantity}
                      {h.channel === "REWARD" ? "" : ` · ${h.amount}`} · {when(h.at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
