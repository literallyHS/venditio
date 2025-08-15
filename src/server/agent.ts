import WebSocket from "ws";

export type SymbolTicker = {
  symbol: string;
  lastPrice: number;
  updatedAt: number;
};

export type Position = {
  symbol: string;
  quantity: number; // coin units
  avgEntryPrice: number; // USDT per coin
};

export type Trade = {
  timestamp: number;
  action: "BUY" | "SELL";
  symbol: string;
  price: number;
  quantity: number;
  feePaid: number;
};

export type AgentState = {
  isRunning: boolean;
  watchSymbols: string[];
  baseCurrency: string; // USDT
  cashBalance: number;
  positions: Record<string, Position>;
  prices: Record<string, SymbolTicker>;
  trades: Trade[];
  equity: number; // cash + market value of positions
  unrealizedPnl: number;
  haltReason: string | null;
  tradingHaltedUntilMs: number | null;
  strategy: StrategyName;
};

type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  startMs: number;
  endMs: number;
};

type Metrics = {
  cumulativeRealizedPnl: number;
  totalClosedTrades: number;
  winningTrades: number;
  maxDrawdown: number;
  sharpe: number;
  equityHistory: Array<{ ts: number; equity: number }>;
};

const BINANCE_WS_BASE = "wss://stream.binance.com:9443/stream?streams=";

const DEFAULT_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "TRXUSDT",
  "TONUSDT",
  "AVAXUSDT",
  // Ek popüler semboller (toplam 30 olacak şekilde)
  "DOTUSDT",
  "POLUSDT",
  "LINKUSDT",
  "LTCUSDT",
  "BCHUSDT",
  "ATOMUSDT",
  "NEARUSDT",
  "ETCUSDT",
  "XLMUSDT",
  "FILUSDT",
  "ICPUSDT",
  "ARBUSDT",
  "OPUSDT",
  "APTUSDT",
  "SUIUSDT",
  "SEIUSDT",
  "INJUSDT",
  "AAVEUSDT",
  "RUNEUSDT",
  "UNIUSDT",
];

export type StrategyName = "low" | "medium" | "high";

type StrategyConfig = {
  name: StrategyName;
  maxConcurrentPositions: number;
  positionSizePct: number;
  stopLossPct: number;
  takeProfitHalfPct: number;
  trailingPct: number;
  atrFilterPct: number;
  candlePeriodMs: number;
  rsiLongThreshold: number;
  rsiShortThreshold: number;
  mode: "trend" | "mean_reversion";
  allowShorts: boolean;
  maxDailyLossUsd: number;
  dailyProfitTargetUsd: number;
  maxConsecutiveLosingTrades: number;
  cooldownMsAfterLossStreak: number;
};

function makeConfig(name: StrategyName): StrategyConfig {
  if (name === "low") {
    return {
      name,
      maxConcurrentPositions: 1,
      positionSizePct: 0.02,
      stopLossPct: 0.002,
      takeProfitHalfPct: 0.0045,
      trailingPct: 0.002,
      atrFilterPct: 0.0015,
      candlePeriodMs: 15 * 60 * 1000,
      rsiLongThreshold: 60,
      rsiShortThreshold: 40,
      mode: "trend",
      allowShorts: true,
      maxDailyLossUsd: 200,
      dailyProfitTargetUsd: 300,
      maxConsecutiveLosingTrades: 3,
      cooldownMsAfterLossStreak: 90 * 60 * 1000,
    };
  }
  if (name === "high") {
    return {
      name,
      maxConcurrentPositions: 5,
      positionSizePct: 0.1,
      stopLossPct: 0.004,
      takeProfitHalfPct: 0.002,
      trailingPct: 0.001,
      atrFilterPct: 0.0005,
      candlePeriodMs: 1 * 60 * 1000,
      rsiLongThreshold: 30,
      rsiShortThreshold: 70,
      mode: "mean_reversion",
      allowShorts: true,
      maxDailyLossUsd: 600,
      dailyProfitTargetUsd: 800,
      maxConsecutiveLosingTrades: 5,
      cooldownMsAfterLossStreak: 30 * 60 * 1000,
    };
  }
  return {
    name: "medium",
    maxConcurrentPositions: 3,
    positionSizePct: 0.05,
    stopLossPct: 0.0025,
    takeProfitHalfPct: 0.003,
    trailingPct: 0.0015,
    atrFilterPct: 0.001,
    candlePeriodMs: 5 * 60 * 1000,
    rsiLongThreshold: 55,
    rsiShortThreshold: 45,
    mode: "trend",
    allowShorts: true,
    maxDailyLossUsd: 300,
    dailyProfitTargetUsd: 400,
    maxConsecutiveLosingTrades: 3,
    cooldownMsAfterLossStreak: 60 * 60 * 1000,
  };
}

