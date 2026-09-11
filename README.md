# QueueAI

**Know your wait, before you wait.**

A real-time, AI-powered appointment queue and ETA prediction system. Instead
of a static "patients ahead × average time" calculation, an ML model
predicts how long each upcoming consultation will actually take, and the
whole queue's ETA recalculates live as each patient is seen — pushed to the
browser over a WebSocket the instant it changes.

This build ships with a synthetic data generator and an in-memory queue
simulator standing in for a real hospital appointment system, so it runs
completely standalone with no external services or API keys. Swapping the
simulator for a real appointment feed is a drop-in change — see
[Going to production](#going-to-production) below.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Backend framework | **FastAPI** (Python 3.11) | async-native, first-class WebSocket support, auto OpenAPI docs |
| ML model | **scikit-learn** `RandomForestRegressor` in a `ColumnTransformer` pipeline | zero extra system deps, trains in <1s on this dataset; same pipeline shape you'd keep with XGBoost/LightGBM |
| Data | **pandas / numpy**, synthetic generator | no real hospital data required to build v1 |
| Live transport | **WebSockets** (native FastAPI) | push-based ETA updates, no polling |
| Server | **Uvicorn** | ASGI server for FastAPI |
| Frontend framework | **React 18** via **Vite** | fast dev server, small, no framework lock-in |
| Charts | **Recharts** | predicted-vs-actual queue movement chart |
| Styling | Plain CSS, design tokens in `App.css` | white/grey clinical palette, no CSS framework dependency |
| Fonts | **IBM Plex Sans** + **IBM Plex Mono** (Google Fonts) | mono face gives the "departure board" numerals their precision |
| Containerization | Docker + `docker-compose.yml` | optional, for one-command deploy |

**Model features:** `doctor`, `department`, `appointment_type`, `patient_type`,
`hour_of_day`, `day_of_week`, `historical_doctor_avg_time`,
`queue_length_at_start`, `time_since_doctor_started_min`,
`previous_patient_duration` → predicts `consultation_duration_minutes`.
Held-out mean absolute error on the synthetic dataset: **~1.7 minutes**.

---

## Architecture

```
┌───────────────────┐        HTTP (REST)         ┌─────────────────────┐
│                    │ ─────────────────────────▶ │                     │
│   React Frontend   │                             │   FastAPI Backend   │
│   (Vite, port      │ ◀─────────────────────────  │   (Uvicorn, port    │
│    5173 in dev)    │        WebSocket push        │    8000)            │
│                    │ ◀═══════════════════════════│                     │
└───────────────────┘   /ws/queue, live on tick    └──────────┬──────────┘
                                                                │
                                          ┌─────────────────────┴─────────────────────┐
                                          │                                           │
                                 ┌────────▼────────┐                        ┌─────────▼─────────┐
                                 │ QueueSimulator   │                        │ QueuePredictionModel│
                                 │ in-memory queue, │◀──── predict() ───────▶│ RandomForest       │
                                 │ advances on a    │                        │ pipeline, trained   │
                                 │ timer, recomputes│                        │ on synthetic data   │
                                 │ ETAs every tick  │                        │                     │
                                 └───────────────────┘                        └─────────────────────┘
```

**Data flow on every tick:**
1. The currently-served patient "finishes" (simulated actual duration, sampled around the model's own prediction plus noise).
2. The doctor's running today-average updates.
3. Every remaining waiting patient's duration is **re-predicted** with fresh features (updated queue length, updated previous-patient duration, updated elapsed time).
4. Each patient's expected clock time is rolled forward from the new predictions.
5. The full new state is broadcast to every connected browser over WebSocket — no refresh needed.

---

## Project structure

```
queueai/
├── backend/
│   ├── app/
│   │   ├── main.py          FastAPI app: REST + WebSocket endpoints
│   │   ├── model.py         QueuePredictionModel (train / predict / confidence)
│   │   ├── data_generator.py  synthetic historical + today's-queue data
│   │   ├── simulator.py     QueueSimulator: live queue state + tick loop
│   │   ├── doctors_store.py  in-memory store for doctors added at runtime
│   │   └── schemas.py       Pydantic response models
│   ├── train_model.py       standalone offline training script
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx          sidebar-routed shell: Live Queue / Patients / Last Visits / Doctors
│   │   ├── App.css          design tokens + all styling
│   │   ├── components/      Sidebar, Header, BoardStrip, ETAPanel, DelayAlert, StatsStrip,
│   │   │                    QueueChart, PatientsView, LastVisitsView, DoctorsView
│   │   └── hooks/useQueueSocket.js   WebSocket connection + auto-reconnect
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js       dev proxy to backend on :8000
│   ├── nginx.conf           prod reverse proxy config (used in Docker build)
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Running locally

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API is now at `http://localhost:8000` (docs at `/docs`). On startup it
trains the model in-memory on synthetic data (<1s) and starts a live queue
simulation for one doctor's session. To skip in-memory training and use a
persisted artifact instead, run `python train_model.py` first — it writes
`backend/model.joblib`, which `main.py` auto-loads on next boot.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api/*` and
`/ws/*` to `http://localhost:8000`, so the backend must be running first.

### Docker (both services)

```bash
docker compose up --build
```

Frontend: `http://localhost:8080` · Backend: `http://localhost:8000`

---

## API reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | liveness check, returns current model MAE |
| GET | `/api/queue` | full current queue state + doctor stats |
| GET | `/api/queue/{token}` | live prediction for one token: wait time, expected clock time, confidence, delay |
| POST | `/api/queue/reset` | start a fresh simulated session; optional body `{doctor_name, department}` pins it to a specific doctor |
| GET | `/api/doctors` | list built-in + custom-added doctors, with the model's current held-out MAE |
| POST | `/api/doctors` | add a doctor (`{name, department, avg_consultation_min}`) and **retrain the model immediately** to include them |
| WS | `/ws/queue` | pushes the full queue state on connect, and again every tick |

---

## Adding and training a new doctor

The **Doctors** tab in the sidebar is a working feature, not just a form:

1. Enter a name, department, and their typical consultation length.
2. Click **Add & retrain model** — the backend folds them into the synthetic
   training set as their own category (tied mostly to their registered
   department, like a real new hire would be) and retrains the
   `RandomForestRegressor` pipeline immediately. The response includes the
   model's new held-out MAE.
3. Click **Start session** next to any doctor (built-in or newly added) to
   start a live queue for them — the running average is seeded from their
   registered number instead of a generic default, and every prediction from
   then on comes from the retrained model.

This is exactly the same code path described in the original project idea
(*data → feature engineering → ML prediction*) — you're just triggering it
from the UI instead of a script. See `app/model.py`'s `train()` and
`app/data_generator.py`'s `generate_historical_dataset()` for the underlying
logic, and `app/doctors_store.py` for where added doctors are (in-memory)
kept.

---

## Going to production

This ships as a fully working standalone demo. To point it at a real
clinic's appointment system:

- Replace `QueueSimulator._run_loop`'s timer tick with a webhook/message-queue
  consumer that reacts to real "consultation completed" events — steps 2–5
  of the tick logic (recompute predictions, roll forward ETAs, broadcast)
  stay exactly the same.
- Swap `generate_historical_dataset()` for a query against your real
  appointment history table, keeping the same feature/target column names.
- Swap `RandomForestRegressor` for XGBoost/LightGBM if you want a stronger
  model — the pipeline shape (`ColumnTransformer` → regressor) doesn't change.
- Add persistence (PostgreSQL) for queue state instead of the in-memory
  `QueueSimulator`, and add auth in front of `/api/queue/{token}` so
  patients can only see their own prediction.
- Tighten `CORSMiddleware` origins and the WebSocket origin check for
  production.

## Name & design rationale

**QueueAI** because it says exactly what it is, and reads fine on a resume
or a GitHub repo without sounding like a class project. The interface is
built around one concrete, literal metaphor — an airport-style departure
board — because that's the truest visual language for "which position, what
time": tabular monospace digits for the numbers that matter, a white/grey
board surface with hairline dividers instead of stacked drop-shadow cards,
and a single teal/amber accent pair doing all the status signaling (on
schedule vs. running behind).
#   q u e u e a i  
 