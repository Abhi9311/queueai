import { useEffect, useState } from "react";
import PatientDetailCard from "./PatientDetailCard.jsx";
import ETAPanel from "./ETAPanel.jsx";
import DelayAlert from "./DelayAlert.jsx";
import { Activity, LogOut } from "lucide-react";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function pad(n) {
  return String(n).padStart(3, "0");
}

export default function PatientPortal({ token, queueState, connected, onLogout }) {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE_URL}/api/queue/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setPrediction(data);
      })
      .catch((err) => console.error("Prediction fetch failed", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch every time the backend pushes a new tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, queueState?.server_time]);

  const patient = queueState?.patients?.find((p) => p.token === token) ?? null;
  const firstName = patient?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="qa-portal">
      <header className="qa-header qa-header--portal">
        <div className="qa-header__brand">
          <span className="qa-header__logo" aria-hidden="true">
            <Activity size={16} strokeWidth={2.5} />
          </span>
          <span className="qa-header__brandname">QueueAI</span>
        </div>
        <div className="qa-header__meta">
          <span className={`qa-status ${connected ? "qa-status--live" : "qa-status--offline"}`}>
            <span className="qa-status__dot" />
            {connected ? "Live" : "Reconnecting…"}
          </span>
          <button className="qa-reset" onClick={onLogout} type="button">
            <LogOut size={14} strokeWidth={2} style={{ marginRight: 6, verticalAlign: -2 }} />
            Log out
          </button>
        </div>
      </header>

      <main className="qa-content qa-portal__content">
        <div className="qa-portal__greeting">
          <h1>Hi, {firstName}</h1>
          <p>
            Token #{pad(token)}
            {patient ? ` · ${patient.department} · ${patient.doctor}` : ""}
          </p>
        </div>

        <DelayAlert prediction={prediction} />
        <ETAPanel prediction={prediction} loading={loading && !prediction} />
        {patient ? (
          <PatientDetailCard patient={patient} />
        ) : (
          <p className="qa-empty">Your record for today's session could not be found. It may have reset — please log in again.</p>
        )}
      </main>

      <footer className="qa-footer">
        <p>QueueAI simulates a live clinic queue with synthetic data — your prediction updates as each consultation finishes.</p>
      </footer>
    </div>
  );
}
