export type Side = "long" | "short";

export type SymbolCode =
  | "BTCUSDT"
  | "ETHUSDT"
  | "SOLUSDT"
  | "BNBUSDT"
  | "XRPUSDT"
  | "DOGEUSDT";

export type PortfolioPresetId = "btc-heavy" | "balanced" | "flat";

export type Position = {
  symbol: SymbolCode;
  side: Side;
  notionalUsd: number;
  leverage: number;
};

export type RiskPolicy = {
  maxLeverage: number;
  maxRiskPerTradePct: number;
  maxDailyDrawdownPct: number;
  requireStopLoss: boolean;
  maxCorrelatedExposurePct: number;
};

export type ProposedTrade = {
  symbol: SymbolCode;
  side: Side;
  entryPrice: number;
  positionNotionalUsd: number;
  leverage: number;
  stopLossPrice: number | null;
  baseShockPct: number;
};

export type AccountSnapshot = {
  walletBalanceUsd: number;
  dailyPnlUsd: number;
  presetId: PortfolioPresetId;
  positions: Position[];
};

export type RiskFinding = {
  level: "good" | "caution" | "danger";
  title: string;
  detail: string;
};

export type SaferSetup = {
  leverage: number;
  positionNotionalUsd: number;
  stopLossPrice: number | null;
  maxLossUsd: number | null;
};

export type RiskAnalysis = {
  score: number;
  status: "safe" | "caution" | "danger";
  summary: string;
  findings: RiskFinding[];
  recommendations: string[];
  portfolioExposurePct: number;
  proposedRiskUsd: number | null;
  proposedRiskPct: number | null;
  liquidationPrice: number;
  liquidationBufferPct: number;
  portfolioShockPnlUsd: number;
  symbolShockPct: number;
  postShockEquityUsd: number;
  shockBreachesLiquidation: boolean;
  saferSetup: SaferSetup;
};

type SymbolMeta = {
  label: string;
  price: number;
  bucket: "majors" | "beta" | "alts" | "memes";
  btcBeta: number;
  defaultStopPct: number;
};

const SYMBOL_META: Record<SymbolCode, SymbolMeta> = {
  BTCUSDT: { label: "BTC / USDT", price: 89800, bucket: "majors", btcBeta: 1, defaultStopPct: 1.8 },
  ETHUSDT: { label: "ETH / USDT", price: 2460, bucket: "majors", btcBeta: 1.22, defaultStopPct: 2.2 },
  SOLUSDT: { label: "SOL / USDT", price: 168, bucket: "beta", btcBeta: 1.6, defaultStopPct: 3.5 },
  BNBUSDT: { label: "BNB / USDT", price: 612, bucket: "majors", btcBeta: 0.86, defaultStopPct: 1.9 },
  XRPUSDT: { label: "XRP / USDT", price: 0.58, bucket: "alts", btcBeta: 1.08, defaultStopPct: 2.9 },
  DOGEUSDT: { label: "DOGE / USDT", price: 0.18, bucket: "memes", btcBeta: 1.95, defaultStopPct: 4.2 },
};

export const SYMBOL_OPTIONS = Object.entries(SYMBOL_META).map(([value, meta]) => ({
  value: value as SymbolCode,
  label: meta.label,
  price: meta.price,
}));

export const PORTFOLIO_PRESETS: Record<
  PortfolioPresetId,
  { label: string; walletBalanceUsd: number; dailyPnlUsd: number; positions: Position[] }
> = {
  "btc-heavy": {
    label: "BTC-heavy swing book",
    walletBalanceUsd: 8500,
    dailyPnlUsd: -420,
    positions: [
      { symbol: "BTCUSDT", side: "long", notionalUsd: 6800, leverage: 5 },
      { symbol: "SOLUSDT", side: "long", notionalUsd: 2600, leverage: 4 },
      { symbol: "BNBUSDT", side: "long", notionalUsd: 1800, leverage: 3 },
    ],
  },
  balanced: {
    label: "Balanced derivatives book",
    walletBalanceUsd: 12000,
    dailyPnlUsd: -160,
    positions: [
      { symbol: "ETHUSDT", side: "long", notionalUsd: 3200, leverage: 4 },
      { symbol: "BNBUSDT", side: "long", notionalUsd: 2200, leverage: 3 },
      { symbol: "XRPUSDT", side: "short", notionalUsd: 1600, leverage: 3 },
    ],
  },
  flat: {
    label: "Flat account",
    walletBalanceUsd: 9000,
    dailyPnlUsd: 80,
    positions: [],
  },
};

