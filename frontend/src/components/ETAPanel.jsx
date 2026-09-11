import { CheckCircle2, Printer, Users } from "lucide-react";

function formatClockTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ETAPanel({ prediction, loading }) {
  if (loading || !prediction) {
    return (
      <section className="qa-eta qa-eta--loading">
        <p className="qa-eta__loading-text">Calculating your prediction…</p>
      </section>
    );
  }

  if (prediction.status === "completed") {
    return (
      <section className="qa-eta qa-visit-complete">
        <div className="qa-visit-complete__icon" aria-hidden="true">
          <CheckCircle2 size={22} strokeWidth={2} />
        </div>
        <div className="qa-visit-complete__body">
          <h2>Your visit is complete</h2>
          <p>Thanks for visiting today — your consultation has been marked done.</p>
        </div>
        <button type="button" className="qa-visit-complete__print" onClick={() => window.print()}>
          <Printer size={14} strokeWidth={2} />
          Save summary
        </button>
      </section>
    );
  }

  if (prediction.status === "serving") {
    return (
      <section className="qa-eta qa-eta--serving">
        <span className="qa-eta__pulse" aria-hidden="true" />
        <div>
          <h2>You're being seen now</h2>
          <p>The doctor has called your token — no further wait.</p>
        </div>
      </section>
    );
  }

  const confidencePct = Math.round(prediction.confidence * 100);

  return (
    <section className="qa-eta">
      <div className="qa-eta__row">
        <div className="qa-eta__block">
          <span className="qa-eta__label">
            <Users size={13} strokeWidth={2} aria-hidden="true" />
            Patients ahead
          </span>
          <span className="qa-eta__value">{prediction.patients_ahead}</span>
        </div>
        <div className="qa-eta__block">
          <span className="qa-eta__label">Predicted wait</span>
          <span className="qa-eta__value">
            {Math.round(prediction.predicted_wait_min)}
            <span className="qa-eta__unit">min</span>
          </span>
        </div>
        <div className="qa-eta__block">
          <span className="qa-eta__label">Expected turn</span>
          <span className="qa-eta__value qa-eta__value--time">{formatClockTime(prediction.expected_time)}</span>
        </div>
      </div>

      <div className="qa-confidence">
        <div className="qa-confidence__track">
          <div className="qa-confidence__fill" style={{ width: `${confidencePct}%` }} />
        </div>
        <span className="qa-confidence__label">{confidencePct}% confidence</span>
      </div>
    </section>
  );
}
