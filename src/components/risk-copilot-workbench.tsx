"use client";

import { useEffect, useRef, useState } from "react";
import {
  PORTFOLIO_PRESETS,
  SYMBOL_OPTIONS,
  analyzeTrade,
  defaultStopPrice,
  formatPct,
  formatUsd,
  statusLabel,
  type PortfolioPresetId,
  type RiskAnalysis,
  type Side,
  type SymbolCode,
} from "@/lib/risk-copilot";

type DemoScenarioId = "safe" | "caution" | "danger";

type DemoScenario = {
  id: DemoScenarioId;
  label: string;
  shortLabel: string;
  summary: string;
  presetId: PortfolioPresetId;
  symbol: SymbolCode;
  side: Side;
  positionNotionalUsd: number;
  leverage: number;
  baseShockPct: number;
  expectedStatus: "safe" | "caution" | "danger";
};

const SYMBOL_PRICE_BY_CODE = Object.fromEntries(
  SYMBOL_OPTIONS.map((option) => [option.value, option.price]),
) as Record<SymbolCode, number>;

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "safe",
    label: "Protected BNB swing",
    shortLabel: "Safe trade",
    summary: "Flat account, modest size, and contained downside.",
    presetId: "flat",
    symbol: "BNBUSDT",
    side: "long",
    positionNotionalUsd: 1800,
    leverage: 4,
    baseShockPct: -3,
    expectedStatus: "safe",
  },
  {
    id: "caution",
    label: "Oversized ETH setup",
    shortLabel: "Needs adjustment",
    summary: "Tradable, but it should be tightened before execution.",
    presetId: "flat",
    symbol: "ETHUSDT",
    side: "long",
    positionNotionalUsd: 9000,
    leverage: 8.5,
    baseShockPct: -7,
    expectedStatus: "caution",
  },
  {
    id: "danger",
    label: "Stacked majors blow-up",
    shortLabel: "Unsafe - reject",
    summary: "High leverage on top of an already loaded book.",
    presetId: "btc-heavy",
    symbol: "ETHUSDT",
    side: "long",
    positionNotionalUsd: 5200,
    leverage: 20,
    baseShockPct: -4,
    expectedStatus: "danger",
  },
];

function parsePositiveNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSignedNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function scoreTone(score: number): string {
  if (score >= 75) return "var(--ok)";
  if (score >= 48) return "var(--warn)";
  return "var(--bad)";
}

function assistantHeadline(status: "safe" | "caution" | "danger"): string {
  if (status === "safe") return "The setup fits your policy and the downside looks contained.";
  if (status === "caution") return "This is close, but the trade should be tightened before it goes through.";
  return "This setup is too aggressive for the current account context.";
}

function verdictHeading(status: "safe" | "caution" | "danger"): string {
  if (status === "safe") return "SAFE TO PLACE";
  if (status === "caution") return "NEEDS ADJUSTMENT";
  return "UNSAFE - DO NOT PLACE";
}

function verdictSymbol(status: "safe" | "caution" | "danger"): string {
  if (status === "safe") return "OK";
  if (status === "caution") return "!";
  return "X";
}

function setupHeading(status: "safe" | "caution" | "danger"): string {
  if (status === "safe") return "Approved setup";
  return "Safer setup";
}

function saferSetupMessage(trade: { leverage: number; positionNotionalUsd: number }, analysis: RiskAnalysis): string {
  const leverageReduced = analysis.saferSetup.leverage < trade.leverage - 0.1;
  const sizeReduced = analysis.saferSetup.positionNotionalUsd < trade.positionNotionalUsd - 1;

  if (analysis.status === "safe") {
    return "This version already fits the current guardrails and keeps the downside clearly defined.";
  }

  if (leverageReduced && !sizeReduced) {
    return "The main fix here is reduced leverage, not smaller size. This revision lowers the biggest risk trigger while keeping the trade structure intact.";
  }

  if (!leverageReduced && sizeReduced) {
    return "The main fix here is smaller size. This version fits the current guardrails by cutting the risk budget back inside policy.";
  }

  if (leverageReduced && sizeReduced) {
    return "This version fits the current guardrails by lowering leverage and trimming size before the order is sent.";
  }

  return "This version fits the current guardrails by preserving defined downside and removing the biggest risk trigger.";
}