export function defaultStopPrice(symbol: SymbolCode, side: Side, entryPrice = SYMBOL_META[symbol].price): number {
  const pct = SYMBOL_META[symbol].defaultStopPct / 100;
  return side === "long" ? entryPrice * (1 - pct) : entryPrice * (1 + pct);
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function stopDistancePct(trade: ProposedTrade): number | null {
  if (trade.stopLossPrice == null || trade.entryPrice <= 0) return null;
  const distance = Math.abs(trade.entryPrice - trade.stopLossPrice) / trade.entryPrice;
  if (distance <= 0) return null;
  return distance * 100;
}

function hasDirectionalStop(trade: ProposedTrade): boolean {
  if (trade.stopLossPrice == null) return false;
  return trade.side === "long"
    ? trade.stopLossPrice < trade.entryPrice
    : trade.stopLossPrice > trade.entryPrice;
}

function liquidationBufferPct(leverage: number): number {
  return Math.max(0.9, 100 / leverage - 0.75);
}

function liquidationPrice(trade: ProposedTrade): number {
  const buffer = liquidationBufferPct(trade.leverage) / 100;
  return trade.side === "long"
    ? trade.entryPrice * (1 - buffer)
    : trade.entryPrice * (1 + buffer);
}

function shockMovePct(symbol: SymbolCode, baseShockPct: number): number {
  return baseShockPct * SYMBOL_META[symbol].btcBeta;
}

function projectedPnl(notionalUsd: number, side: Side, movePct: number): number {
  const direction = side === "long" ? 1 : -1;
  return notionalUsd * (movePct / 100) * direction;
}

function correlatedExposureUsd(positions: Position[], symbol: SymbolCode): number {
  const bucket = SYMBOL_META[symbol].bucket;
  return positions
    .filter((position) => SYMBOL_META[position.symbol].bucket === bucket)
    .reduce((sum, position) => sum + position.notionalUsd, 0);
}

function statusFromScore(score: number): "safe" | "caution" | "danger" {
  if (score >= 75) return "safe";
  if (score >= 48) return "caution";
  return "danger";
}

function buildSummary(status: "safe" | "caution" | "danger", findings: RiskFinding[]): string {
  const keyFinding = findings.find((finding) => finding.level !== "good");
  if (status === "safe") {
    return "Within policy. Downside looks contained and the assistant would let it through.";
  }
  if (status === "caution") {
    return keyFinding
      ? `Tradeable, but tighten it first. Main issue: ${keyFinding.title.toLowerCase()}.`
      : "Tradeable, but it needs tightening first.";
  }
  return keyFinding
    ? `Too aggressive right now. Biggest issue: ${keyFinding.title.toLowerCase()}.`
    : "This trade is too aggressive for the current account state.";
}

export function analyzeTrade(account: AccountSnapshot, policy: RiskPolicy, trade: ProposedTrade): RiskAnalysis {
  const findings: RiskFinding[] = [];
  const recommendations: string[] = [];
  let score = 90;

  const stopPct = hasDirectionalStop(trade) ? stopDistancePct(trade) : null;
  const riskUsd = stopPct == null ? null : trade.positionNotionalUsd * (stopPct / 100);
  const riskPct = riskUsd == null ? null : (riskUsd / account.walletBalanceUsd) * 100;
  const currentDrawdownPct = Math.max(0, (-account.dailyPnlUsd / account.walletBalanceUsd) * 100);
  const drawdownAfterTradePct = currentDrawdownPct + (riskPct ?? policy.maxRiskPerTradePct);
  const sameBucketExposureUsd = correlatedExposureUsd(account.positions, trade.symbol) + trade.positionNotionalUsd;
  const sameBucketExposurePct = (sameBucketExposureUsd / account.walletBalanceUsd) * 100;
  const liqPrice = liquidationPrice(trade);
  const liqBufferPct = liquidationBufferPct(trade.leverage);
  const symbolShock = shockMovePct(trade.symbol, trade.baseShockPct);
  const proposedShockPnl = projectedPnl(trade.positionNotionalUsd, trade.side, symbolShock);
  const existingShockPnl = account.positions.reduce(
    (sum, position) => sum + projectedPnl(position.notionalUsd, position.side, shockMovePct(position.symbol, trade.baseShockPct)),
    0,
  );
  const portfolioShockPnlUsd = existingShockPnl + proposedShockPnl;
  const postShockEquityUsd = account.walletBalanceUsd + portfolioShockPnlUsd;
  const shockedPrice = trade.entryPrice * (1 + symbolShock / 100);
  const shockBreachesLiq = trade.side === "long" ? shockedPrice <= liqPrice : shockedPrice >= liqPrice;

  if (trade.leverage > policy.maxLeverage) {
    score -= Math.min(24, (trade.leverage - policy.maxLeverage) * 4);
    findings.push({
      level: "danger",
      title: "Leverage exceeds policy",
      detail: `Planned leverage is ${round(trade.leverage, 1)}x, above the policy cap of ${round(policy.maxLeverage, 1)}x.`,
    });
    recommendations.push(`Reduce leverage to ${round(policy.maxLeverage, 1)}x or lower.`);
  } else {
    findings.push({
      level: "good",
      title: "Leverage is inside policy",
      detail: `Planned leverage of ${round(trade.leverage, 1)}x stays within the policy cap.`,
    });
  }

  if (policy.requireStopLoss && trade.stopLossPrice == null) {
    score -= 18;
    findings.push({
      level: "danger",
      title: "No stop-loss defined",
      detail: "The current policy requires a stop-loss before the order is allowed through.",
    });
    recommendations.push("Add a stop-loss before submission.");
  } else if (trade.stopLossPrice != null && !hasDirectionalStop(trade)) {
    score -= 20;
    findings.push({
      level: "danger",
      title: "Stop-loss direction is invalid",
      detail: trade.side === "long"
        ? "For a long trade, the stop-loss must sit below the entry."
        : "For a short trade, the stop-loss must sit above the entry.",
    });
    recommendations.push("Fix the stop-loss so downside is clearly defined.");
  }

  if (riskPct != null) {
    if (riskPct > policy.maxRiskPerTradePct * 1.5) {
      score -= 26;
      findings.push({
        level: "danger",
        title: "Trade risk is too large",
        detail: `Estimated loss to stop is ${round(riskPct)}% of wallet balance, materially above the ${round(policy.maxRiskPerTradePct)}% limit.`,
      });
    } else if (riskPct > policy.maxRiskPerTradePct) {
      score -= 16;
      findings.push({
        level: "caution",
        title: "Trade risk is above budget",
        detail: `Estimated loss to stop is ${round(riskPct)}% of wallet balance versus a ${round(policy.maxRiskPerTradePct)}% risk budget.`,
      });
    } else {
      findings.push({
        level: "good",
        title: "Risk-to-stop is reasonable",
        detail: `Estimated loss to stop is ${round(riskPct)}% of wallet balance and fits inside the trade budget.`,
      });
    }
  }

  if (sameBucketExposurePct > policy.maxCorrelatedExposurePct * 1.15) {
    score -= 28;
    findings.push({
      level: "danger",
      title: "Correlated exposure is too high",
      detail: `This trade pushes same-bucket exposure to ${round(sameBucketExposurePct)}% of wallet equity, above the ${round(policy.maxCorrelatedExposurePct)}% policy threshold.`,
    });
    recommendations.push("Resize or avoid stacking another correlated position.");
  } else if (sameBucketExposurePct > policy.maxCorrelatedExposurePct) {
    score -= 16;
    findings.push({
      level: "caution",
      title: "Correlation guard is flashing",
      detail: `Same-bucket exposure lands at ${round(sameBucketExposurePct)}%, slightly above the policy threshold.`,
    });
  } else {
    findings.push({
      level: "good",
      title: "Exposure guard is healthy",
      detail: `Correlated exposure stays within the configured threshold after this trade.`,
    });
  }

  if (drawdownAfterTradePct > policy.maxDailyDrawdownPct) {
    score -= 15;
    findings.push({
      level: "danger",
      title: "Daily drawdown headroom is thin",
      detail: `Current day PnL plus trade risk would push potential drawdown to ${round(drawdownAfterTradePct)}%, beyond the ${round(policy.maxDailyDrawdownPct)}% daily limit.`,
    });
    recommendations.push("Wait or resize while daily drawdown stays elevated.");
  } else if (currentDrawdownPct > policy.maxDailyDrawdownPct * 0.7) {
    score -= 8;
    findings.push({
      level: "caution",
      title: "Account is already under pressure today",
      detail: `The account is already down ${round(currentDrawdownPct)}% today, so sizing discipline matters more than usual.`,
    });
  }

  if (shockBreachesLiq) {
    score -= 24;
    findings.push({
      level: "danger",
      title: "Shock test approaches liquidation",
      detail: `Under a ${round(trade.baseShockPct)}% BTC move, the modeled ${trade.symbol} move would likely breach the current liquidation buffer.`,
    });
    recommendations.push("Reduce leverage until the shock test clears.");
  } else if (portfolioShockPnlUsd < -(account.walletBalanceUsd * 0.08)) {
    score -= 13;
    findings.push({
      level: "caution",
      title: "Shock loss is heavy",
      detail: `The modeled portfolio shock would draw approximately ${round(Math.abs(portfolioShockPnlUsd))} USD from equity.`,
    });
  } else {
    findings.push({
      level: "good",
      title: "Shock test stays contained",
      detail: `The proposed setup survives the modeled shock without entering immediate liquidation pressure.`,
    });
  }

  const recommendedStop = hasDirectionalStop(trade)
    ? (trade.stopLossPrice as number)
    : defaultStopPrice(trade.symbol, trade.side, trade.entryPrice);
  const recommendedStopPct = Math.abs(trade.entryPrice - recommendedStop) / trade.entryPrice;
  const riskBudgetUsd = account.walletBalanceUsd * (policy.maxRiskPerTradePct / 100);
  const maxNotionalByRisk = recommendedStopPct > 0 ? riskBudgetUsd / recommendedStopPct : trade.positionNotionalUsd;
  const correlatedCapacityUsd = Math.max(
    0,
    account.walletBalanceUsd * (policy.maxCorrelatedExposurePct / 100) - correlatedExposureUsd(account.positions, trade.symbol),
  );
  const recommendedNotional = clamp(
    Math.min(trade.positionNotionalUsd, maxNotionalByRisk, correlatedCapacityUsd || trade.positionNotionalUsd),
    0,
    trade.positionNotionalUsd,
  );
  const recommendedLeverage = Math.min(trade.leverage, policy.maxLeverage);
  const recommendedRiskUsd = recommendedNotional > 0 ? recommendedNotional * recommendedStopPct : null;

  if (recommendedNotional < trade.positionNotionalUsd * 0.98) {
    recommendations.push(`Cut notional to about ${round(recommendedNotional)} USD.`);
  }
  if (trade.stopLossPrice == null || !hasDirectionalStop(trade)) {
    recommendations.push(`Use a stop-loss near ${round(recommendedStop, trade.entryPrice > 100 ? 0 : 4)}.`);
  }
  if (recommendations.length === 0) {
    recommendations.push("This setup is within policy. Keep the stop-loss unchanged.");
  }

  score = clamp(Math.round(score), 8, 96);
  const status = statusFromScore(score);

  return {
    score,
    status,
    summary: buildSummary(status, findings),
    findings,
    recommendations: Array.from(new Set(recommendations)),
    portfolioExposurePct: round(sameBucketExposurePct),
    proposedRiskUsd: riskUsd == null ? null : round(riskUsd),
    proposedRiskPct: riskPct == null ? null : round(riskPct),
    liquidationPrice: round(liqPrice, trade.entryPrice > 100 ? 2 : 4),
    liquidationBufferPct: round(liqBufferPct),
    portfolioShockPnlUsd: round(portfolioShockPnlUsd),
    symbolShockPct: round(symbolShock),
    postShockEquityUsd: round(postShockEquityUsd),
    shockBreachesLiquidation: shockBreachesLiq,
    saferSetup: {
      leverage: round(recommendedLeverage, 1),
      positionNotionalUsd: round(recommendedNotional),
      stopLossPrice: round(recommendedStop, trade.entryPrice > 100 ? 2 : 4),
      maxLossUsd: recommendedRiskUsd == null ? null : round(recommendedRiskUsd),
    },
  };
}

export function formatUsd(value: number | null): string {
  if (value == null) return "n/a";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export function formatPct(value: number | null): string {
  if (value == null) return "n/a";
  return `${round(value)}%`;
}

export function statusLabel(status: RiskAnalysis["status"]): string {
  if (status === "safe") return "Within policy";
  if (status === "caution") return "Needs adjustment";
  return "Unsafe to place";
}
