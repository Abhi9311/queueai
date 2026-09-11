import { LogOut } from "lucide-react";

export default function Header({ title, connected, doctor, department, onReset, onLogout }) {
  return (
    <header className="qa-header">
      <div className="qa-header__title">
        <h1>{title}</h1>
        {doctor && (
          <span className="qa-header__doctor">
            {doctor} · {department}
          </span>
        )}
      </div>

      <div className="qa-header__meta">
        <span className={`qa-status ${connected ? "qa-status--live" : "qa-status--offline"}`}>
          <span className="qa-status__dot" />
          {connected ? "Live" : "Reconnecting…"}
        </span>
        <button className="qa-reset" onClick={onReset} type="button">
          New session
        </button>
        {onLogout && (
          <button className="qa-reset" onClick={onLogout} type="button">
            <LogOut size={14} strokeWidth={2} style={{ marginRight: 6, verticalAlign: -2 }} />
            Log out
          </button>
        )}
      </div>
    </header>
  );
}
