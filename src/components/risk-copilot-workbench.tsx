"use client";

import { useEffect, useState } from "react";
import {
  PORTFOLIO_PRESETS,
  SYMBOL_OPTIONS,
  analyzeTrade,
  defaultStopPrice,
  formatPct,
  formatUsd,
  statusLabel,
  type PortfolioPresetId,
  type Side,
  type SymbolCode,
} from "@/lib/risk-copilot";

type DemoScenarioId = "safe" | "caution" | "danger";

type DemoScenario = {
  id: DemoScenarioId;
  label: string;
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
    summary: "Flat account, modest size, contained downside. This is the quick green-light demo.",
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
    summary: "Still tradable, but the assistant should ask for tighter sizing before execution.",
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
    summary: "High leverage on top of an already loaded book. This is the red reject state.",
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
  if (status === "safe") return "Within policy. This trade can go through.";
  if (status === "caution") return "Tradable, but tighten the setup before sending.";
  return "Do not send this setup as-is.";
}

export function RiskCopilotWorkbench() {
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
  const [activeScenarioId, setActiveScenarioId] = useState<DemoScenarioId>("danger");

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

  const dialStyle = {
    background: `conic-gradient(${scoreTone(analysis.score)} ${analysis.score * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
  };
  const verdictLabel = statusLabel(analysis.status);
  const userPrompt = `Review this ${resolvedTrade.side} ${resolvedTrade.symbol} Futures order: ${formatUsd(
    resolvedTrade.positionNotionalUsd,
  )} notional at ${resolvedTrade.leverage}x, entry ${formatUsd(resolvedTrade.entryPrice)}, ${
    resolvedTrade.stopLossPrice == null ? "no stop-loss" : `stop ${formatUsd(resolvedTrade.stopLossPrice)}`
  }.`;
  const flaggedFindings = analysis.findings.filter((finding) => finding.level !== "good");
  const visibleTags = flaggedFindings.length > 0 ? flaggedFindings : analysis.findings.slice(0, 2);
  const activeScenario = DEMO_SCENARIOS.find((scenario) => scenario.id === activeScenarioId) ?? DEMO_SCENARIOS[2];

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
  }

  return (
    <section className="riskWorkbench">
      <div className="riskHero">
        <div className="riskHeroCopy">
          <span className="eyebrow">OpenClaw MVP</span>
          <h2>Binance Risk Copilot</h2>
          <p className="leadText">
            An assistant-first Futures review flow: set your risk policy, stage a trade, and see whether the account should
            allow it through, trim it, or reject it.
          </p>

          <div className="heroBulletGrid">
            <div className="heroBullet">
              <strong>Trade Check</strong>
              <span>Tests leverage, risk-to-stop, and daily drawdown headroom before execution.</span>
            </div>
            <div className="heroBullet">
              <strong>Exposure Guard</strong>
              <span>Flags hidden concentration when the new trade stacks into existing correlated positions.</span>
            </div>
            <div className="heroBullet">
              <strong>Shock Test</strong>
              <span>Models a BTC-led move and shows the expected hit to equity and liquidation pressure.</span>
            </div>
          </div>
        </div>

        <div className="riskScoreCard">
          <div className={`riskStatus riskStatus-${analysis.status}`}>{statusLabel(analysis.status)}</div>
          <div className="scoreDial" style={dialStyle}>
            <div className="scoreDialInner">
              <span className="scoreNumber">{analysis.score}</span>
              <span className="scoreLabel">risk score</span>
            </div>
          </div>
          <p>{analysis.summary}</p>
        </div>
      </div>

      <div className="riskSummaryGrid">
        <article className="summaryTile">
          <span className="summaryLabel">Portfolio preset</span>
          <strong>{preset.label}</strong>
          <p>{preset.positions.length === 0 ? "No open positions." : `${preset.positions.length} live positions loaded for exposure checks.`}</p>
        </article>
        <article className="summaryTile">
          <span className="summaryLabel">Projected max loss</span>
          <strong>{formatUsd(analysis.proposedRiskUsd)}</strong>
          <p>{analysis.proposedRiskPct == null ? "Requires a valid stop-loss." : `${formatPct(analysis.proposedRiskPct)} of wallet balance.`}</p>
        </article>
        <article className="summaryTile">
          <span className="summaryLabel">Correlated exposure</span>
          <strong>{formatPct(analysis.portfolioExposurePct)}</strong>
          <p>After this trade, same-bucket exposure reaches this level versus your policy cap.</p>
        </article>
        <article className="summaryTile">
          <span className="summaryLabel">Shock test</span>
          <strong>{formatUsd(analysis.portfolioShockPnlUsd)}</strong>
          <p>{analysis.shockBreachesLiquidation ? "Modeled move threatens liquidation." : `Post-shock equity: ${formatUsd(analysis.postShockEquityUsd)}.`}</p>
        </article>
      </div>

      <article className="workbenchCard scenarioPanel">
        <div className="cardHeader">
          <div>
            <h3>Demo scenarios</h3>
            <p className="muted">One click loads a judge-ready state so you can record the exact safe, caution, and danger flows.</p>
          </div>
          <span className={`verdictChip verdictChip-${activeScenario.expectedStatus}`}>{activeScenario.label}</span>
        </div>

        <div className="scenarioGrid">
          {DEMO_SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              className={`scenarioButton ${activeScenarioId === scenario.id ? "isActive" : ""}`}
              onClick={() => loadScenario(scenario)}
            >
              <span className={`riskStatus riskStatus-${scenario.expectedStatus}`}>{statusLabel(scenario.expectedStatus)}</span>
              <strong>{scenario.label}</strong>
              <span>{scenario.summary}</span>
            </button>
          ))}
        </div>
      </article>

      <div className="workbenchGrid">
        <div className="workbenchColumn">
          <article className="workbenchCard">
            <div className="cardHeader">
              <div>
                <h3>Account and policy</h3>
                <p className="muted">This defines the guardrails the assistant enforces.</p>
              </div>
            </div>

            <div className="fieldGrid">
              <label className="field">
                <span>Portfolio profile</span>
                <select value={presetId} onChange={(event) => setPresetId(event.target.value as PortfolioPresetId)}>
                  {Object.entries(PORTFOLIO_PRESETS).map(([value, item]) => (
                    <option key={value} value={value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Wallet balance (USD)</span>
                <input type="number" min="1" step="100" value={walletBalanceUsd} onChange={(event) => setWalletBalanceUsd(event.target.value)} />
              </label>
              <label className="field">
                <span>Today&apos;s realized PnL (USD)</span>
                <input type="number" step="10" value={dailyPnlUsd} onChange={(event) => setDailyPnlUsd(event.target.value)} />
              </label>
              <label className="field">
                <span>Max leverage</span>
                <input type="number" min="1" step="0.5" value={maxLeverage} onChange={(event) => setMaxLeverage(event.target.value)} />
              </label>
              <label className="field">
                <span>Max risk / trade (%)</span>
                <input type="number" min="0.25" step="0.25" value={maxRiskPerTradePct} onChange={(event) => setMaxRiskPerTradePct(event.target.value)} />
              </label>
              <label className="field">
                <span>Max daily drawdown (%)</span>
                <input type="number" min="1" step="0.5" value={maxDailyDrawdownPct} onChange={(event) => setMaxDailyDrawdownPct(event.target.value)} />
              </label>
              <label className="field">
                <span>Max correlated exposure (%)</span>
                <input type="number" min="50" step="10" value={maxCorrelatedExposurePct} onChange={(event) => setMaxCorrelatedExposurePct(event.target.value)} />
              </label>
            </div>

            <label className="toggleRow">
              <input type="checkbox" checked={requireStopLoss} onChange={(event) => setRequireStopLoss(event.target.checked)} />
              <span>Require a stop-loss before any Futures order is allowed through</span>
            </label>
          </article>

          <article className="workbenchCard">
            <div className="cardHeader">
              <div>
                <h3>Planned trade</h3>
                <p className="muted">Use this as the core demo interaction.</p>
              </div>
            </div>

            <div className="fieldGrid">
              <label className="field">
                <span>Symbol</span>
                <select value={symbol} onChange={(event) => setSymbol(event.target.value as SymbolCode)}>
                  {SYMBOL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Direction</span>
                <select value={side} onChange={(event) => setSide(event.target.value as Side)}>
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </label>
              <label className="field">
                <span>Entry price</span>
                <input type="number" min="0.0001" step="0.0001" value={entryPrice} onChange={(event) => setEntryPrice(event.target.value)} />
              </label>
              <label className="field">
                <span>Notional size (USD)</span>
                <input type="number" min="50" step="50" value={positionNotionalUsd} onChange={(event) => setPositionNotionalUsd(event.target.value)} />
              </label>
              <label className="field">
                <span>Leverage</span>
                <input type="number" min="1" step="0.5" value={leverage} onChange={(event) => setLeverage(event.target.value)} />
              </label>
              <label className="field">
                <span>Stop-loss price</span>
                <input type="number" min="0" step="0.0001" value={stopLossPrice} onChange={(event) => setStopLossPrice(event.target.value)} />
              </label>
              <label className="field fieldWide">
                <span>BTC shock scenario (%)</span>
                <input type="range" min="-8" max="-1" step="0.5" value={baseShockPct} onChange={(event) => setBaseShockPct(event.target.value)} />
                <div className="rangeMeta">
                  <span>Stress move</span>
                  <strong>{baseShockPct}% BTC</strong>
                </div>
              </label>
            </div>
          </article>

          <article className="workbenchCard">
            <div className="cardHeader">
              <div>
                <h3>Live portfolio snapshot</h3>
                <p className="muted">These preset positions are what make the correlation guard visible in a short demo.</p>
              </div>
            </div>

            <div className="positionList">
              {preset.positions.length === 0 ? (
                <p className="muted">Flat account. Exposure Guard will stay quiet unless you add correlated positions later.</p>
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
        </div>

        <div className="workbenchColumn">
          <article className="workbenchCard emphasisCard">
            <div className="cardHeader">
              <div>
                <h3>Assistant review</h3>
                <p className="muted">This is the assistant-first moment the user sees before the order is allowed through.</p>
              </div>
            </div>

            <div className="chatThread">
              <div className="chatBubble chatBubble-user">
                <span className="chatMeta">Trader</span>
                <p>{userPrompt}</p>
              </div>

              <div className="chatBubble chatBubble-assistant">
                <div className="chatBubbleTop">
                  <span className="chatMeta">OpenClaw</span>
                  <span className={`verdictChip verdictChip-${analysis.status}`}>{verdictLabel}</span>
                </div>
                <strong className="assistantHeadline">{assistantHeadline(analysis.status)}</strong>
                <p className="assistantSummary">{analysis.summary}</p>

                <ul className="assistantChecklist">
                  <li>Projected max loss is {formatUsd(analysis.proposedRiskUsd)} on a {formatUsd(resolvedWalletBalance)} wallet.</li>
                  <li>Same-bucket exposure reaches {formatPct(analysis.portfolioExposurePct)} if this trade is added.</li>
                  <li>
                    {analysis.shockBreachesLiquidation
                      ? `The ${resolvedTrade.baseShockPct}% BTC shock threatens liquidation on this setup.`
                      : `The ${resolvedTrade.baseShockPct}% BTC shock leaves post-shock equity at ${formatUsd(analysis.postShockEquityUsd)}.`}
                  </li>
                </ul>

                <div className="chatTagRow">
                  {visibleTags.map((finding) => (
                    <span key={`${finding.title}-${finding.level}`} className={`chatTag chatTag-${finding.level}`}>
                      {finding.title}
                    </span>
                  ))}
                </div>
              </div>
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

          <article className="workbenchCard">
            <div className="cardHeader">
              <div>
                <h3>Safer setup</h3>
                <p className="muted">Use this block as the “recommended revision” in the demo.</p>
              </div>
            </div>

            <div className="summaryMiniGrid">
              <div className="miniStat">
                <span>Leverage</span>
                <strong>{analysis.saferSetup.leverage}x</strong>
              </div>
              <div className="miniStat">
                <span>Notional</span>
                <strong>{formatUsd(analysis.saferSetup.positionNotionalUsd)}</strong>
              </div>
              <div className="miniStat">
                <span>Stop-loss</span>
                <strong>{formatUsd(analysis.saferSetup.stopLossPrice)}</strong>
              </div>
              <div className="miniStat">
                <span>Max loss</span>
                <strong>{formatUsd(analysis.saferSetup.maxLossUsd)}</strong>
              </div>
            </div>

            <ul className="recommendationList">
              {analysis.recommendations.map((recommendation) => (
                <li key={recommendation}>{recommendation}</li>
              ))}
            </ul>
          </article>

          <article className="workbenchCard">
            <div className="cardHeader">
              <div>
                <h3>Shock test</h3>
                <p className="muted">A BTC-led move is mapped into this symbol and the open book.</p>
              </div>
            </div>

            <div className="summaryMiniGrid">
              <div className="miniStat">
                <span>Modeled move in {symbol}</span>
                <strong>{analysis.symbolShockPct}%</strong>
              </div>
              <div className="miniStat">
                <span>Portfolio PnL</span>
                <strong>{formatUsd(analysis.portfolioShockPnlUsd)}</strong>
              </div>
              <div className="miniStat">
                <span>Post-shock equity</span>
                <strong>{formatUsd(analysis.postShockEquityUsd)}</strong>
              </div>
              <div className="miniStat">
                <span>Liquidation buffer</span>
                <strong>{analysis.liquidationBufferPct}%</strong>
              </div>
            </div>

            <div className={`shockBanner ${analysis.shockBreachesLiquidation ? "shockBanner-danger" : "shockBanner-safe"}`}>
              <strong>{analysis.shockBreachesLiquidation ? "Liquidation pressure is too high." : "The trade survives the modeled shock."}</strong>
              <span>
                Current modeled liquidation price is {formatUsd(analysis.liquidationPrice)} for the proposed trade.
              </span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
