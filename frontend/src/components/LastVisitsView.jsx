function pad(n) {
  return String(n).padStart(3, "0");
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const datePart = d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
  const timePart = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${datePart}, ${timePart}`;
}

export default function LastVisitsView({ patients }) {
  if (!patients) {
    return <p className="qa-empty">Loading visit history…</p>;
  }

  const completed = patients.filter((p) => p.status === "completed").slice().reverse();

  if (completed.length === 0) {
    return (
      <section className="qa-table-card" aria-label="Completed visits today">
        <div className="qa-table-card__heading">
          <h2>Last visits</h2>
          <p>No patients have been seen yet in this session.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="qa-table-card" aria-label="Completed visits today">
      <div className="qa-table-card__heading">
        <h2>Last visits</h2>
        <p>{completed.length} patients seen so far today, most recent first</p>
      </div>
      <div className="qa-table-wrap">
        <table className="qa-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Patient name</th>
              <th>Department</th>
              <th>Doctor</th>
              <th>Appointment</th>
              <th>Predicted</th>
              <th>Actual</th>
              <th>Date &amp; time of visit</th>
            </tr>
          </thead>
          <tbody>
            {completed.map((p) => (
              <tr key={p.token}>
                <td className="qa-table__mono">#{pad(p.token)}</td>
                <td>{p.full_name}</td>
                <td>{p.department}</td>
                <td>{p.doctor}</td>
                <td className="qa-table__cap">{p.appointment_type.replace("_", " ")}</td>
                <td className="qa-table__mono">{p.predicted_duration_min} min</td>
                <td className="qa-table__mono">{p.actual_duration_min} min</td>
                <td className="qa-table__mono">{formatDateTime(p.completed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