function breakdownToggleLabel(status: "safe" | "caution" | "danger"): string {
  if (status === "safe") return "View full risk details";
  return "See why this trade was flagged";
}

function curateRecommendations(
  trade: { leverage: number; positionNotionalUsd: number },
  analysis: RiskAnalysis,
): string[] {
  const source = analysis.recommendations;
  const actions: string[] = [];
  const leverageReduced = analysis.saferSetup.leverage < trade.leverage - 0.1;
  const sizeReduced = analysis.saferSetup.positionNotionalUsd < trade.positionNotionalUsd - 1;
  const wantsLeverage = source.some((item) => /reduce leverage|lower leverage/i.test(item));
  const wantsStop = source.some((item) => /stop-loss/i.test(item));
  const wantsResize = source.some((item) => /cut notional|trade smaller|trim size/i.test(item));
  const wantsWait = source.some((item) => /wait/i.test(item));
  const wantsCorrelation = source.some((item) => /correlated|stacking/i.test(item));

  if (analysis.status === "safe") {
    return ["Place as planned if the stop-loss stays unchanged."];
  }

  if (wantsLeverage || leverageReduced) {
    actions.push(`Reduce leverage to ${analysis.saferSetup.leverage}x or lower.`);
  }

  if (wantsResize && wantsWait) {
    actions.push(
      sizeReduced
        ? `Wait or resize to about ${formatUsd(analysis.saferSetup.positionNotionalUsd)} if daily drawdown stays elevated.`
        : "Wait or resize if daily drawdown stays elevated.",
    );
  } else if (wantsResize || sizeReduced) {
    actions.push(
      sizeReduced
        ? `Cut notional to about ${formatUsd(analysis.saferSetup.positionNotionalUsd)}.`
        : "Resize the trade before sending it.",
    );
  } else if (wantsWait) {
    actions.push("Wait or resize if daily drawdown stays elevated.");
  }

  if (wantsStop) {
    actions.push(`Use a stop-loss near ${formatUsd(analysis.saferSetup.stopLossPrice)}.`);
  }

  if (wantsCorrelation && !actions.some((item) => /notional|resize/i.test(item))) {
    actions.push("Avoid stacking another correlated position into this book.");
  }

  if (actions.length === 0) {
    actions.push(
      source[0]
        ?.replace(/^Resize or avoid stacking another correlated position\.$/, "Avoid stacking another correlated position into this book.")
        .replace(/^Wait or resize while daily drawdown stays elevated\.$/, "Wait or resize if daily drawdown stays elevated.")
        .replace(/^Reduce leverage until the shock test clears\.$/, `Reduce leverage to ${analysis.saferSetup.leverage}x or lower.`)
        .replace(/^This setup is within policy\. Keep the stop-loss unchanged\.$/, "Place as planned if the stop-loss stays unchanged.")
        ?? "Review the safer setup before sending the order.",
    );
  }

  return Array.from(new Set(actions)).slice(0, 2);
}

