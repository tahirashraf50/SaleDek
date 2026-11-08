const MAN_IMG = "/site/reports-man.png";

export function ReportsShowcase() {
  return (
    <div className="site-reports-stage relative mx-auto w-full max-w-lg">
      <div className="site-reports-glow" aria-hidden />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${MAN_IMG}?v=2`}
        alt="Team member reviewing CRM reports"
        className="site-anim-float relative z-10 mx-auto w-full object-contain drop-shadow-2xl"
      />

      <div className="site-report-card site-report-card-a" aria-hidden>
        <p className="site-report-card-label">Weekly report</p>
        <p className="site-report-card-value">+24.8%</p>
        <div className="site-report-bars">
          <span style={{ height: "42%" }} />
          <span style={{ height: "68%" }} />
          <span style={{ height: "54%" }} />
          <span style={{ height: "88%" }} />
          <span style={{ height: "72%" }} />
        </div>
      </div>

      <div className="site-report-card site-report-card-b" aria-hidden>
        <p className="site-report-card-label">Open tickets</p>
        <p className="site-report-card-value">128</p>
        <div className="site-report-spark">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="site-report-card site-report-card-c" aria-hidden>
        <p className="site-report-card-label">Revenue</p>
        <p className="site-report-card-value">$48.2k</p>
      </div>
    </div>
  );
}
