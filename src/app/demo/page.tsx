export default function DemoPage() {
  return (
    <section className="demoPage">
      <div className="demoHero">
        <span className="eyebrow">Demo Story</span>
        <h2>30-second judge flow</h2>
        <p>
          This route is the spoken walkthrough for the submission video. Keep the product demo focused on one unsafe ETH
          trade, one assistant verdict, and one safer recommendation.
        </p>
      </div>

      <div className="demoGrid">
        <article className="panel">
          <div className="panelHeader">
            <div>
              <h3>Scene order</h3>
              <p className="muted">This is the shortest credible sequence for the MVP.</p>
            </div>
            <span className="badge badgeOk">4 beats</span>
          </div>
          <ol className="demoList">
            <li>Load the BTC-heavy account preset and show existing open exposure.</li>
            <li>Stage an aggressive ETH long with high leverage and a loose stop.</li>
            <li>Let the assistant flag leverage, correlated exposure, and shock-test pressure.</li>
            <li>Show the safer setup block with reduced size, lower leverage, and a tighter stop-loss.</li>
          </ol>
        </article>

        <article className="panel">
          <div className="panelHeader">
            <div>
              <h3>Voiceover</h3>
              <p className="muted">Use plain product language, not quant language.</p>
            </div>
            <span className="badge badgeWarn">Keep it tight</span>
          </div>
          <ol className="demoList">
            <li>This is Binance Risk Copilot, an OpenClaw assistant for Binance Futures.</li>
            <li>Before an order is submitted, it reviews the trade against account-level risk policy.</li>
            <li>Here the user is already long risk, so the new ETH trade breaches leverage and concentration limits.</li>
            <li>The assistant explains the problem and proposes a safer setup instead of just blocking the user.</li>
          </ol>
        </article>

        <article className="panel">
          <div className="panelHeader">
            <div>
              <h3>Judge checklist</h3>
              <p className="muted">What the product should clearly communicate on screen.</p>
            </div>
            <span className="badge badgeInfo">MVP scope</span>
          </div>
          <ul className="demoChecklist">
            <li>Assistant-first workflow instead of a passive dashboard.</li>
            <li>Binance-specific Futures framing: leverage, stop-loss, liquidation, exposure.</li>
            <li>Concrete user value: catch preventable mistakes before execution.</li>
            <li>One visible recommendation block the user can act on immediately.</li>
          </ul>
        </article>
      </div>
    </section>
  );
}
