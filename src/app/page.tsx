"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type State = {
  isRunning: boolean;
  watchSymbols: string[];
  baseCurrency: string;
  cashBalance: number;
  positions: Record<
    string,
    { symbol: string; quantity: number; avgEntryPrice: number }
  >;
  prices: Record<
    string,
    { symbol: string; lastPrice: number; updatedAt: number }
  >;
  trades: Array<{
    timestamp: number;
    action: "BUY" | "SELL";
    symbol: string;
    price: number;
    quantity: number;
    feePaid: number;
  }>;
  equity: number;
  unrealizedPnl: number;
  haltReason: string | null;
  tradingHaltedUntilMs: number | null;
  strategy?: "low" | "medium" | "high";
};

export default function Home() {
  // Üretim derlemesi sırasında sayfa verisi toplanmasın
  // ve tamamen dinamik kalsın ki SSE ve API rotaları dev/prod'ta sorunsuz çalışsın
  // (App Router'da route-level değil file-level export kullanılıyor)
  const [state, setState] = useState<State | null>(null);
  const evtRef = useRef<EventSource | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<
    "low" | "medium" | "high"
  >("medium");
  const initialEquityRef = useRef<number | null>(null);
  const [showAllSymbols, setShowAllSymbols] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [startingCashInput, setStartingCashInput] = useState<number>(10000);

  useEffect(() => {
    const es = new EventSource("/api/agent/stream");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as State;
        // Oturum başlangıcı equity referansı
        if (initialEquityRef.current == null && isFinite(data?.equity)) {
          initialEquityRef.current = data.equity;
        }
        setState(data);
        if (
          data?.strategy &&
          (data.strategy === "low" ||
            data.strategy === "medium" ||
            data.strategy === "high")
        ) {
          setSelectedStrategy(data.strategy);
        }
      } catch {}
    };
    evtRef.current = es;
    return () => {
      es.close();
    };
  }, []);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("startingCash"));
      if (isFinite(saved) && saved > 0) {
        setStartingCashInput(saved);
      }
    } catch {}
  }, []);

  const start = async () => {
    await fetch("/api/agent/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
  };
  const stop = async () => {
    await fetch("/api/agent/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop" }),
    });
  };
  const reset = async () => {
    initialEquityRef.current = null;
    await fetch("/api/agent/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reset",
        options: {
          startingCash: startingCashInput,
          strategy: selectedStrategy,
        },
      }),
    });
  };
  const recreate = async () => {
    await fetch("/api/agent/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "recreate",
        options: { startingCash: startingCashInput },
      }),
    });
  };

  const sellAll = async () => {
    await fetch("/api/agent/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sell_all" }),
    });
  };

  const applyStrategy = async (s: "low" | "medium" | "high") => {
    await fetch("/api/agent/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_strategy",
        options: { strategy: s },
      }),
    });
  };

  const sessionPnl =
    state && initialEquityRef.current != null
      ? state.equity - (initialEquityRef.current as number)
      : 0;
  const signedSessionPnlStr = `${
    sessionPnl >= 0 ? "+" : ""
  }${sessionPnl.toFixed(2)}`;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>
          <span
            className={styles.brand}
            data-darkreader-ignore
            data-content="Venditio"
          >
            Venditio
          </span>
          <span className={styles.hyphen}>-</span>
          <span className={styles.tagline}>Trading Agent</span>
        </h1>
        <div className={styles.topBar}>
          <div className={styles.controls}>
            <button
              onClick={start}
              className={`${styles.button} ${styles.start}`}
            >
              Start
            </button>
            <button
              onClick={stop}
              className={`${styles.button} ${styles.reset}`}
            >
              Stop
            </button>
            <button
              onClick={reset}
              className={`${styles.button} ${styles.reset}`}
            >
              Reset
            </button>
            <button
              onClick={recreate}
              className={`${styles.button} ${styles.reset}`}
              title="Update symbols to 30"
            >
              Reload Symbols
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className={`${styles.button} ${styles.iconButton}`}
              title="Settings"
              aria-label="Settings"
            >
              ⚙
            </button>
          </div>
          <div className={styles.strategyBar}>
            <span className={styles.strategyLabel}>Strategy Risks:</span>
            <div className={styles.strategyButtons}>
              <button
                className={`${styles.strategyButton} ${
                  selectedStrategy === "low"
                    ? styles.strategyButtonSelected
                    : ""
                }`}
                onClick={() => {
                  setSelectedStrategy("low");
                  applyStrategy("low");
                }}
              >
                Low Risk
              </button>
              <button
                className={`${styles.strategyButton} ${
                  selectedStrategy === "medium"
                    ? styles.strategyButtonSelected
                    : ""
                }`}
                onClick={() => {
                  setSelectedStrategy("medium");
                  applyStrategy("medium");
                }}
              >
                Medium Risk
              </button>
              <button
                className={`${styles.strategyButton} ${
                  selectedStrategy === "high"
                    ? styles.strategyButtonSelected
                    : ""
                }`}
                onClick={() => {
                  setSelectedStrategy("high");
                  applyStrategy("high");
                }}
              >
                High Risk
              </button>
            </div>
          </div>
        </div>
        {state ? (
          <div style={{ marginTop: 16, width: "100%", maxWidth: 1000 }}>
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                border: "1px solid #333",
                borderRadius: 8,
                lineHeight: 1.5,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  Currently{" "}
                  <strong>
                    {state.equity.toFixed(2)} {state.baseCurrency}
                  </strong>
                  ; session PnL is{" "}
                  <span
                    style={{ color: sessionPnl >= 0 ? "limegreen" : "tomato" }}
                  >
                    {signedSessionPnlStr} {state.baseCurrency}
                  </span>
                  .{" "}
                  <span style={{ opacity: 0.8 }}>
                    (Cash: {state.cashBalance.toFixed(2)} {state.baseCurrency},
                    Equity: {state.equity.toFixed(2)} {state.baseCurrency})
                  </span>
                </div>
                <button
                  onClick={sellAll}
                  className={`${styles.button} ${styles.reset}`}
                  title="Close all positions and move to cash"
                >
                  Sell All
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div>
                <strong>Cash:</strong> {state.cashBalance.toFixed(2)}{" "}
                {state.baseCurrency}
              </div>
              <div>
                <strong>Equity:</strong> {state.equity.toFixed(2)}{" "}
                {state.baseCurrency}
              </div>
              <div>
                <strong>Unrealized PnL:</strong>{" "}
                {state.unrealizedPnl.toFixed(2)} {state.baseCurrency}
              </div>
              <div>
                <strong>Session PnL:</strong>{" "}
                <span
                  style={{
                    color:
                      initialEquityRef.current != null &&
                      state.equity - (initialEquityRef.current as number) >= 0
                        ? "limegreen"
                        : "tomato",
                  }}
                >
                  {(initialEquityRef.current != null
                    ? state.equity - (initialEquityRef.current as number)
                    : 0
                  ).toFixed(2)}
                </span>{" "}
                {state.baseCurrency}
              </div>
              <div>
                <strong>Status:</strong>{" "}
                <span
                  style={{ color: state.isRunning ? "limegreen" : "tomato" }}
                >
                  {state.isRunning ? "Running" : "Stopped"}
                </span>
              </div>
              {state.haltReason ? (
                <div>
                  <strong>Halt:</strong> {state.haltReason}
                  {state.tradingHaltedUntilMs
                    ? ` (until ${new Date(
                        state.tradingHaltedUntilMs
                      ).toLocaleTimeString()})`
                    : null}
                </div>
              ) : null}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 12,
                marginBottom: 8,
                justifyContent: "space-between",
                flexWrap: "wrap",
                width: "100%",
              }}
            >
              <h3 style={{ margin: 0 }}>Prices</h3>
              {state.watchSymbols.length > 10 ? (
                <button
                  onClick={() => setShowAllSymbols((v) => !v)}
                  className={styles.button}
                  style={{ padding: "4px 8px", fontSize: 12 }}
                  title={showAllSymbols ? "Show only top 10" : "Show all"}
                >
                  {showAllSymbols ? "Show top 10" : "Show all"}
                </button>
              ) : null}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(140px, 1fr))",
                gap: 8,
                marginTop: 4,
              }}
            >
              {(showAllSymbols
                ? state.watchSymbols
                : state.watchSymbols.slice(0, 10)
              ).map((s) => {
                const p = state.prices[s];
                return (
                  <div
                    key={s}
                    style={{
                      border: "1px solid #333",
                      borderRadius: 8,
                      padding: 8,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{s}</div>
                    <div>{p ? p.lastPrice.toFixed(4) : "-"}</div>
                  </div>
                );
              })}
            </div>
            {/* Modal kaldırıldı; toggle ile tek grid'de gösteriliyor */}
            <h3 style={{ marginTop: 12 }}>Positions</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Symbol</th>
                  <th align="right">Quantity</th>
                  <th align="right">Average</th>
                  <th align="right">Price</th>
                  <th align="right">PnL</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(state.positions).length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 8, color: "#888" }}>
                      No positions
                    </td>
                  </tr>
                ) : (
                  Object.values(state.positions).map((pos) => {
                    const last = state.prices[pos.symbol]?.lastPrice ?? 0;
                    const pnl = (last - pos.avgEntryPrice) * pos.quantity;
                    return (
                      <tr key={pos.symbol}>
                        <td>{pos.symbol}</td>
                        <td align="right">{pos.quantity.toFixed(6)}</td>
                        <td align="right">{pos.avgEntryPrice.toFixed(4)}</td>
                        <td align="right">{last.toFixed(4)}</td>
                        <td
                          align="right"
                          style={{ color: pnl >= 0 ? "limegreen" : "tomato" }}
                        >
                          {pnl.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <h3 style={{ marginTop: 12 }}>Trades</h3>
            <div
              style={{
                maxHeight: 260,
                overflow: "auto",
                border: "1px solid #333",
                borderRadius: 8,
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th align="left">Time</th>
                    <th align="left">Action</th>
                    <th align="left">Symbol</th>
                    <th align="right">Price</th>
                    <th align="right">Quantity</th>
                    <th align="right">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {state.trades
                    .slice()
                    .reverse()
                    .map((t, i) => (
                      <tr key={i}>
                        <td>{new Date(t.timestamp).toLocaleTimeString()}</td>
                        <td>{t.action}</td>
                        <td>{t.symbol}</td>
                        <td align="right">{t.price.toFixed(4)}</td>
                        <td align="right">{t.quantity.toFixed(6)}</td>
                        <td align="right">{t.feePaid.toFixed(4)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p>Waiting for data...</p>
        )}
      </main>
      {showSettings ? (
        <div
          className={styles.modalBackdrop}
          onClick={() => setShowSettings(false)}
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <div className={styles.modalHeader}>
              <h3 id="settings-title" style={{ margin: 0 }}>
                Simulation Settings
              </h3>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.inputGroup}>
                <label htmlFor="starting-cash">Starting Balance</label>
                <div className={styles.inline}>
                  <input
                    id="starting-cash"
                    type="number"
                    min={1}
                    step={1}
                    className={styles.input}
                    value={startingCashInput}
                    onChange={(e) =>
                      setStartingCashInput(
                        Math.max(1, Number(e.currentTarget.value) || 0)
                      )
                    }
                  />
                  <span className={styles.inputSuffix}>USDT</span>
                </div>
                <div className={styles.hint}>
                  Default is 10000 USDT. Set a different amount here to
                  simulate.
                </div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                className={`${styles.button} ${styles.reset}`}
                onClick={async () => {
                  try {
                    localStorage.setItem(
                      "startingCash",
                      String(startingCashInput)
                    );
                  } catch {}
                  // Yeni bakiyeyi anında uygula (stratejiyi değiştirme)
                  initialEquityRef.current = null;
                  await fetch("/api/agent/control", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "reset",
                      options: { startingCash: startingCashInput },
                    }),
                  });
                  setShowSettings(false);
                }}
              >
                Save
              </button>
              <button
                className={`${styles.button} ${styles.start}`}
                onClick={async () => {
                  try {
                    localStorage.setItem(
                      "startingCash",
                      String(startingCashInput)
                    );
                  } catch {}
                  initialEquityRef.current = null;
                  await fetch("/api/agent/control", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "reset",
                      options: {
                        startingCash: startingCashInput,
                        strategy: selectedStrategy,
                      },
                    }),
                  });
                  setShowSettings(false);
                }}
              >
                Apply and Reset
              </button>
              <button
                className={`${styles.button} ${styles.reset}`}
                onClick={() => setShowSettings(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
