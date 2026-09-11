import { useEffect, useMemo, useState } from "react";
import PatientDetailCard from "./PatientDetailCard.jsx";

function pad(n) {
  return String(n).padStart(3, "0");
}

function statusLabel(status) {
  if (status === "serving") return "Serving now";
  if (status === "completed") return "Completed";
  return "Waiting";
}

export default function PatientProfileView({ patients }) {
  const [query, setQuery] = useState("");
  const [selectedToken, setSelectedToken] = useState(null);

  const filtered = useMemo(() => {
    if (!patients) return [];
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        String(p.token).includes(q) ||
        p.phone_number.includes(q) ||
        p.email.toLowerCase().includes(q)
    );
  }, [patients, query]);

  // Default to the first patient once data has loaded.
  useEffect(() => {
    if (selectedToken === null && patients?.length) {
      setSelectedToken(patients[0].token);
    }
  }, [patients, selectedToken]);

  if (!patients) {
    return <p className="qa-empty">Loading patient records…</p>;
  }

  const patient = patients.find((p) => p.token === selectedToken) ?? null;

  return (
    <div className="qa-profile">
      <section className="qa-card qa-profile__search">
        <h2>Find a patient</h2>
        <input
          type="text"
          className="qa-profile__search-input"
          placeholder="Search by name, token, phone, or Gmail…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="qa-profile__list">
          {filtered.map((p) => (
            <button
              type="button"
              key={p.token}
              className={`qa-profile__list-item ${p.token === selectedToken ? "qa-profile__list-item--active" : ""}`}
              onClick={() => setSelectedToken(p.token)}
            >
              <span className="qa-profile__list-token">#{pad(p.token)}</span>
              <span className="qa-profile__list-name">{p.full_name}</span>
              <span className={`qa-badge qa-badge--${p.status}`}>{statusLabel(p.status)}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="qa-empty">No patients match "{query}".</p>}
        </div>
      </section>

      <PatientDetailCard patient={patient} />
    </div>
  );
}
