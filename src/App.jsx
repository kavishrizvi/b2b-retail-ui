import { useCallback, useEffect, useState } from "react";
import { getCustomer, listProducts } from "./api.js";
import { num } from "./shared.jsx";
import OrderDesk from "./OrderDesk.jsx";
import Products from "./Products.jsx";
import Admin from "./Admin.jsx";

const CUSTOMER_KEY = "oms-ui-customer";
const TABS = [["order", "Order desk"], ["products", "Products"], ["admin", "Admin"]];
const savedCustomer = () => { try { return localStorage.getItem(CUSTOMER_KEY) || ""; } catch { return ""; } };

export default function App() {
  const [tab, setTab] = useState("order");

  const [customerId, setCustomerId] = useState(savedCustomer);
  const [draft, setDraft] = useState(savedCustomer);
  const [customer, setCustomer] = useState(null);
  const [customerError, setCustomerError] = useState("");

  const [products, setProducts] = useState([]);
  const [productsError, setProductsError] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [pick, setPick] = useState(null);

  const refreshCustomer = useCallback(async () => {
    if (!customerId) { setCustomer(null); setCustomerError(""); return; }
    try { setCustomer(await getCustomer(customerId)); setCustomerError(""); }
    catch (e) { setCustomer(null); setCustomerError(e.message); }
  }, [customerId]);

  const refreshProducts = useCallback(async () => {
    setLoadingProducts(true); setProductsError("");
    try { setProducts(await listProducts()); }
    catch (e) { setProductsError(e.message); }
    setLoadingProducts(false);
  }, []);

  useEffect(() => { refreshCustomer(); }, [refreshCustomer]);
  useEffect(() => { refreshProducts(); }, [refreshProducts]);

  // An order reached a final state: points and stock may have changed.
  const onSettled = useCallback(() => { refreshCustomer(); refreshProducts(); }, [refreshCustomer, refreshProducts]);

  function applyCustomer(e) {
    e.preventDefault();
    const id = draft.trim();
    setCustomerId(id);
    try { localStorage.setItem(CUSTOMER_KEY, id); } catch { /* storage unavailable */ }
  }

  function orderProduct(p) {
    setPick({ productId: p.productId, n: Date.now() });
    setTab("order");
  }

  return (
    <div className="page">
      <header className="top">
        <h1>Order desk</h1>
        <nav className="tabs" aria-label="Sections">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? "tab on" : "tab"} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
      </header>

      <form className="who" onSubmit={applyCustomer}>
        <label>Customer ID<input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. C-1001" /></label>
        <button disabled={draft.trim() === customerId}>Use customer</button>
        <p className="who-info">
          {customer ? <>{customer.name} · <strong className="pts">{num(customer.rewardPoints)} points</strong></>
            : customerError ? <span className="err" role="alert">Couldn't load customer: {customerError}</span>
            : "No customer selected"}
        </p>
      </form>

      <div hidden={tab !== "order"}>
        <OrderDesk customerId={customerId} customer={customer} products={products} pick={pick} onSettled={onSettled} />
      </div>
      <div hidden={tab !== "products"}>
        <Products products={products} loading={loadingProducts} error={productsError} onReload={refreshProducts} onOrder={orderProduct} />
      </div>
      <div hidden={tab !== "admin"}>
        <Admin active={tab === "admin"} products={products} onStockChanged={refreshProducts} />
      </div>
    </div>
  );
}
