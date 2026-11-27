import { useState } from "react";
import { num } from "./shared.jsx";

export default function Products({ products, loading, error, onReload, onOrder }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const rows = products.filter((p) => `${p.productId} ${p.name || ""}`.toLowerCase().includes(needle));

  return (
    <section className="card">
      <div className="head">
        <h2>Products</h2>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or ID" aria-label="Search products" />
        <button onClick={onReload} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
      </div>
      {error && <p className="err" role="alert">Couldn't load products: {error}</p>}
      <div className="scroll">
        <table className="grid">
          <thead>
            <tr><th>Product</th><th className="r">Price</th><th className="r">Points</th><th className="r">In stock</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.productId}>
                <td>{p.name}<br /><code>{p.productId}</code></td>
                <td className="r">{num(p.price)}</td>
                <td className="r">{p.pointsPrice > 0 ? <span className="pts">{num(p.pointsPrice)}</span> : <span className="muted">Not redeemable</span>}</td>
                <td className="r">{p.available > 0 ? num(p.available) : <span className="bad">Out of stock</span>}</td>
                <td className="r"><button disabled={p.available <= 0} onClick={() => onOrder(p)}>Order</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && !error && rows.length === 0 && (
        <p className="muted">{products.length ? "No products match your search." : "No products yet. Receive stock in the Admin tab to add one."}</p>
      )}
    </section>
  );
}
