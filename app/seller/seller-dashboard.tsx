"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Status = "received" | "preparing" | "ready" | "collected";
type Item = { id: string; name: string; image: string; remaining: number; available: boolean; price: number };
type Order = {
  id: number; number: number; status: Status; note: string; total: number;
  createdAt: string; updatedAt: string;
  lines: { name: string; quantity: number; price: number }[];
};
type SellerData = { orders: Order[]; items: Item[]; paused: boolean };
type Filter = "active" | Status;

const statusLabels: Record<Status, string> = { received: "New", preparing: "Preparing", ready: "Ready", collected: "Collected" };
const nextActions: Partial<Record<Status, { label: string; next: Status }>> = {
  received: { label: "Start preparing", next: "preparing" },
  preparing: { label: "Mark ready", next: "ready" },
  ready: { label: "Mark collected", next: "collected" },
};
function won(value: number) { return `₩${value.toLocaleString("en-US")}`; }
function orderTime(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "" : date.toLocaleTimeString("en-KR", { hour: "2-digit", minute: "2-digit" }); }

export default function SellerDashboard({ sellerEmail, signOutPath }: { sellerEmail: string; signOutPath: string }) {
  const [data, setData] = useState<SellerData | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [mobileView, setMobileView] = useState<"orders" | "stock">("orders");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState("");
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const saving = useRef(false);
  const refreshVersion = useRef(0);

  const refresh = useCallback(async () => {
    if (saving.current) return;
    const version = ++refreshVersion.current;
    try {
      const response = await fetch("/api/seller", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Sign in again to manage the stall." : response.status === 403 ? "Your account no longer has seller access." : "Could not refresh orders.");
      const next = await response.json() as SellerData;
      if (version !== refreshVersion.current) return;
      setData(next);
      setRefreshedAt(new Date());
      setError("");
    } catch (failure) {
      if (version !== refreshVersion.current) return;
      setError(failure instanceof Error ? failure.message : "Could not refresh orders.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { ++refreshVersion.current; window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);

  async function post(path: string, body: object, action: string) {
    if (saving.current) return false;
    saving.current = true;
    ++refreshVersion.current;
    setBusy(action); setActionError("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string; order?: Order; item?: Item; paused?: boolean };
      if (!response.ok) {
        saving.current = false;
        if (response.status === 409) await refresh();
        throw new Error(result.error || "Could not save the change.");
      }
      // Show the confirmed change even when the following refresh is offline.
      setData((current) => current && ({
        ...current,
        orders: result.order ? current.orders.map((order) => order.id === result.order!.id ? result.order! : order) : current.orders,
        items: result.item ? current.items.map((item) => item.id === result.item!.id ? result.item! : item) : current.items,
        paused: result.paused ?? current.paused,
      }));
      saving.current = false;
      await refresh();
      return true;
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : "Could not save the change.");
      return false;
    } finally { saving.current = false; setBusy(""); }
  }

  const counts = useMemo(() => {
    const orders = data?.orders ?? [];
    return {
      active: orders.filter((order) => order.status !== "collected").length,
      received: orders.filter((order) => order.status === "received").length,
      preparing: orders.filter((order) => order.status === "preparing").length,
      ready: orders.filter((order) => order.status === "ready").length,
      collected: orders.filter((order) => order.status === "collected").length,
    };
  }, [data]);
  const visibleOrders = (data?.orders ?? []).filter((order) => filter === "active" ? order.status !== "collected" : order.status === filter);

  return <main className="seller-page">
    <aside className="seller-sidebar">
      <a className="seller-brand" href="/" aria-label="Kawan, Makan Lah! menu"><img src="/assets/scene/logo.png" alt="Kawan, Makan Lah!" /></a>
      <nav aria-label="Seller sections"><a href="#orders">Orders</a><a href="#stock">Stock</a></nav>
      <div className="seller-account"><span>{sellerEmail}</span><a href={signOutPath} target="_top">Sign out</a></div>
    </aside>
    <div className="seller-main">
      <header className="seller-topbar"><span>Kawan, Makan Lah!</span><div className="seller-mobile-tabs"><button className={mobileView === "orders" ? "selected" : ""} onClick={() => setMobileView("orders")}>Orders</button><button className={mobileView === "stock" ? "selected" : ""} onClick={() => setMobileView("stock")}>Stock</button></div></header>
      <div className="seller-heading">
        <div><h1><span className="seller-desktop-title">Orders</span><span className="seller-mobile-title">{mobileView === "stock" ? "Stock" : "Orders"}</span></h1><p>One selling day <span aria-hidden="true">·</span> Pay at stall</p></div>
        <div className="seller-heading-actions"><span className="freshness">{refreshedAt ? `Updated ${orderTime(refreshedAt.toISOString())}` : "Connecting"}</span><button className="outline-button" onClick={() => void refresh()}>Refresh</button></div>
      </div>
      <div className="seller-mobile-account"><span>{sellerEmail}</span><a href={signOutPath} target="_top">Sign out</a></div>
      {error && <div className="seller-error" role="alert">{error} <button onClick={() => void refresh()}>Retry</button></div>}
      {actionError && <div className="seller-error" role="alert">{actionError}</div>}
      {!data && !error && <p className="seller-loading" role="status">Loading orders and stock…</p>}
      {data && <div className="seller-columns">
        <section id="orders" className={`seller-orders ${mobileView !== "orders" ? "mobile-hidden" : ""}`}>
          <div className="seller-filter" role="group" aria-label="Filter orders">
            {(["active", "received", "preparing", "ready", "collected"] as Filter[]).map((option) => <button key={option} className={filter === option ? "selected" : ""} onClick={() => setFilter(option)} aria-pressed={filter === option}>
              <span>{option === "active" ? "Active" : statusLabels[option]}</span><strong>{counts[option]}</strong>
            </button>)}
          </div>
          <div className="order-queue">
            {visibleOrders.length === 0 && <div className="queue-empty"><strong>{filter === "active" ? "No active orders" : `No ${filter === "received" ? "new" : filter} orders`}</strong><p>New orders will appear here automatically.</p></div>}
            {visibleOrders.map((order) => {
              const action = nextActions[order.status];
              return <article className="seller-order" key={order.id}>
                <div className="seller-order-top"><div><span className="order-number">#{order.number}</span><span className={`status-tag status-${order.status}`}>{statusLabels[order.status]}</span></div><time dateTime={order.createdAt}>{orderTime(order.createdAt)}</time></div>
                <ul className="seller-order-lines">{order.lines.map((line, index) => <li key={`${line.name}-${index}`}><span><b>{line.quantity}×</b> {line.name}</span><strong>{won(line.quantity * line.price)}</strong></li>)}</ul>
                {order.note && <p className="seller-note"><span>Note</span> {order.note}</p>}
                <div className="seller-order-foot"><span>Total <strong>{won(order.total)}</strong></span>{action && <button className="order-action" disabled={!!busy} onClick={() => void post(`/api/seller/orders/${order.id}/status`, { status: action.next }, `order-${order.id}`)}>{busy === `order-${order.id}` ? "Saving…" : action.label}</button>}</div>
              </article>;
            })}
          </div>
        </section>
        <section id="stock" className={`seller-stock ${mobileView !== "stock" ? "mobile-hidden" : ""}`}>
          <div className="stock-heading"><div><h2>Portions left</h2><p>Adjust stock as you serve.</p></div><strong>{data.items.filter((item) => item.available && item.remaining > 0).length}/{data.items.length}</strong></div>
          <div className="stock-list">{data.items.map((item) => <StockRow key={item.id} item={item} busy={!!busy} onSave={(body) => post(`/api/seller/menu/${item.id}`, body, `stock-${item.id}`)} />)}</div>
          <div className="pause-control"><div><strong>New orders</strong><p>{data.paused ? "Customers can browse but cannot order." : "Customers can place orders now."}</p></div><button disabled={!!busy} onClick={() => void post("/api/seller/pause", { paused: !data.paused }, "pause")}>{busy === "pause" ? "Saving…" : data.paused ? "Resume" : "Pause"}</button></div>
        </section>
      </div>}
    </div>
  </main>;
}

function StockRow({ item, busy, onSave }: { item: Item; busy: boolean; onSave: (body: { remaining?: number; expectedRemaining?: number; available?: boolean }) => Promise<boolean> }) {
  // Keep the count from the beginning of the edit. Polling must not silently
  // rebase the edit onto a later sale and bypass the API's conflict check.
  const [draft, setDraft] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<number | null>(null);
  const quantity = draft ?? String(item.remaining);
  const valid = /^\d+$/.test(quantity) && Number(quantity) <= 999;
  const changed = draft !== null && Number(draft) !== baseline;
  const conflict = draft !== null && baseline !== item.remaining;

  function reset() { setDraft(null); setBaseline(null); }
  async function save() {
    if (!valid || !changed || conflict || busy) return;
    if (await onSave({ remaining: Number(quantity), expectedRemaining: baseline! })) reset();
  }

  return <div className="stock-row">
    <img src={item.image} alt="" />
    <div className="stock-row-main"><strong>{item.name}</strong><span>{item.available && item.remaining > 0 ? `${item.remaining} left` : "Sold out"}</span></div>
    <div className="stock-row-actions">
      <label><span className="sr-only">Portions left for {item.name}</span><input
        type="number" min="0" max="999" step="1" inputMode="numeric"
        value={quantity} disabled={busy} aria-invalid={!valid}
        aria-describedby={draft !== null && (!valid || conflict) ? `stock-error-${item.id}` : undefined}
        onChange={(event) => {
          if (draft === null) setBaseline(item.remaining);
          setDraft(event.target.value);
        }}
      /></label>
      {draft !== null && <div className="stock-edit-actions">
        <button className="stock-save" disabled={busy || !valid || !changed || conflict} onClick={() => void save()}>Save</button>
        <button className="stock-cancel" disabled={busy} onClick={reset}>Cancel</button>
      </div>}
    </div>
    {draft !== null && (!valid || conflict) && <p className="stock-edit-error" id={`stock-error-${item.id}`} role="status">
      {conflict ? `Stock changed from ${baseline} to ${item.remaining}.` : "Enter a whole number from 0 to 999."}
      {conflict && <button disabled={busy} onClick={reset}>Use latest count</button>}
    </p>}
    <button className="stock-toggle" disabled={busy} onClick={() => void onSave({ available: !item.available })}>{item.available ? "Mark sold out" : "Make available"}</button>
  </div>;
}
