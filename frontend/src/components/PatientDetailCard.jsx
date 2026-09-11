import {
  Calendar,
  CalendarDays,
  Scale,
  Ruler,
  UserRound,
  Phone,
  Mail,
  Stethoscope,
  Building2,
  ClipboardList,
  Clock,
  Timer,
  CheckCircle2,
  History,
  StickyNote,
} from "lucide-react";

function pad(n) {
  return String(n).padStart(3, "0");
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

function statusLabel(status) {
  if (status === "serving") return "Serving now";
  if (status === "completed") return "Completed";
  return "Waiting";
}

function Field({ icon: Icon, label, value, cap = false }) {
  return (
    <div className="qa-profile__field">
      <span className="qa-profile__label">
        <Icon size={13} strokeWidth={2} aria-hidden="true" />
        {label}
      </span>
      <span className={`qa-profile__value ${cap ? "qa-table__cap" : ""}`}>{value}</span>
    </div>
  );
}

/**
 * Full personal-detail card for one patient: identity, vitals, today's
 * appointment, and last-visit history. Used both by the staff "Patient
 * Profile" browser and the patient's own self-service portal after login.
 */
export default function PatientDetailCard({ patient }) {
  if (!patient) return null;

  return (
    <section className="qa-card qa-profile__detail" aria-label="Patient detail">
      <div className="qa-profile__header">
        <div className={`qa-profile__avatar qa-profile__avatar--${patient.status}`} aria-hidden="true">
          {patient.full_name
            .split(" ")
            .map((s) => s[0])
            .join("")}
        </div>
        <div>
          <h2 className="qa-profile__name">{patient.full_name}</h2>
          <p className="qa-profile__sub">
            Token #{pad(patient.token)} · <span className="qa-table__cap">{patient.gender}</span> ·{" "}
            <span className={`qa-badge qa-badge--${patient.status}`}>{statusLabel(patient.status)}</span>
          </p>
        </div>
      </div>

      <div className="qa-profile__sections">
        <div className="qa-profile__section">
          <h4 className="qa-profile__section-title">Contact</h4>
          <div className="qa-profile__grid">
            <Field icon={Phone} label="Phone number" value={patient.phone_number} />
            <Field icon={Mail} label="Email" value={patient.email} />
          </div>
        </div>

        <div className="qa-profile__section">
          <h4 className="qa-profile__section-title">Vitals</h4>
          <div className="qa-profile__grid">
            <Field icon={Calendar} label="Age" value={`${patient.age} yrs`} />
            <Field icon={CalendarDays} label="Date of birth" value={formatDate(patient.date_of_birth)} />
            <Field icon={UserRound} label="Gender" value={patient.gender} cap />
            <Field icon={Scale} label="Weight" value={`${patient.weight_kg} kg`} />
            <Field icon={Ruler} label="Height" value={`${patient.height_cm} cm`} />
          </div>
        </div>

        <div className="qa-profile__section">
          <h4 className="qa-profile__section-title">Today's visit</h4>
          <div className="qa-profile__grid">
            <Field icon={Stethoscope} label="Doctor" value={patient.doctor} />
            <Field icon={Building2} label="Department" value={patient.department} />
            <Field icon={ClipboardList} label="Appointment" value={patient.appointment_type.replace("_", " ")} cap />
            <Field icon={Clock} label="Scheduled time" value={formatTime(patient.scheduled_time)} />
            <Field
              icon={Timer}
              label="Predicted duration"
              value={patient.predicted_duration_min != null ? `${patient.predicted_duration_min} min` : "—"}
            />
            <Field
              icon={CheckCircle2}
              label="Actual duration"
              value={patient.actual_duration_min != null ? `${patient.actual_duration_min} min` : "—"}
            />
          </div>
        </div>
      </div>

      <div className="qa-profile__history">
        <h3>
          <History size={13} strokeWidth={2} aria-hidden="true" />
          Last visit
        </h3>
        <p>
          {formatDate(patient.last_visit_date)} · {patient.last_visit_reason} · {patient.department} ·{" "}
          {patient.doctor}
        </p>
      </div>

      {patient.notes && (
        <div className="qa-profile__history">
          <h3>
            <StickyNote size={13} strokeWidth={2} aria-hidden="true" />
            Notes — reason for today's visit
          </h3>
          <p>{patient.notes}</p>
        </div>
      )}

      <p className="qa-profile__disclaimer">
        Synthetic demo data — this identity was generated for the simulation and is not a real patient record.
      </p>
    </section>
  );
}
