import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Header from "./components/Header.jsx";
import BoardStrip from "./components/BoardStrip.jsx";
import ETAPanel from "./components/ETAPanel.jsx";
import DelayAlert from "./components/DelayAlert.jsx";
import StatsStrip from "./components/StatsStrip.jsx";
import QueueChart from "./components/QueueChart.jsx";
import PatientsView from "./components/PatientsView.jsx";
import PatientProfileView from "./components/PatientProfileView.jsx";
import LastVisitsView from "./components/LastVisitsView.jsx";
import DoctorsView from "./components/DoctorsView.jsx";
import AddPatientView from "./components/AddPatientView.jsx";
import LoginPage from "./components/LoginPage.jsx";
import PatientPortal from "./components/PatientPortal.jsx";
import { useQueueSocket } from "./hooks/useQueueSocket.js";

const VIEW_TITLES = {
  live: "Live Queue",
  "add-patient": "Add Patient",
  patients: "Patients",
  profile: "Patient Profile",
  history: "Last Visits",
  doctors: "Doctors",
};

const AUTH_STORAGE_KEY = "queueai.auth";

function loadStoredAuth() {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const { queueState, connected } = useQueueSocket();
  const [view, setView] = useState("live");
  const [yourToken, setYourToken] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [auth, setAuth] = useState(loadStoredAuth);

  function login(next) {
    setAuth(next);
    try {
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // sessionStorage unavailable (e.g. private mode) -- auth just won't persist on refresh.
    }
  }

  function logout() {
    setAuth(null);
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  const tokenOptions = useMemo(
    () => (queueState ? queueState.patients.filter((p) => p.status !== "completed").map((p) => p.token) : []),
    [queueState]
  );

  // Default "your token" to a plausible-looking one further back in the
  // queue the first time data arrives, so the demo has something to show.
  useEffect(() => {
    if (yourToken === null && tokenOptions.length > 0) {
      const mid = tokenOptions[Math.min(tokenOptions.length - 1, Math.floor(tokenOptions.length * 0.6))];
      setYourToken(mid);
    }
  }, [tokenOptions, yourToken]);

  // Re-fetch the prediction for the selected token every time the backend
  // pushes a new queue state (i.e. every simulated tick), so the ETA panel
  // stays live without a separate polling timer. Only needed in the staff
  // dashboard -- the patient portal fetches its own prediction directly.
  useEffect(() => {
    if (auth?.role !== "staff" || yourToken === null) return;
    let cancelled = false;
    setPredictionLoading(true);
    fetch(`/api/queue/${yourToken}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setPrediction(data);
      })
      .catch((err) => console.error("Prediction fetch failed", err))
      .finally(() => {
        if (!cancelled) setPredictionLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.role, yourToken, queueState?.server_time]);

  async function handleReset(doctorOverride) {
    setPrediction(null);
    setYourToken(null);
    try {
      await fetch("/api/queue/reset", {
        method: "POST",
        headers: doctorOverride ? { "Content-Type": "application/json" } : undefined,
        body: doctorOverride ? JSON.stringify(doctorOverride) : undefined,
      });
      setView("live");
    } catch (err) {
      console.error("Reset failed", err);
    }
  }

  if (!auth) {
    return (
      <div className="qa-app">
        <LoginPage
          patients={queueState?.patients}
          connected={connected}
          onPatientLogin={(token) => login({ role: "patient", token })}
          onStaffLogin={() => login({ role: "staff" })}
        />
      </div>
    );
  }

  if (auth.role === "patient") {
    return (
      <div className="qa-app">
        <PatientPortal token={auth.token} queueState={queueState} connected={connected} onLogout={logout} />
      </div>
    );
  }

  return (
    <div className="qa-app">
      <div className="qa-shell">
        <Sidebar active={view} onChange={setView} />

        <div className="qa-shell__main">
          <Header
            title={VIEW_TITLES[view]}
            connected={connected}
            doctor={queueState?.doctor?.doctor_name}
            department={queueState?.doctor?.department}
            onReset={() => handleReset()}
            onLogout={logout}
          />

          <main className="qa-content">
            {view === "live" && (
              <div className="qa-live">
                <BoardStrip
                  nowServing={queueState?.now_serving}
                  yourToken={yourToken}
                  patientsAhead={prediction?.patients_ahead}
                  onTokenChange={setYourToken}
                  tokenOptions={tokenOptions}
                />

                <DelayAlert prediction={prediction} />

                <ETAPanel prediction={prediction} loading={predictionLoading && !prediction} />

                {queueState && <QueueChart patients={queueState.patients} nowServing={queueState.now_serving} />}

                <StatsStrip doctor={queueState?.doctor} />
              </div>
            )}

            {view === "add-patient" && <AddPatientView />}

            {view === "patients" && <PatientsView patients={queueState?.patients} nowServing={queueState?.now_serving} />}

            {view === "profile" && <PatientProfileView patients={queueState?.patients} />}

            {view === "history" && <LastVisitsView patients={queueState?.patients} />}

            {view === "doctors" && (
              <DoctorsView
                onStartSession={(doctor) =>
                  handleReset({ doctor_name: doctor.name, department: doctor.department || undefined })
                }
              />
            )}
          </main>

          <footer className="qa-footer">
            <p>QueueAI simulates a live clinic queue with synthetic data — every prediction updates as each consultation finishes.</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