class PaperTradingAgent {
  private websocket: WebSocket | null = null;
  private readonly symbols: string[];
  private readonly priceHistory: Record<string, number[]> = {};
  private readonly maxHistoryLength: number = 120; // ~2 dakikalık 1s verisi (miniTicker izleme için)
  private isRunning: boolean = false;
  private cashBalance: number;
  private positions: Record<string, Position> = {};
  private prices: Record<string, SymbolTicker> = {};
  private trades: Trade[] = [];
  private tickTimer: NodeJS.Timeout | null = null;
  // Ücret ve kayma
  private readonly commissionRate: number = 0.0005; // %0.05 komisyon
  private readonly slippageRate: number = 0.0005; // %0.05 slippage (alımda aleyhte +, satımda aleyhte -)
  // Stratejiye bağlı risk/kontrol
  private strategy: StrategyName = "medium";
  private cfg: StrategyConfig = makeConfig("medium");
  private sessionStartEquity: number = 0;

  // Günlük risk ve kontrol parametreleri (cfg üzerinden)
  private tradingHaltedUntilMs: number | null = null; // Bu zaman gelene kadar yeni pozisyon yok
  private haltReason: string | null = null; // Bilgi amaçlı
  private consecutiveLosingTrades: number = 0;
  private lastAnyPriceUpdateMs: number = 0; // Watchdog için

  // 5 dakika mum ve indikatör durumu
  private candleHistory: Record<string, Candle[]> = {};
  private buildingCandle: Record<string, Candle | null> = {};
  private lastProcessedCandleEnd: Record<string, number> = {};

  // İşlem yönetimi (kısmi TP ve trailing için)
  private tradeMgmt: Record<
    string,
    | undefined
    | {
        entryPrice: number;
        hasTakenPartial: boolean;
        highestSinceEntry: number; // long için
        lowestSinceEntry: number; // short için
      }
  > = {};

  // Performans metrikleri
  private metrics: Metrics = {
    cumulativeRealizedPnl: 0,
    totalClosedTrades: 0,
    winningTrades: 0,
    maxDrawdown: 0,
    sharpe: 0,
    equityHistory: [],
  };

  constructor(options?: {
    symbols?: string[];
    startingCash?: number;
    strategy?: StrategyName;
  }) {
    this.symbols = (options?.symbols ?? DEFAULT_SYMBOLS).map((s) =>
      s.toUpperCase()
    );
    this.cashBalance = options?.startingCash ?? 10000;
    if (options?.strategy) {
      this.setStrategy(options.strategy);
    }
    for (const s of this.symbols) {
      this.priceHistory[s] = [];
      this.candleHistory[s] = [];
      this.buildingCandle[s] = null;
    }
  }

