import { Activity, Users, History, Stethoscope, Contact, UserPlus } from "lucide-react";

const NAV_ITEMS = [
  { id: "live", label: "Live Queue", icon: Activity },
  { id: "add-patient", label: "Add Patient", icon: UserPlus },
  { id: "patients", label: "Patients", icon: Users },
  { id: "profile", label: "Patient Profile", icon: Contact },
  { id: "history", label: "Last Visits", icon: History },
  { id: "doctors", label: "Doctors", icon: Stethoscope },
];

export default function Sidebar({ active, onChange }) {
  return (
    <nav className="qa-sidebar" aria-label="Main navigation">
      <div className="qa-sidebar__brand">
        <span className="qa-sidebar__mark">QueueAI</span>
        <span className="qa-sidebar__tagline">Know your wait, before you wait</span>
      </div>

      <ul className="qa-sidebar__list">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <li key={id}>
            <button
              type="button"
              className={`qa-sidebar__item ${active === id ? "qa-sidebar__item--active" : ""}`}
              onClick={() => onChange(id)}
            >
              <Icon size={17} strokeWidth={2} aria-hidden="true" />
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
