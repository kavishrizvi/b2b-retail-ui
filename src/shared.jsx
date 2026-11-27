export const when = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "");
export const show = (v) => (v !== null && typeof v === "object" ? JSON.stringify(v) : String(v));
export const num = (n) => Number(n || 0).toLocaleString();

// Order status: PENDING -> SUCCESSFUL, PENDING -> FAILED, or PENDING -> CANCELLING -> FAILED
export const STATUSES = ["PENDING", "CANCELLING", "SUCCESSFUL", "FAILED"];
export const FINAL = ["SUCCESSFUL", "FAILED"];
const statusClass = (s) => (s === "SUCCESSFUL" ? "good" : s === "FAILED" ? "bad" : s === "CANCELLING" ? "warn" : "");

// Why an order failed, in words a person can act on.
const REASONS = {
  OUT_OF_STOCK: "Not enough stock.",
  UNKNOWN_PRODUCT: "That product doesn't exist.",
  AMOUNT_LIMIT_EXCEEDED: "The payment was declined: the amount is over the limit.",
  INSUFFICIENT_POINTS: "The customer doesn't have enough reward points.",
  NOT_REDEEMABLE: "This product can't be bought with reward points.",
  UNKNOWN_CUSTOMER: "That customer doesn't exist.",
  WORKFLOW_START_FAILED: "The order couldn't be started. Try again.",
};
export const reasonText = (code) => REASONS[code] || code;

export function Status({ value }) {
  return <span className={`badge ${statusClass(value)}`}>{show(value)}</span>;
}

export function Result({ data }) {
  if (data === null || data === undefined) return null;
  if (typeof data !== "object") return <pre className="raw">{String(data)}</pre>;
  return (
    <table className="kv"><tbody>
      {Object.entries(data).map(([k, v]) => (
        <tr key={k}>
          <th>{k}</th>
          <td>
            {k.toLowerCase().includes("status") ? <Status value={v} />
              : k === "failureReason" ? <>{show(v)}<br /><span className="muted">{reasonText(v)}</span></>
              : show(v)}
          </td>
        </tr>
      ))}
    </tbody></table>
  );
}