  public getState(): AgentState {
    const { equity, unrealizedPnl } = this.computeEquityAndPnl();
    return {
      isRunning: this.isRunning,
      watchSymbols: [...this.symbols],
      baseCurrency: "USDT",
      cashBalance: this.cashBalance,
      positions: { ...this.positions },
      prices: { ...this.prices },
      trades: [...this.trades],
      equity,
      unrealizedPnl,
      haltReason: this.haltReason,
      tradingHaltedUntilMs: this.tradingHaltedUntilMs,
      strategy: this.strategy,
    };
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    await this.backfillHistoricalCandles().catch(() => {});
    this.connectWebSocket();
    this.isRunning = true;
    this.sessionStartEquity = this.computeEquityAndPnl().equity;
    this.tradingHaltedUntilMs = null;
    this.haltReason = null;
    this.consecutiveLosingTrades = 0;
    this.lastAnyPriceUpdateMs = Date.now();
    this.tickTimer = setInterval(() => this.onTick(), 1000);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.websocket) {
      try {
        this.websocket.close();
      } catch {}
      this.websocket = null;
    }
  }

  public reset(options?: { startingCash?: number }): void {
    this.cashBalance = options?.startingCash ?? 10000;
    this.positions = {};
    this.trades = [];
    this.tradeMgmt = {};
    this.metrics = {
      cumulativeRealizedPnl: 0,
      totalClosedTrades: 0,
      winningTrades: 0,
      maxDrawdown: 0,
      sharpe: 0,
      equityHistory: [],
    };
    for (const s of this.symbols) this.priceHistory[s] = [];
    for (const s of this.symbols) this.candleHistory[s] = [];
    for (const s of this.symbols) this.buildingCandle[s] = null;
    this.lastProcessedCandleEnd = {};
    this.tradingHaltedUntilMs = null;
    this.haltReason = null;
    this.consecutiveLosingTrades = 0;
    this.lastAnyPriceUpdateMs = 0;
  }

  public setStrategy(name: StrategyName): void {
    this.strategy = name;
    this.cfg = makeConfig(name);
  }

  public liquidateAll(): void {
    this.closeAllPositions();
  }

  private getLatestKnownPrice(symbol: string): number | null {
    const spot = this.prices[symbol]?.lastPrice;
    if (isFinite(spot as number)) return spot as number;
    const hist = this.priceHistory[symbol];
    if (hist && hist.length > 0) {
      const lastHist = hist[hist.length - 1];
      if (isFinite(lastHist)) return lastHist;
    }
    const lastCandleList = this.candleHistory[symbol];
    if (lastCandleList && lastCandleList.length > 0) {
      const lastCandle = lastCandleList[lastCandleList.length - 1];
      if (isFinite(lastCandle?.close)) return lastCandle.close;
    }
    return null;
  }

  private connectWebSocket(): void {
    const streams = this.symbols
      .map((s) => `${s.toLowerCase()}@miniTicker`)
      .join("/");
    const url = `${BINANCE_WS_BASE}${streams}`;
    this.websocket = new WebSocket(url);
    this.websocket.on("open", () => {});
    this.websocket.on("message", (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        const data = parsed?.data;
        if (!data) return;
        const symbol: string = (data.s as string) || "";
        const price = parseFloat(data.c);
        if (!symbol || !isFinite(price)) return;
        const now = Date.now();
        this.lastAnyPriceUpdateMs = now;
        this.prices[symbol] = { symbol, lastPrice: price, updatedAt: now };
        const arr =
          this.priceHistory[symbol] ?? (this.priceHistory[symbol] = []);
        arr.push(price);
        if (arr.length > this.maxHistoryLength) arr.shift();

        // 5 dakikalık mum inşası
        this.updateCandle(symbol, price, now);
      } catch {}
    });
    this.websocket.on("close", () => {
      this.websocket = null;
      if (this.isRunning) {
        setTimeout(() => this.connectWebSocket(), 1000);
      }
    });
    this.websocket.on("error", () => {});
  }

  private computeSma(values: number[], length: number): number | null {
    if (values.length < length) return null;
    const slice = values.slice(-length);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / length;
  }

  private updateCandle(symbol: string, price: number, now: number): void {
    const period = this.cfg.candlePeriodMs;
    const startMs = Math.floor(now / period) * period;
    const c = this.buildingCandle[symbol];
    if (!c || c.startMs !== startMs) {
      if (c) {
        // Önceki mumu kapat
        const list =
          this.candleHistory[symbol] ?? (this.candleHistory[symbol] = []);
        list.push(c);
        if (list.length > 1000) list.shift();
      }
      this.buildingCandle[symbol] = {
        open: price,
        high: price,
        low: price,
        close: price,
        startMs,
        endMs: startMs + period,
      };
      return;
    }
    // Mevcut mum güncelle
    c.high = Math.max(c.high, price);
    c.low = Math.min(c.low, price);
    c.close = price;
  }

  private computeEma(values: number[], length: number): number | null {
    if (values.length < length) return null;
    const k = 2 / (length + 1);
    let ema = this.computeSma(values.slice(0, length), length) as number;
    for (let i = length; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
    }
    return ema;
  }

  private getBinanceInterval(): string {
    const ms = this.cfg.candlePeriodMs;
    if (ms <= 60 * 1000) return "1m";
    if (ms <= 5 * 60 * 1000) return "5m";
    if (ms <= 15 * 60 * 1000) return "15m";
    // Fallback
    return "5m";
  }

  private async backfillHistoricalCandles(): Promise<void> {
    const interval = this.getBinanceInterval();
    const limit = 60; // 60 mum ~ indikatörler için yeterli başlagıç
    const symbols = [...this.symbols];

    // Sembolleri küçük parçalara bölerek istekleri sırala (rate limit güvenliği)
    const chunkSize = 5;
    for (let i = 0; i < symbols.length; i += chunkSize) {
      const chunk = symbols.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (s) => {
          try {
            const url = `https://api.binance.com/api/v3/klines?symbol=${s}&interval=${interval}&limit=${limit}`;
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) return;
            const data: unknown = await res.json();
            if (!Array.isArray(data)) return;
            const candles = (data as unknown[])
              .map((k) => {
                if (!Array.isArray(k)) return null;
                const arr = k as unknown[];
                // kline: [ openTime, open, high, low, close, volume, closeTime, ... ]
                const startMs = Number(arr[0]);
                const endMs = Number(arr[6]);
                const open = parseFloat(arr[1] as string);
                const high = parseFloat(arr[2] as string);
                const low = parseFloat(arr[3] as string);
                const close = parseFloat(arr[4] as string);
                if (
                  !isFinite(open) ||
                  !isFinite(high) ||
                  !isFinite(low) ||
                  !isFinite(close)
                )
                  return null;
                const c = { open, high, low, close, startMs, endMs } as Candle;
                return c;
              })
              .filter((c) => !!c) as Candle[];
            this.candleHistory[s] = candles;
            this.buildingCandle[s] = null;
          } catch {}
        })
      );
      // Küçük gecikme: agresif istekleri dağıt
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  private computeRsi(closes: number[], length: number): number | null {
    if (closes.length < length + 1) return null;
    let gain = 0;
    let loss = 0;
    for (let i = closes.length - length; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gain += change;
      else loss += -change;
    }
    const avgGain = gain / length;
    const avgLoss = loss / length;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  private computeMacd(closes: number[]): {
    macd: number | null;
    signal: number | null;
    hist: number | null;
  } {
    if (closes.length < 26 + 9) return { macd: null, signal: null, hist: null };
    const ema12 = this.computeEma(closes, 12);
    const ema26 = this.computeEma(closes, 26);
    if (ema12 == null || ema26 == null)
      return { macd: null, signal: null, hist: null };
    const macdSeries: number[] = [];
    for (let i = 26; i <= closes.length; i++) {
      const slice = closes.slice(0, i);
      const e12 = this.computeEma(slice, 12);
      const e26 = this.computeEma(slice, 26);
      if (e12 != null && e26 != null)
        macdSeries.push((e12 as number) - (e26 as number));
    }
    const macd = macdSeries[macdSeries.length - 1] ?? null;
    const signal = this.computeEma(macdSeries, 9);
    const hist =
      macd != null && signal != null ? macd - (signal as number) : null;
    return { macd, signal, hist };
  }

  private computeAtr(candles: Candle[], length: number): number | null {
    if (candles.length < length + 1) return null;
    const slice = candles.slice(-length - 1);
    const trs: number[] = [];
    for (let i = 1; i < slice.length; i++) {
      const prevClose = slice[i - 1].close;
      const h = slice[i].high;
      const l = slice[i].low;
      const tr = Math.max(
        h - l,
        Math.abs(h - prevClose),
        Math.abs(l - prevClose)
      );
      trs.push(tr);
    }
    return trs.reduce((a, b) => a + b, 0) / trs.length;
  }

  private onTick(): void {
    // Watchdog: Uzun süre fiyat akışı yoksa WS'i yeniden bağla
    const now = Date.now();
    if (
      this.isRunning &&
      this.lastAnyPriceUpdateMs > 0 &&
      now - this.lastAnyPriceUpdateMs > 15000
    ) {
      try {
        if (this.websocket) this.websocket.close();
      } catch {}
      this.websocket = null;
      this.connectWebSocket();
      this.lastAnyPriceUpdateMs = now;
    }

    // Günlük izleme ve devre kesici
    const { equity } = this.computeEquityAndPnl();
    this.metrics.equityHistory.push({ ts: now, equity });
    if (this.metrics.equityHistory.length > 5000)
      this.metrics.equityHistory.shift();

    // Halting devre dışı: her zaman işlem yapmaya devam et

    for (const symbol of this.symbols) {
      const candles = this.candleHistory[symbol];
      if (!candles || candles.length < 40) continue;
      const latest = candles[candles.length - 1];
      if (!latest) continue;
      if (this.lastProcessedCandleEnd[symbol] === latest.endMs) {
        // Bu mum zaten işlendi
        continue;
      }

      const closes = candles.map((c) => c.close);

      // Indikatörler (prev ve curr için)
      const ema9Prev = this.computeEma(closes.slice(0, closes.length - 1), 9);
      const ema21Prev = this.computeEma(closes.slice(0, closes.length - 1), 21);
      const ema9Curr = this.computeEma(closes, 9);
      const ema21Curr = this.computeEma(closes, 21);
      if (
        ema9Prev == null ||
        ema21Prev == null ||
        ema9Curr == null ||
        ema21Curr == null
      ) {
        this.lastProcessedCandleEnd[symbol] = latest.endMs;
        continue;
      }
      const rsiCurr = this.computeRsi(closes, 14);
      const macdPrev = this.computeMacd(closes.slice(0, closes.length - 1));
      const macdCurr = this.computeMacd(closes);
      const atrCurr = this.computeAtr(candles, 14);

      if (
        rsiCurr == null ||
        macdPrev.macd == null ||
        macdPrev.signal == null ||
        macdCurr.macd == null ||
        macdCurr.signal == null ||
        atrCurr == null
      ) {
        this.lastProcessedCandleEnd[symbol] = latest.endMs;
        continue;
      }

      const price = latest.close;
      const atrOk = atrCurr > price * this.cfg.atrFilterPct;
      const emaCrossUp =
        (ema9Prev as number) <= (ema21Prev as number) &&
        (ema9Curr as number) > (ema21Curr as number);
      const emaCrossDown =
        (ema9Prev as number) >= (ema21Prev as number) &&
        (ema9Curr as number) < (ema21Curr as number);
      const macdCrossUp =
        (macdPrev.macd as number) <= (macdPrev.signal as number) &&
        (macdCurr.macd as number) > (macdCurr.signal as number);
      const macdCrossDown =
        (macdPrev.macd as number) >= (macdPrev.signal as number) &&
        (macdCurr.macd as number) < (macdCurr.signal as number);

      let longSignal = false;
      let shortSignal = false;
      if (this.cfg.mode === "trend") {
        longSignal =
          emaCrossUp &&
          (rsiCurr as number) > this.cfg.rsiLongThreshold &&
          macdCrossUp &&
          atrOk;
        shortSignal =
          emaCrossDown &&
          (rsiCurr as number) < this.cfg.rsiShortThreshold &&
          macdCrossDown &&
          atrOk;
      } else {
        longSignal = (rsiCurr as number) < this.cfg.rsiLongThreshold && atrOk;
        shortSignal = (rsiCurr as number) > this.cfg.rsiShortThreshold && atrOk;
      }
      if (!this.cfg.allowShorts) shortSignal = false;

      const pos = this.positions[symbol];
      const hasPos = !!pos && Math.abs(pos.quantity) > 1e-12;
      const isLong = hasPos && (pos as Position).quantity > 0;
      const isShort = hasPos && (pos as Position).quantity < 0;

      // Pozisyon yönetimi (SL, TP %50, trailing kalan %50)
      if (hasPos) {
        const mg = this.tradeMgmt[symbol];
        if (mg) {
          if (isLong) {
            mg.highestSinceEntry = Math.max(mg.highestSinceEntry, price);
            const stopLoss =
              (pos as Position).avgEntryPrice * (1 - this.cfg.stopLossPct);
            const takeHalf =
              (pos as Position).avgEntryPrice *
              (1 + this.cfg.takeProfitHalfPct);
            const trailingStop =
              mg.highestSinceEntry -
              (pos as Position).avgEntryPrice * this.cfg.trailingPct;

            if (price <= stopLoss) {
              // Tam kapanış (SL)
              const qty = Math.abs((pos as Position).quantity);
              this.executeTrade("SELL", symbol, price, qty);
              delete this.tradeMgmt[symbol];
            } else if (!mg.hasTakenPartial && price >= takeHalf) {
              // %50 kâr al
              const qty = Math.abs((pos as Position).quantity) * 0.5;
              this.executeTrade("SELL", symbol, price, qty);
              mg.hasTakenPartial = true;
            } else if (mg.hasTakenPartial && price <= trailingStop) {
              // trailing ile kalan kapanış
              const qty = Math.abs((pos as Position).quantity);
              this.executeTrade("SELL", symbol, price, qty);
              delete this.tradeMgmt[symbol];
            }
          } else if (isShort) {
            mg.lowestSinceEntry = Math.min(mg.lowestSinceEntry, price);
            const stopLoss =
              (pos as Position).avgEntryPrice * (1 + this.cfg.stopLossPct);
            const takeHalf =
              (pos as Position).avgEntryPrice *
              (1 - this.cfg.takeProfitHalfPct);
            const trailingStop =
              mg.lowestSinceEntry +
              (pos as Position).avgEntryPrice * this.cfg.trailingPct;

            if (price >= stopLoss) {
              const qty = Math.abs((pos as Position).quantity);
              this.executeTrade("BUY", symbol, price, qty);
              delete this.tradeMgmt[symbol];
            } else if (!mg.hasTakenPartial && price <= takeHalf) {
              const qty = Math.abs((pos as Position).quantity) * 0.5;
              this.executeTrade("BUY", symbol, price, qty);
              mg.hasTakenPartial = true;
            } else if (mg.hasTakenPartial && price >= trailingStop) {
              const qty = Math.abs((pos as Position).quantity);
              this.executeTrade("BUY", symbol, price, qty);
              delete this.tradeMgmt[symbol];
            }
          }
        }

        // Ters sinyal: pozisyonu çevir
        if (isLong && shortSignal) {
          const qty = Math.abs((pos as Position).quantity);
          this.executeTrade("SELL", symbol, price, qty);
          delete this.tradeMgmt[symbol];
          // Açık pozisyon sayısı kontrolü gereksiz (aynı sembol)
          this.openPosition("SHORT", symbol, price);
        } else if (isShort && longSignal) {
          const qty = Math.abs((pos as Position).quantity);
          this.executeTrade("BUY", symbol, price, qty);
          delete this.tradeMgmt[symbol];
          this.openPosition("LONG", symbol, price);
        }
      } else {
        // Yeni girişler (strateji limite göre)
        if (longSignal) this.openPosition("LONG", symbol, price);
        else if (shortSignal) this.openPosition("SHORT", symbol, price);
      }

      this.lastProcessedCandleEnd[symbol] = latest.endMs;
    }
  }

  private countOpenPositions(): number {
    return Object.values(this.positions).filter(
      (p) => Math.abs(p.quantity) > 1e-12
    ).length;
  }

  private openPosition(
    direction: "LONG" | "SHORT",
    symbol: string,
    price: number
  ): void {
    const existing = this.positions[symbol];
    const alreadyOpen = !!existing && Math.abs(existing.quantity) > 1e-12;
    if (
      !alreadyOpen &&
      this.countOpenPositions() >= this.cfg.maxConcurrentPositions
    )
      return;
    const { equity } = this.computeEquityAndPnl();
    const notional = Math.max(0, equity * this.cfg.positionSizePct);
    if (notional < 5) return;
    const execPrice =
      direction === "LONG"
        ? price * (1 + this.slippageRate)
        : price * (1 - this.slippageRate);
    const qty = Math.floor((notional / execPrice) * 1e6) / 1e6;
    if (qty <= 0) return;

    if (direction === "LONG") {
      this.executeTrade("BUY", symbol, price, qty);
      this.tradeMgmt[symbol] = {
        entryPrice: execPrice,
        hasTakenPartial: false,
        highestSinceEntry: execPrice,
        lowestSinceEntry: execPrice,
      };
    } else {
      this.executeTrade("SELL", symbol, price, qty);
      this.tradeMgmt[symbol] = {
        entryPrice: execPrice,
        hasTakenPartial: false,
        highestSinceEntry: execPrice,
        lowestSinceEntry: execPrice,
      };
    }
  }

  private executeTrade(
    action: "BUY" | "SELL",
    symbol: string,
    price: number,
    quantity: number
  ): boolean {
    if (quantity <= 0 || !isFinite(price)) return false;
    const effectivePrice =
      action === "BUY"
        ? price * (1 + this.slippageRate)
        : price * (1 - this.slippageRate);
    const notional = effectivePrice * quantity;
    const fee = notional * this.commissionRate;

    const existing = this.positions[symbol];
    if (action === "BUY") {
      // Long açma/artırma ya da short kapama
      if (this.cashBalance < notional + fee) return false;
      this.cashBalance -= notional + fee;
      if (!existing) {
        this.positions[symbol] = {
          symbol,
          quantity,
          avgEntryPrice: effectivePrice,
        };
      } else if (existing.quantity >= 0) {
        const totalQty = existing.quantity + quantity;
        const newAvg =
          (existing.avgEntryPrice * existing.quantity +
            effectivePrice * quantity) /
          totalQty;
        this.positions[symbol] = {
          symbol,
          quantity: totalQty,
          avgEntryPrice: newAvg,
        };
      } else {
        // Short azaltma (kapatma)
        const coverQty = Math.min(quantity, Math.abs(existing.quantity));
        const remaining = existing.quantity + coverQty; // existing.quantity negatif
        if (Math.abs(remaining) <= 1e-12) {
          // Tam kapandı
          delete this.positions[symbol];
          // Realized PnL güncelle (short): (entry - exit) * qty
          const realized =
            (existing.avgEntryPrice - effectivePrice) *
            Math.abs(existing.quantity);
          this.metrics.cumulativeRealizedPnl += realized - fee;
          this.metrics.totalClosedTrades += 1;
          if (realized > 0) this.metrics.winningTrades += 1;
          this.updateLossStreakAndMaybeCooldown(realized - fee);
        } else {
          // Kısmi kapama, short miktarı azalır
          this.positions[symbol] = {
            symbol,
            quantity: remaining,
            avgEntryPrice: existing.avgEntryPrice,
          };
          const realized = (existing.avgEntryPrice - effectivePrice) * coverQty;
          this.metrics.cumulativeRealizedPnl += realized - fee;
        }
      }
    } else {
      // SELL: Long kapama ya da short açma/artırma
      this.cashBalance += notional - fee;
      if (!existing) {
        // Short aç
        this.positions[symbol] = {
          symbol,
          quantity: -quantity,
          avgEntryPrice: effectivePrice,
        };
      } else if (existing.quantity > 0) {
        // Long azalt/kapat
        const sellQty = Math.min(quantity, existing.quantity);
        const remaining = existing.quantity - sellQty;
        if (remaining <= 1e-12) {
          delete this.positions[symbol];
          // Realized PnL (long): (exit - entry) * qty
          const realized =
            (effectivePrice - existing.avgEntryPrice) * existing.quantity;
          this.metrics.cumulativeRealizedPnl += realized - fee;
          this.metrics.totalClosedTrades += 1;
          if (realized > 0) this.metrics.winningTrades += 1;
          this.updateLossStreakAndMaybeCooldown(realized - fee);
        } else {
          this.positions[symbol] = {
            symbol,
            quantity: remaining,
            avgEntryPrice: existing.avgEntryPrice,
          };
          const realized = (effectivePrice - existing.avgEntryPrice) * sellQty;
          this.metrics.cumulativeRealizedPnl += realized - fee;
        }
      } else {
        // Short artırma
        const totalAbs = Math.abs(existing.quantity) + quantity;
        const newAvg =
          (existing.avgEntryPrice * Math.abs(existing.quantity) +
            effectivePrice * quantity) /
          totalAbs;
        this.positions[symbol] = {
          symbol,
          quantity: -totalAbs,
          avgEntryPrice: newAvg,
        };
      }
    }

    this.trades.push({
      timestamp: Date.now(),
      action,
      symbol,
      price: effectivePrice,
      quantity,
      feePaid: fee,
    });
    if (this.trades.length > 5000) this.trades.shift();

    this.updatePerformanceMetrics();
    return true;
  }

  private updateLossStreakAndMaybeCooldown(realizedNetPnl: number): void {
    if (realizedNetPnl < 0) {
      this.consecutiveLosingTrades += 1;
      if (this.consecutiveLosingTrades >= this.cfg.maxConsecutiveLosingTrades) {
        const now = Date.now();
        this.tradingHaltedUntilMs = now + this.cfg.cooldownMsAfterLossStreak;
        this.haltReason = "loss_streak";
        this.closeAllPositions();
      }
    } else if (realizedNetPnl > 0) {
      this.consecutiveLosingTrades = 0;
    }
  }

  private isTradingHalted(): boolean {
    // Halting tamamen devre dışı
    return false;
  }

  private closeAllPositions(): void {
    for (const symbol of Object.keys(this.positions)) {
      const pos = this.positions[symbol];
      if (!pos || Math.abs(pos.quantity) <= 1e-12) continue;
      const last = this.getLatestKnownPrice(symbol) ?? pos.avgEntryPrice;
      if (!isFinite(last)) continue;
      const qty = Math.abs(pos.quantity);
      if (pos.quantity > 0) {
        this.executeTrade("SELL", symbol, last, qty);
      } else if (pos.quantity < 0) {
        this.executeTrade("BUY", symbol, last, qty);
      }
    }
  }

  private updatePerformanceMetrics(): void {
    const { equity } = this.computeEquityAndPnl();
    this.metrics.equityHistory.push({ ts: Date.now(), equity });
    if (this.metrics.equityHistory.length > 5000)
      this.metrics.equityHistory.shift();

    // Max drawdown
    let peak = -Infinity;
    let maxDd = 0;
    for (const p of this.metrics.equityHistory) {
      peak = Math.max(peak, p.equity);
      const dd = peak > 0 ? (peak - p.equity) / peak : 0;
      if (dd > maxDd) maxDd = dd;
    }
    this.metrics.maxDrawdown = maxDd;

    // Sharpe (basit): equity log-returns üzerinden
    const eq = this.metrics.equityHistory
      .map((e) => e.equity)
      .filter((v) => v > 0);
    if (eq.length >= 20) {
      const rets: number[] = [];
      for (let i = 1; i < eq.length; i++) {
        rets.push(Math.log(eq[i] / eq[i - 1]));
      }
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const variance =
        rets.reduce((acc, r) => acc + (r - mean) * (r - mean), 0) /
        Math.max(1, rets.length - 1);
      const std = Math.sqrt(Math.max(variance, 0));
      this.metrics.sharpe = std > 0 ? mean / std : 0;
    }

    const winRate =
      this.metrics.totalClosedTrades > 0
        ? this.metrics.winningTrades / this.metrics.totalClosedTrades
        : 0;
    // Terminale özet yazdır
    // Not: Çok sık log baskılanmasın diye sadece işlem sonrası çağrılır
    console.log(
      `[${new Date().toISOString()}] PnL=${this.metrics.cumulativeRealizedPnl.toFixed(
        4
      )} | WinRate=${(winRate * 100).toFixed(1)}% | MaxDD=${(
        this.metrics.maxDrawdown * 100
      ).toFixed(2)}% | Sharpe=${this.metrics.sharpe.toFixed(
        3
      )} | Equity=${equity.toFixed(2)}`
    );
  }

  private computeEquityAndPnl(): { equity: number; unrealizedPnl: number } {
    let equity = this.cashBalance;
    let unrealizedPnl = 0;
    for (const symbol of Object.keys(this.positions)) {
      const pos = this.positions[symbol];
      const last = this.prices[symbol]?.lastPrice;
      if (!last) continue;
      const marketValue = pos.quantity * last;
      equity += marketValue;
      unrealizedPnl += (last - pos.avgEntryPrice) * pos.quantity;
    }
    return { equity, unrealizedPnl };
  }
}

// Singleton ajan: dev ortamında modül yeniden yüklense de korunur
declare global {
  var __paperTradingAgent: PaperTradingAgent | undefined;
}

export function getAgent(): PaperTradingAgent {
  if (!global.__paperTradingAgent) {
    global.__paperTradingAgent = new PaperTradingAgent();
  }
  return global.__paperTradingAgent;
}

export function recreateAgent(options?: {
  symbols?: string[];
  startingCash?: number;
  strategy?: StrategyName;
  resumeRunning?: boolean;
}): PaperTradingAgent {
  const prev = global.__paperTradingAgent;
  const wasRunning = prev ? prev.getState().isRunning : false;
  const resume = options?.resumeRunning ?? wasRunning;
  try {
    if (prev && wasRunning) prev.stop();
  } catch {}
  global.__paperTradingAgent = new PaperTradingAgent({
    symbols: options?.symbols,
    startingCash: options?.startingCash,
    strategy: options?.strategy,
  });
  if (resume) {
    try {
      global.__paperTradingAgent.start();
    } catch {}
  }
  return global.__paperTradingAgent;
}