export function RiskCopilotWorkbench() {
  const tradeSectionRef = useRef<HTMLElement | null>(null);
  const verdictSectionRef = useRef<HTMLElement | null>(null);

  const [presetId, setPresetId] = useState<PortfolioPresetId>("btc-heavy");
  const preset = PORTFOLIO_PRESETS[presetId];

  const [walletBalanceUsd, setWalletBalanceUsd] = useState(String(preset.walletBalanceUsd));
  const [dailyPnlUsd, setDailyPnlUsd] = useState(String(preset.dailyPnlUsd));

  const [maxLeverage, setMaxLeverage] = useState("8");
  const [maxRiskPerTradePct, setMaxRiskPerTradePct] = useState("1.5");
  const [maxDailyDrawdownPct, setMaxDailyDrawdownPct] = useState("6");
  const [maxCorrelatedExposurePct, setMaxCorrelatedExposurePct] = useState("180");
  const [requireStopLoss, setRequireStopLoss] = useState(true);

  const [symbol, setSymbol] = useState<SymbolCode>("ETHUSDT");
  const [side, setSide] = useState<Side>("long");
  const [entryPrice, setEntryPrice] = useState(String(SYMBOL_OPTIONS.find((option) => option.value === "ETHUSDT")?.price ?? 2460));
  const [positionNotionalUsd, setPositionNotionalUsd] = useState("5200");
  const [leverage, setLeverage] = useState("20");
  const [stopLossPrice, setStopLossPrice] = useState(String(defaultStopPrice("ETHUSDT", "long")));
  const [baseShockPct, setBaseShockPct] = useState("-4");
  const [activeScenarioId, setActiveScenarioId] = useState<DemoScenarioId | null>(null);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [reviewSequence, setReviewSequence] = useState(0);

  useEffect(() => {
    setWalletBalanceUsd(String(preset.walletBalanceUsd));
    setDailyPnlUsd(String(preset.dailyPnlUsd));
  }, [preset]);

  useEffect(() => {
    const selected = SYMBOL_OPTIONS.find((option) => option.value === symbol);
    const nextEntry = selected?.price ?? 1;
    setEntryPrice(String(nextEntry));
    setStopLossPrice(String(defaultStopPrice(symbol, side, nextEntry)));
  }, [side, symbol]);

  useEffect(() => {
    if (!hasReviewed || reviewSequence === 0) return;

    const frame = window.requestAnimationFrame(() => {
      verdictSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [hasReviewed, reviewSequence]);

  const resolvedWalletBalance = parsePositiveNumber(walletBalanceUsd, preset.walletBalanceUsd);
  const resolvedDailyPnl = parseSignedNumber(dailyPnlUsd, preset.dailyPnlUsd);
  const resolvedPolicy = {
    maxLeverage: parsePositiveNumber(maxLeverage, 8),
    maxRiskPerTradePct: parsePositiveNumber(maxRiskPerTradePct, 1.5),
    maxDailyDrawdownPct: parsePositiveNumber(maxDailyDrawdownPct, 6),
    requireStopLoss,
    maxCorrelatedExposurePct: parsePositiveNumber(maxCorrelatedExposurePct, 180),
  };
  const resolvedTrade = {
    symbol,
    side,
    entryPrice: parsePositiveNumber(entryPrice, 1),
    positionNotionalUsd: parsePositiveNumber(positionNotionalUsd, 1000),
    leverage: parsePositiveNumber(leverage, 1),
    stopLossPrice: stopLossPrice.trim() ? parsePositiveNumber(stopLossPrice, 0) : null,
    baseShockPct: parseSignedNumber(baseShockPct, -4),
  };

  const analysis = analyzeTrade(
    {
      walletBalanceUsd: resolvedWalletBalance,
      dailyPnlUsd: resolvedDailyPnl,
      presetId,
      positions: preset.positions,
    },
    resolvedPolicy,
    resolvedTrade,
  );

  const visibleReasons = (analysis.findings.filter((finding) => finding.level !== "good").length > 0
    ? analysis.findings.filter((finding) => finding.level !== "good")
    : analysis.findings
  ).slice(0, 3);
  const recommendationPreview = curateRecommendations(resolvedTrade, analysis);
  const currentDrawdownPct = Math.max(0, (-resolvedDailyPnl / resolvedWalletBalance) * 100);
  const drawdownAfterTradePct = currentDrawdownPct + (analysis.proposedRiskPct ?? 0);
  const activeScenario = DEMO_SCENARIOS.find((scenario) => scenario.id === activeScenarioId) ?? null;

  function scrollToTrade() {
    tradeSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToVerdict() {
    verdictSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function reviewTrade() {
    setHasReviewed(true);
    setReviewSequence((value) => value + 1);
  }

  function loadScenario(scenario: DemoScenario) {
    const nextPreset = PORTFOLIO_PRESETS[scenario.presetId];
    const nextPrice = SYMBOL_PRICE_BY_CODE[scenario.symbol];

    setActiveScenarioId(scenario.id);
    setPresetId(scenario.presetId);
    setWalletBalanceUsd(String(nextPreset.walletBalanceUsd));
    setDailyPnlUsd(String(nextPreset.dailyPnlUsd));
    setMaxLeverage("8");
    setMaxRiskPerTradePct("1.5");
    setMaxDailyDrawdownPct("6");
    setMaxCorrelatedExposurePct("180");
    setRequireStopLoss(true);
    setSymbol(scenario.symbol);
    setSide(scenario.side);
    setEntryPrice(String(nextPrice));
    setPositionNotionalUsd(String(scenario.positionNotionalUsd));
    setLeverage(String(scenario.leverage));
    setStopLossPrice(String(defaultStopPrice(scenario.symbol, scenario.side, nextPrice)));
    setBaseShockPct(String(scenario.baseShockPct));
    setHasReviewed(true);
  }

  return (
    <section className="riskWorkbench">
      <section className="heroStage">
        <div className="heroPanel">
          <span className="eyebrow">Binance Futures pre-trade assistant</span>
          <div className="heroCopy">
            <p className="heroKicker">OpenClaw risk review</p>
            <h2>Enter a trade. Get a risk review before you place it.</h2>
            <p className="heroLead">
              Binance Risk Copilot checks your size, leverage, exposure, and downside before you hit confirm.
            </p>
          </div>

          <div className="heroActions">
            <button type="button" className="buttonPrimary heroPrimaryAction" onClick={scrollToTrade}>
              Review a trade
            </button>
            <p className="heroHelper">Enter a Futures trade and get the verdict before you confirm.</p>
          </div>

          <div className="heroScenarioBlock" id="hero-scenarios">
            <div className="heroScenarioHeader">
              <strong>Try example scenarios</strong>
              <span>Start here if you want the full product value in under 10 seconds.</span>
            </div>
            <div className="heroScenarioGrid">
              {DEMO_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  className={`heroScenarioButton heroScenarioButton-${scenario.expectedStatus} ${activeScenarioId === scenario.id ? "isActive" : ""}`}
                  onClick={() => loadScenario(scenario)}
                >
                  <span className={`riskStatus riskStatus-${scenario.expectedStatus}`}>{scenario.shortLabel}</span>
                  <strong>{scenario.label}</strong>
                  <span>{scenario.summary}</span>
                </button>
              ))}
            </div>
            <p className="heroScenarioNote">Try a demo scenario, or scroll down to enter your own trade.</p>

            {activeScenario && hasReviewed ? (
              <article className={`scenarioVerdictPreview scenarioVerdictPreview-${analysis.status}`}>
                <div className="scenarioVerdictTop">
                  <div className="scenarioVerdictCopy">
                    <span className={`riskStatus riskStatus-${analysis.status}`}>{statusLabel(analysis.status)}</span>
                    <strong>{activeScenario.label}</strong>
                    <p>{analysis.summary}</p>
                  </div>
                  <div className="scenarioVerdictScore">
                    <strong style={{ color: scoreTone(analysis.score) }}>{analysis.score}</strong>
                    <span>risk score</span>
                  </div>
                </div>

                <div className="scenarioVerdictSetup">
                  <div className="setupMetric">
                    <span>Leverage</span>
                    <strong>{analysis.saferSetup.leverage}x</strong>
                  </div>
                  <div className="setupMetric">
                    <span>Notional</span>
                    <strong>{formatUsd(analysis.saferSetup.positionNotionalUsd)}</strong>
                  </div>
                  <div className="setupMetric">
                    <span>Stop-loss</span>
                    <strong>{formatUsd(analysis.saferSetup.stopLossPrice)}</strong>
                  </div>
                </div>

                <div className="scenarioVerdictActions">
                  <p>{saferSetupMessage(resolvedTrade, analysis)}</p>
                  <button type="button" className="buttonGhost" onClick={scrollToVerdict}>
                    Open full review
                  </button>
                </div>
              </article>
            ) : null}
          </div>
        </div>
      </section>

      <section className="storyNote" id="how-it-works">
        <span className="sectionStep">How it works</span>
        <p>
          Paste a planned Binance Futures trade. The copilot checks leverage, sizing, concentration, and downside against
          your account context. Then it tells you whether the trade fits policy or shows the safer setup to use instead.
        </p>
      </section>

      <section className="flowSection tradeStage" id="planned-trade" ref={tradeSectionRef}>
        <div className="sectionIntro">
              <span className="sectionStep">Step 1</span>
              <div>
                <h3>Planned trade</h3>
                <p>Set the trade you want to place, then review it.</p>
              </div>
            </div>

        <form
          className="tradeCard"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            reviewTrade();
          }}
        >
          <div className="tradeContextStrip">
            <div className="contextChip">
              <span>Portfolio</span>
              <strong>{preset.label}</strong>
            </div>
            <div className="contextChip">
              <span>Wallet</span>
              <strong>{formatUsd(resolvedWalletBalance)}</strong>
            </div>
            <div className="contextChip">
              <span>Today&apos;s PnL</span>
              <strong>{formatUsd(resolvedDailyPnl)}</strong>
            </div>
          </div>

          <div className="tradeGrid">
            <label className="field">
              <span>Symbol</span>
              <select
                value={symbol}
                onChange={(event) => {
                  setActiveScenarioId(null);
                  setSymbol(event.target.value as SymbolCode);
                }}
              >
                {SYMBOL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="field">
              <span>Direction</span>
              <div className="segmentedControl" role="group" aria-label="Direction">
                <button
                  type="button"
                  className={`segmentButton ${side === "long" ? "isActive" : ""}`}
                  onClick={() => {
                    setActiveScenarioId(null);
                    setSide("long");
                  }}
                >
                  Long
                </button>
                <button
                  type="button"
                  className={`segmentButton ${side === "short" ? "isActive" : ""}`}
                  onClick={() => {
                    setActiveScenarioId(null);
                    setSide("short");
                  }}
                >
                  Short
                </button>
              </div>
            </div>

            <label className="field">
              <span>Entry price</span>
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                value={entryPrice}
                onChange={(event) => {
                  setActiveScenarioId(null);
                  setEntryPrice(event.target.value);
                }}
              />
            </label>

            <label className="field">
              <span>Notional size (USD)</span>
              <input
                type="number"
                min="50"
                step="50"
                value={positionNotionalUsd}
                onChange={(event) => {
                  setActiveScenarioId(null);
                  setPositionNotionalUsd(event.target.value);
                }}
              />
            </label>

            <label className="field">
              <span>Leverage</span>
              <input
                type="number"
                min="1"
                step="0.5"
                value={leverage}
                onChange={(event) => {
                  setActiveScenarioId(null);
                  setLeverage(event.target.value);
                }}
              />
            </label>

            <label className="field">
              <span>Stop-loss (optional)</span>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={stopLossPrice}
                onChange={(event) => {
                  setActiveScenarioId(null);
                  setStopLossPrice(event.target.value);
                }}
              />
            </label>
          </div>

          <button type="submit" className="buttonPrimary reviewTradeButton">
            Review this trade
          </button>

          <details className="detailsCard">
            <summary className="detailsSummary">
              <span>Advanced settings</span>
              <span>Policy, wallet context, and stress assumptions</span>
            </summary>

            <div className="detailsBody">
              <div className="advancedGrid">
                <article className="miniPanel">
                  <div className="miniPanelHeader">
                    <strong>Account context</strong>
                    <span>Used to calculate drawdown and exposure.</span>
                  </div>
                  <div className="miniFieldGrid">
                    <label className="field">
                      <span>Portfolio profile</span>
                      <select
                        value={presetId}
                        onChange={(event) => {
                          setActiveScenarioId(null);
                          setPresetId(event.target.value as PortfolioPresetId);
                        }}
                      >
                        {Object.entries(PORTFOLIO_PRESETS).map(([value, item]) => (
                          <option key={value} value={value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Wallet balance (USD)</span>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={walletBalanceUsd}
                        onChange={(event) => {
                          setActiveScenarioId(null);
                          setWalletBalanceUsd(event.target.value);
                        }}
                      />
                    </label>
                    <label className="field">
                      <span>Today&apos;s realized PnL (USD)</span>
                      <input
                        type="number"
                        step="10"
                        value={dailyPnlUsd}
                        onChange={(event) => {
                          setActiveScenarioId(null);
                          setDailyPnlUsd(event.target.value);
                        }}
                      />
                    </label>
                  </div>
                </article>

                <article className="miniPanel">
                  <div className="miniPanelHeader">
                    <strong>Risk policy</strong>
                    <span>These guardrails decide whether the trade goes through.</span>
                  </div>
                  <div className="miniFieldGrid">
                    <label className="field">
                      <span>Max leverage</span>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={maxLeverage}
                        onChange={(event) => {
                          setActiveScenarioId(null);
                          setMaxLeverage(event.target.value);
                        }}
                      />
                    </label>
                    <label className="field">
                      <span>Max risk / trade (%)</span>
                      <input
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={maxRiskPerTradePct}
                        onChange={(event) => {
                          setActiveScenarioId(null);
                          setMaxRiskPerTradePct(event.target.value);
                        }}
                      />
                    </label>
                    <label className="field">
                      <span>Max daily drawdown (%)</span>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={maxDailyDrawdownPct}
                        onChange={(event) => {
                          setActiveScenarioId(null);
                          setMaxDailyDrawdownPct(event.target.value);
                        }}
                      />
                    </label>
                    <label className="field">
                      <span>Max correlated exposure (%)</span>
                      <input
                        type="number"
                        min="50"
                        step="10"
                        value={maxCorrelatedExposurePct}
                        onChange={(event) => {
                          setActiveScenarioId(null);
                          setMaxCorrelatedExposurePct(event.target.value);
                        }}
                      />
                    </label>
                  </div>

                  <label className="toggleRow">
                    <input
                      type="checkbox"
                      checked={requireStopLoss}
                      onChange={(event) => {
                        setActiveScenarioId(null);
                        setRequireStopLoss(event.target.checked);
                      }}
                    />
                    <span>Require a stop-loss before any Futures order is allowed through.</span>
                  </label>
                </article>

                <article className="miniPanel">
                  <div className="miniPanelHeader">
                    <strong>Shock test</strong>
                    <span>Keep this hidden for judges unless you want the deeper story.</span>
                  </div>
                  <label className="field">
                    <span>BTC stress move (%)</span>
                    <input
                      type="range"
                      min="-8"
                      max="-1"
                      step="0.5"
                      value={baseShockPct}
                      onChange={(event) => {
                        setActiveScenarioId(null);
                        setBaseShockPct(event.target.value);
                      }}
                    />
                    <div className="rangeMeta">
                      <span>Stress assumption</span>
                      <strong>{baseShockPct}% BTC</strong>
                    </div>
                  </label>
                </article>
              </div>
            </div>
          </details>
        </form>
      </section>

      {hasReviewed ? (
        <>
          <section className="flowSection verdictStage" id="risk-verdict" ref={verdictSectionRef}>
            <div className="sectionIntro">
              <span className="sectionStep">Step 2</span>
              <div>
                <h3>Risk verdict</h3>
                <p>See whether the trade fits policy, needs tightening, or should be rejected.</p>
              </div>
            </div>

            <article className={`verdictCard verdictCard-${analysis.status}`}>
              <div className="verdictTopbar">
                <div className="verdictLead">
                  <p className="verdictEyebrow">OpenClaw assistant review</p>
                  <div className="verdictTitleRow">
                    <span className={`verdictSymbol verdictSymbol-${analysis.status}`}>{verdictSymbol(analysis.status)}</span>
                    <div>
                      <h2>{verdictHeading(analysis.status)}</h2>
                      <p className="verdictPrompt">
                        Reviewing {resolvedTrade.side} {resolvedTrade.symbol} at {formatUsd(resolvedTrade.entryPrice)} with{" "}
                        {formatUsd(resolvedTrade.positionNotionalUsd)} notional and {resolvedTrade.leverage}x leverage.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="verdictScoreBlock">
                  <span className={`riskStatus riskStatus-${analysis.status}`}>{statusLabel(analysis.status)}</span>
                  <div className="scoreDisplay">
                    <strong style={{ color: scoreTone(analysis.score) }}>{analysis.score}</strong>
                    <span>/ 100</span>
                  </div>
                </div>
              </div>

              <div className="verdictMainGrid">
                <div className="verdictNarrative">
                  <strong className="assistantHeadline">{assistantHeadline(analysis.status)}</strong>
                  <p className="assistantSummary">{analysis.summary}</p>
                </div>

                <div className="verdictReasonCard">
                  <span className="summaryLabel">Top reasons</span>
                  <ul className="reasonList">
                    {visibleReasons.map((finding) => (
                      <li key={`${finding.title}-${finding.level}`} className={`reasonItem reasonItem-${finding.level}`}>
                        <strong className="reasonTitle">{finding.title}</strong>
                        <span className="reasonBody">{finding.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="verdictMetrics">
                <div className="metricTile">
                  <span>Max loss</span>
                  <strong>{formatUsd(analysis.proposedRiskUsd)}</strong>
                </div>
                <div className="metricTile">
                  <span>Drawdown used</span>
                  <strong>{formatPct(drawdownAfterTradePct)}</strong>
                </div>
                <div className="metricTile">
                  <span>Correlated exposure</span>
                  <strong>{formatPct(analysis.portfolioExposurePct)}</strong>
                </div>
              </div>
            </article>
          </section>

          <section className="flowSection saferStage">
            <div className="sectionIntro">
              <span className="sectionStep">Step 3</span>
              <div>
                <h3>{setupHeading(analysis.status)}</h3>
                <p>The copilot shows the safer version instead of only blocking the trade.</p>
              </div>
            </div>

            <article className="saferSetupCard">
              <div className="saferSetupHighlight">
                <div className="saferSetupHeader">
                  <span className="eyebrow">Recommended revision</span>
                  <p>{saferSetupMessage(resolvedTrade, analysis)}</p>
                </div>

                <div className="saferSetupGrid">
                  <div className="setupMetric">
                    <span>Recommended leverage</span>
                    <strong>{analysis.saferSetup.leverage}x</strong>
                  </div>
                  <div className="setupMetric">
                    <span>Recommended notional</span>
                    <strong>{formatUsd(analysis.saferSetup.positionNotionalUsd)}</strong>
                  </div>
                  <div className="setupMetric">
                    <span>Recommended stop-loss</span>
                    <strong>{formatUsd(analysis.saferSetup.stopLossPrice)}</strong>
                  </div>
                  <div className="setupMetric">
                    <span>Max loss</span>
                    <strong>{formatUsd(analysis.saferSetup.maxLossUsd)}</strong>
                  </div>
                </div>
              </div>

              <div className="actionPanel">
                <span className="summaryLabel">Recommended actions</span>
                <ul className="recommendationList">
                  {recommendationPreview.map((recommendation) => (
                    <li key={recommendation}>{recommendation}</li>
                  ))}
                </ul>
              </div>
            </article>

            <details className="detailsCard">
              <summary className="detailsSummary">
                <span>{breakdownToggleLabel(analysis.status)}</span>
                <span>Policy, positions, shock test, and the guardrails behind the verdict.</span>
              </summary>

              <div className="detailsBody">
                <div className="breakdownGrid">
                  <article className="miniPanel">
                    <div className="miniPanelHeader">
                      <strong>Account policy</strong>
                      <span>The guardrails used for this review.</span>
                    </div>
                    <div className="metricGrid">
                      <div className="metricTile">
                        <span>Max leverage</span>
                        <strong>{resolvedPolicy.maxLeverage}x</strong>
                      </div>
                      <div className="metricTile">
                        <span>Risk / trade</span>
                        <strong>{resolvedPolicy.maxRiskPerTradePct}%</strong>
                      </div>
                      <div className="metricTile">
                        <span>Daily drawdown</span>
                        <strong>{resolvedPolicy.maxDailyDrawdownPct}%</strong>
                      </div>
                      <div className="metricTile">
                        <span>Correlated cap</span>
                        <strong>{resolvedPolicy.maxCorrelatedExposurePct}%</strong>
                      </div>
                    </div>
                  </article>

                  <article className="miniPanel">
                    <div className="miniPanelHeader">
                      <strong>Portfolio snapshot</strong>
                      <span>These positions are what drive the exposure guard.</span>
                    </div>
                    <div className="positionList">
                      {preset.positions.length === 0 ? (
                        <p className="muted">Flat account. Correlation stays quiet unless a new book is loaded.</p>
                      ) : (
                        preset.positions.map((position) => (
                          <div key={`${position.symbol}-${position.side}`} className="positionRow">
                            <div>
                              <strong>{position.symbol}</strong>
                              <span>{position.side}</span>
                            </div>
                            <div>
                              <strong>{formatUsd(position.notionalUsd)}</strong>
                              <span>{position.leverage}x</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </article>

                  <article className="miniPanel">
                    <div className="miniPanelHeader">
                      <strong>Correlation details</strong>
                      <span>How stacked this trade becomes once it is added to the book.</span>
                    </div>
                    <div className="metricGrid">
                      <div className="metricTile">
                        <span>Projected exposure</span>
                        <strong>{formatPct(analysis.portfolioExposurePct)}</strong>
                      </div>
                      <div className="metricTile">
                        <span>Preset</span>
                        <strong>{preset.label}</strong>
                      </div>
                    </div>
                  </article>

                  <article className="miniPanel">
                    <div className="miniPanelHeader">
                      <strong>Shock test</strong>
                      <span>A BTC-led move mapped into this symbol and the current book.</span>
                    </div>
                    <div className="metricGrid">
                      <div className="metricTile">
                        <span>Modeled move in {symbol}</span>
                        <strong>{analysis.symbolShockPct}%</strong>
                      </div>
                      <div className="metricTile">
                        <span>Portfolio PnL</span>
                        <strong>{formatUsd(analysis.portfolioShockPnlUsd)}</strong>
                      </div>
                      <div className="metricTile">
                        <span>Post-shock equity</span>
                        <strong>{formatUsd(analysis.postShockEquityUsd)}</strong>
                      </div>
                      <div className="metricTile">
                        <span>Liquidation buffer</span>
                        <strong>{analysis.liquidationBufferPct}%</strong>
                      </div>
                    </div>
                    <div className={`shockBanner ${analysis.shockBreachesLiquidation ? "shockBanner-danger" : "shockBanner-safe"}`}>
                      <strong>
                        {analysis.shockBreachesLiquidation
                          ? "Shock test threatens liquidation."
                          : "Shock test stays inside the liquidation buffer."}
                      </strong>
                      <span>Current modeled liquidation price is {formatUsd(analysis.liquidationPrice)}.</span>
                    </div>
                  </article>

                  <article className="miniPanel breakdownWide">
                    <div className="miniPanelHeader">
                      <strong>Full findings list</strong>
                      <span>The detailed guardrail-by-guardrail explanation.</span>
                    </div>
                    <div className="findingList">
                      {analysis.findings.map((finding) => (
                        <div key={`${finding.title}-${finding.level}`} className={`findingCard findingCard-${finding.level}`}>
                          <div className="findingTop">
                            <strong>{finding.title}</strong>
                            <span>{finding.level}</span>
                          </div>
                          <p>{finding.detail}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              </div>
            </details>
          </section>
        </>
      ) : null}

      <section className="demoCallout">
        <div>
          <span className="sectionStep">Demo ready</span>
          <p>Pick a scenario for instant proof, or use the form to stage your own Binance Futures trade.</p>
        </div>
        {activeScenario ? <span className={`riskStatus riskStatus-${activeScenario.expectedStatus}`}>Loaded: {activeScenario.label}</span> : null}
      </section>
    </section>
  );
}
