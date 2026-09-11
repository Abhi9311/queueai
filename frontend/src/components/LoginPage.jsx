import { useState } from "react";
import { ShieldCheck, Stethoscope, UserRound } from "lucide-react";

const STAFF_USERNAME = "staff";
const STAFF_PASSWORD = "queueai123";

export default function LoginPage({ patients, connected, onPatientLogin, onStaffLogin }) {
  const [mode, setMode] = useState("patient"); // "patient" | "staff"

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [patientError, setPatientError] = useState(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [staffError, setStaffError] = useState(null);

  function handlePatientSubmit(e) {
    e.preventDefault();
    setPatientError(null);

    if (!patients || patients.length === 0) {
      setPatientError("Still connecting to today's queue — try again in a moment.");
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    const emailNorm = email.trim().toLowerCase();
    const match = patients.find(
      (p) => p.phone_number === phoneDigits && p.email.toLowerCase() === emailNorm
    );
    if (!match) {
      setPatientError("No patient matches that phone number and Gmail address. Double-check your registration details.");
      return;
    }
    onPatientLogin(match.token);
  }

  function handleStaffSubmit(e) {
    e.preventDefault();
    setStaffError(null);
    if (username.trim() === STAFF_USERNAME && password === STAFF_PASSWORD) {
      onStaffLogin();
      return;
    }
    setStaffError("Incorrect username or password.");
  }

  return (
    <div className="qa-login">
      <div className="qa-login__panel">
        <div className="qa-login__brand">
          <span className="qa-login__mark">QueueAI</span>
          <p className="qa-login__tagline">Know your wait, before you wait</p>
        </div>
        <p className="qa-login__blurb">
          A live, ML-predicted clinic queue. Patients check their own wait time and details; staff manage the
          queue, doctors, and every patient's record.
        </p>
        <ul className="qa-login__points">
          <li>Real-time predicted wait, updated every consultation</li>
          <li>Self-service patient portal — no staff needed to check status</li>
          <li>Full clinic dashboard for staff, with live retraining</li>
        </ul>
        <span className={`qa-status ${connected ? "qa-status--live" : "qa-status--offline"}`}>
          <span className="qa-status__dot" />
          {connected ? "Live queue connected" : "Connecting to queue…"}
        </span>
      </div>

      <div className="qa-login__card">
        <div className="qa-login__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={`qa-login__tab ${mode === "patient" ? "qa-login__tab--active" : ""}`}
            onClick={() => setMode("patient")}
          >
            <UserRound size={16} strokeWidth={2} /> Patient
          </button>
          <button
            type="button"
            role="tab"
            className={`qa-login__tab ${mode === "staff" ? "qa-login__tab--active" : ""}`}
            onClick={() => setMode("staff")}
          >
            <Stethoscope size={16} strokeWidth={2} /> Staff
          </button>
        </div>

        {mode === "patient" && (
          <form onSubmit={handlePatientSubmit} className="qa-login__form">
            <h2>Check your queue status</h2>
            <p className="qa-login__form-intro">
              Enter the phone number and Gmail address from your registration to see your token, personal
              details, and live wait time.
            </p>
            <label>
              Phone number
              <input
                type="tel"
                inputMode="numeric"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </label>
            <label>
              Gmail address
              <input
                type="email"
                placeholder="e.g. name123@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="qa-btn-primary qa-login__submit">
              View my status
            </button>
            {patientError && <p className="qa-form-message qa-form-message--err">{patientError}</p>}
            <p className="qa-login__hint">
              Demo tip: staff can look up any patient's phone number, Gmail, and token from the Patients tab
              after a staff login.
            </p>
          </form>
        )}

        {mode === "staff" && (
          <form onSubmit={handleStaffSubmit} className="qa-login__form">
            <h2>Staff sign in</h2>
            <p className="qa-login__form-intro">Access the full clinic dashboard: live queue, patients, and doctor roster.</p>
            <label>
              Username
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="qa-btn-primary qa-login__submit">
              <ShieldCheck size={15} strokeWidth={2} /> Sign in
            </button>
            {staffError && <p className="qa-form-message qa-form-message--err">{staffError}</p>}
            <p className="qa-login__hint">Demo credentials: <code>staff</code> / <code>queueai123</code></p>
          </form>
        )}
      </div>
    </div>
  );
}
