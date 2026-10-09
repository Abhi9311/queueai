import { useEffect, useState } from "react";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const DEPARTMENTS = ["General Medicine", "Pediatrics", "Dermatology", "Orthopedics"];
const APPOINTMENT_TYPES = [
  { value: "new_patient", label: "New patient" },
  { value: "follow_up", label: "Follow-up" },
  { value: "routine_checkup", label: "Routine checkup" },
];

const EMPTY_FORM = {
  full_name: "",
  age: "",
  gender: "unspecified",
  phone_number: "",
  email: "",
  weight_kg: "",
  height_cm: "",
  doctor_name: "",
  department: DEPARTMENTS[0],
  appointment_type: "new_patient",
  notes: "",
};

export default function AddPatientView() {
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { token, doctor, department, started_new_session }
  const [error, setError] = useState(null);

  async function loadDoctors() {
    setLoadingDoctors(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/doctors`);
      const data = await res.json();
      setDoctors(data.doctors);
      setForm((f) => (f.doctor_name ? f : { ...f, doctor_name: data.doctors[0]?.name ?? "" }));
    } catch (err) {
      console.error("Failed to load doctors", err);
    } finally {
      setLoadingDoctors(false);
    }
  }

  useEffect(() => {
    loadDoctors();
  }, []);

  const selectedDoctor = doctors.find((d) => d.name === form.doctor_name);
  // A custom doctor is tied to one fixed department -- reflect that in the
  // department field instead of letting it drift out of sync with the doctor.
  const departmentLocked = Boolean(selectedDoctor?.department);

  function update(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === "doctor_name") {
        const doc = doctors.find((d) => d.name === value);
        if (doc?.department) next.department = doc.department;
      }
      return next;
    });
  }

  function validate() {
    if (!form.full_name.trim()) return "Enter the patient's name.";
    if (!form.age || Number(form.age) <= 0 || Number(form.age) > 120) return "Enter a valid age (1–120).";
    if (!/^\d{7,15}$/.test(form.phone_number.replace(/\D/g, ""))) return "Enter a valid phone number.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Enter a valid email address.";
    if (!form.weight_kg || Number(form.weight_kg) <= 0) return "Enter a valid weight.";
    if (!form.height_cm || Number(form.height_cm) <= 0) return "Enter a valid height.";
    if (!form.doctor_name) return "Select a doctor.";
    if (!form.department) return "Select a department.";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          age: Number(form.age),
          gender: form.gender,
          phone_number: form.phone_number.replace(/\D/g, ""),
          email: form.email.trim(),
          weight_kg: Number(form.weight_kg),
          height_cm: Number(form.height_cm),
          doctor_name: form.doctor_name,
          department: form.department,
          appointment_type: form.appointment_type,
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed: ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
      setForm((f) => ({ ...EMPTY_FORM, doctor_name: f.doctor_name, department: f.department }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="qa-add-patient">
      <section className="qa-card qa-add-patient__form">
        <h2>Register a patient</h2>
        <p className="qa-add-patient__intro">
          Fill in the patient's details, pick their doctor and department, and submit — a token number is
          issued immediately and they're added to the back of that doctor's live queue.
        </p>

        <form onSubmit={handleSubmit} className="qa-add-patient__fields">
          <label>
            Full name
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              placeholder="e.g. Priya Sharma"
            />
          </label>

          <label>
            Age
            <input
              type="number"
              min="1"
              max="120"
              value={form.age}
              onChange={(e) => update("age", e.target.value)}
              placeholder="e.g. 34"
            />
          </label>

          <label>
            Gender
            <select value={form.gender} onChange={(e) => update("gender", e.target.value)}>
              <option value="unspecified">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>

          <label>
            Phone number
            <input
              type="tel"
              inputMode="numeric"
              value={form.phone_number}
              onChange={(e) => update("phone_number", e.target.value)}
              placeholder="e.g. 9876543210"
            />
          </label>

          <label>
            Gmail address
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="e.g. name123@gmail.com"
            />
          </label>

          <label>
            Weight (kg)
            <input
              type="number"
              min="1"
              step="0.1"
              value={form.weight_kg}
              onChange={(e) => update("weight_kg", e.target.value)}
              placeholder="e.g. 68"
            />
          </label>

          <label>
            Height (cm)
            <input
              type="number"
              min="1"
              step="0.1"
              value={form.height_cm}
              onChange={(e) => update("height_cm", e.target.value)}
              placeholder="e.g. 170"
            />
          </label>

          <label>
            Doctor
            <select
              value={form.doctor_name}
              onChange={(e) => update("doctor_name", e.target.value)}
              disabled={loadingDoctors}
            >
              {doctors.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                  {d.department ? ` — ${d.department}` : " — all departments"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Department
            <select
              value={form.department}
              onChange={(e) => update("department", e.target.value)}
              disabled={departmentLocked}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label>
            Appointment type
            <select value={form.appointment_type} onChange={(e) => update("appointment_type", e.target.value)}>
              {APPOINTMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="qa-add-patient__notes">
            Notes — what's the patient suffering from?
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="e.g. Fever and sore throat for 3 days"
            />
          </label>

          <button type="submit" disabled={submitting} className="qa-btn-primary qa-add-patient__submit">
            {submitting ? "Registering…" : "Register & issue token"}
          </button>
        </form>

        {result && (
          <p className="qa-form-message qa-form-message--ok">
            Registered — token <strong>#{String(result.token).padStart(3, "0")}</strong> issued under{" "}
            <strong>{result.doctor}</strong> ({result.department}).
            {result.started_new_session && (
              <> This doctor wasn't the active live session, so a fresh queue was started for them.</>
            )}
          </p>
        )}
        {error && <p className="qa-form-message qa-form-message--err">{error}</p>}
      </section>
    </div>
  );
}
