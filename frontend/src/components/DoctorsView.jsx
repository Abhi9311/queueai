import { useEffect, useState } from "react";

const DEPARTMENTS = ["General Medicine", "Pediatrics", "Dermatology", "Orthopedics"];

export default function DoctorsView({ onStartSession }) {
  const [doctors, setDoctors] = useState([]);
  const [mae, setMae] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", department: DEPARTMENTS[0], avg_consultation_min: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  async function loadDoctors() {
    setLoading(true);
    try {
      const res = await fetch("/api/doctors");
      const data = await res.json();
      setDoctors(data.doctors);
      setMae(data.model_mae_minutes);
    } catch (err) {
      console.error("Failed to load doctors", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDoctors();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!form.name.trim() || !form.avg_consultation_min) {
      setError("Enter a name and a typical consultation length.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          department: form.department,
          avg_consultation_min: Number(form.avg_consultation_min),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed: ${res.status}`);
      }
      const data = await res.json();
      setDoctors(data.doctors);
      setMae(data.model_mae_minutes);
      setMessage(`${form.name.trim()} added — model retrained on the new dataset (held-out MAE ${data.model_mae_minutes} min).`);
      setForm({ name: "", department: DEPARTMENTS[0], avg_consultation_min: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="qa-doctors">
      <section className="qa-table-card" aria-label="Doctor roster">
        <div className="qa-table-card__heading">
          <h2>Doctor roster</h2>
          <p>
            {loading
              ? "Loading…"
              : `${doctors.length} doctors known to the model${mae != null ? ` · held-out MAE ${mae} min` : ""}`}
          </p>
        </div>
        <div className="qa-table-wrap">
          <table className="qa-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Department</th>
                <th>Avg consult</th>
                <th>Source</th>
                <th aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((d) => (
                <tr key={d.name}>
                  <td>{d.name}</td>
                  <td>{d.department ?? "All departments"}</td>
                  <td className="qa-table__mono">{d.avg_consultation_min} min</td>
                  <td>
                    <span className={`qa-badge ${d.is_custom ? "qa-badge--custom" : "qa-badge--builtin"}`}>
                      {d.is_custom ? "Added" : "Built-in"}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="qa-linklike" onClick={() => onStartSession(d)}>
                      Start session
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="qa-card qa-doctor-form">
        <h2>Add a new doctor</h2>
        <p className="qa-doctor-form__intro">
          Adding a doctor retrains the prediction model immediately, so any live
          session started with them uses a real learned pattern instead of a
          generic average.
        </p>
        <form onSubmit={handleSubmit} className="qa-doctor-form__fields">
          <label>
            Name
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Dr. Sharma"
            />
          </label>
          <label>
            Department
            <select
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label>
            Typical consultation length (min)
            <input
              type="number"
              min="1"
              max="60"
              step="0.5"
              value={form.avg_consultation_min}
              onChange={(e) => setForm((f) => ({ ...f, avg_consultation_min: e.target.value }))}
              placeholder="14.5"
            />
          </label>
          <button type="submit" disabled={submitting} className="qa-btn-primary">
            {submitting ? "Training…" : "Add & retrain model"}
          </button>
        </form>
        {message && <p className="qa-form-message qa-form-message--ok">{message}</p>}
        {error && <p className="qa-form-message qa-form-message--err">{error}</p>}
      </section>
    </div>
  );
}
