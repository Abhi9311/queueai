function pad(n) {
  return String(n).padStart(3, "0");
}

function statusLabel(status) {
  if (status === "serving") return "Serving now";
  if (status === "completed") return "Completed";
  return "Waiting";
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function PatientsView({ patients, nowServing }) {
  if (!patients) {
    return <p className="qa-empty">Loading today's patient list…</p>;
  }

  return (
    <section className="qa-table-card" aria-label="All patients today">
      <div className="qa-table-card__heading">
        <h2>Today's patients</h2>
        <p>
          {patients.length} tokens issued
          {nowServing != null && <> · now serving #{pad(nowServing)}</>}
        </p>
      </div>
      <div className="qa-table-wrap">
        <table className="qa-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Patient</th>
              <th>Phone</th>
              <th>Gmail</th>
              <th>Appointment</th>
              <th>Status</th>
              <th>Predicted</th>
              <th>Actual</th>
              <th>Scheduled</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.token} className={p.status === "serving" ? "qa-table__row--active" : ""}>
                <td className="qa-table__mono">#{pad(p.token)}</td>
                <td className="qa-table__cap">{p.patient_type}</td>
                <td className="qa-table__mono">{p.phone_number}</td>
                <td className="qa-table__mono">{p.email}</td>
                <td className="qa-table__cap">{p.appointment_type.replace("_", " ")}</td>
                <td>
                  <span className={`qa-badge qa-badge--${p.status}`}>{statusLabel(p.status)}</span>
                </td>
                <td className="qa-table__mono">
                  {p.predicted_duration_min != null ? `${p.predicted_duration_min} min` : "—"}
                </td>
                <td className="qa-table__mono">
                  {p.actual_duration_min != null ? `${p.actual_duration_min} min` : "—"}
                </td>
                <td className="qa-table__mono">{formatTime(p.scheduled_time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
