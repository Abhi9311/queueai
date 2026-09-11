"""
QueueAI backend — FastAPI application.

Endpoints
---------
GET  /api/health              liveness check
GET  /api/queue                full current queue + doctor stats
GET  /api/queue/{token}        live ETA / prediction for a single token
POST /api/queue/reset           start a fresh simulated session, optionally
                                 pinned to a given doctor/department
GET  /api/doctors               list built-in + custom-added doctors
POST /api/doctors               add a new doctor and retrain the model
                                 on the spot to include them
POST /api/patients               staff registers a walk-in patient; issues
                                 a token and adds them to the chosen
                                 doctor's live queue (starting one if needed)
WS   /ws/queue                  live-push channel; sends the full queue
                                 state on connect and again on every tick

Run with:
    uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from statistics import mean
from typing import Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from . import doctors_store
from .data_generator import BASE_DURATION, DOCTOR_SPEED, DOCTORS
from .model import QueuePredictionModel
from .schemas import AddDoctorRequest, AddPatientRequest, ResetRequest
from .simulator import ConnectionManager, QueueSimulator

MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "model.joblib")

state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    model = QueuePredictionModel(model_path=MODEL_PATH if os.path.exists(MODEL_PATH) else None)
    if not model._trained:  # no saved artifact found -> train fresh, it's fast
        model.train(n_rows=6000, seed=7)

    manager = ConnectionManager()
    simulator = QueueSimulator(model=model, manager=manager, n_patients=40)
    simulator.start()

    state["model"] = model
    state["manager"] = manager
    state["simulator"] = simulator

    print(f"QueueAI model ready. Held-out MAE: {model.mae_minutes:.2f} min")
    yield

    simulator.stop()


app = FastAPI(title="QueueAI", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # relax for local/demo use; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_simulator() -> QueueSimulator:
    return state["simulator"]


def build_doctor_list() -> list[dict]:
    """Combine the built-in roster with any doctors added at runtime."""
    baseline_avg = mean(BASE_DURATION.values())
    builtins = [
        {
            "name": name,
            "department": None,  # built-in doctors are seen across every department
            "avg_consultation_min": round(baseline_avg + DOCTOR_SPEED[name], 1),
            "is_custom": False,
        }
        for name in DOCTORS
    ]
    customs = [
        {
            "name": d["name"],
            "department": d["department"],
            "avg_consultation_min": round(float(d["avg_consultation_min"]), 1),
            "is_custom": True,
        }
        for d in doctors_store.list_custom_doctors()
    ]
    return builtins + customs


@app.get("/api/health")
def health():
    model: QueuePredictionModel = state["model"]
    return {"status": "ok", "model_mae_minutes": round(model.mae_minutes, 2)}


@app.get("/api/queue")
def queue_status():
    return get_simulator().to_public_state()


@app.get("/api/queue/{token}")
def queue_predict(token: int):
    result = get_simulator().predict_for_token(token)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No patient with token {token} in today's queue.")
    return result


@app.post("/api/queue/reset")
async def queue_reset(body: Optional[ResetRequest] = None):
    old: QueueSimulator = state["simulator"]
    old.stop()

    doctor_name = body.doctor_name if body else None
    initial_avg = None
    if doctor_name:
        match = next((d for d in build_doctor_list() if d["name"] == doctor_name), None)
        if match:
            initial_avg = match["avg_consultation_min"]

    new_sim = QueueSimulator(
        model=state["model"],
        manager=state["manager"],
        n_patients=40,
        doctor_name=doctor_name,
        department=body.department if body else None,
        initial_avg_consultation_min=initial_avg,
    )
    new_sim.start()
    state["simulator"] = new_sim
    return new_sim.to_public_state()


@app.get("/api/doctors")
def list_doctors():
    return {"doctors": build_doctor_list(), "model_mae_minutes": round(state["model"].mae_minutes, 2)}


@app.post("/api/doctors")
def add_doctor(body: AddDoctorRequest):
    if body.department not in BASE_DURATION:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown department '{body.department}'. Choose one of: {list(BASE_DURATION.keys())}",
        )
    if body.avg_consultation_min <= 0 or body.avg_consultation_min > 60:
        raise HTTPException(status_code=400, detail="avg_consultation_min should be between 0 and 60 minutes.")

    doctors_store.add_custom_doctor(
        name=body.name.strip(),
        department=body.department,
        avg_consultation_min=body.avg_consultation_min,
    )

    # Retrain immediately so the model actually learns this doctor's pattern.
    model: QueuePredictionModel = state["model"]
    model.train(n_rows=6000, seed=7, extra_doctors=doctors_store.list_custom_doctors())

    return {"doctors": build_doctor_list(), "model_mae_minutes": round(model.mae_minutes, 2)}


@app.post("/api/patients")
async def add_patient(body: AddPatientRequest):
    if body.department not in BASE_DURATION:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown department '{body.department}'. Choose one of: {list(BASE_DURATION.keys())}",
        )
    doctor_entry = next((d for d in build_doctor_list() if d["name"] == body.doctor_name), None)
    if doctor_entry is None:
        raise HTTPException(status_code=400, detail=f"Unknown doctor '{body.doctor_name}'.")
    if not (1 <= body.age <= 120):
        raise HTTPException(status_code=400, detail="Age should be between 1 and 120.")
    if body.weight_kg <= 0 or body.height_cm <= 0:
        raise HTTPException(status_code=400, detail="Weight and height should be positive numbers.")

    # A custom doctor is tied to one department; a built-in doctor (department
    # is None in the roster) can be booked under whichever department was
    # picked in the form.
    department = doctor_entry["department"] or body.department

    sim: QueueSimulator = state["simulator"]
    started_new_session = False
    if not sim.matches_session(body.doctor_name, department):
        # The chosen doctor isn't today's active live session -- start a
        # fresh one for them, exactly like "Start session" on the Doctors
        # tab, then add this patient at the back of it.
        sim.stop()
        sim = QueueSimulator(
            model=state["model"],
            manager=state["manager"],
            n_patients=40,
            doctor_name=body.doctor_name,
            department=department,
            initial_avg_consultation_min=doctor_entry["avg_consultation_min"],
        )
        sim.start()
        state["simulator"] = sim
        started_new_session = True

    patient = sim.add_patient(
        full_name=body.full_name.strip(),
        age=body.age,
        gender=(body.gender or "unspecified").strip().lower() or "unspecified",
        phone_number=body.phone_number.strip(),
        email=body.email.strip(),
        weight_kg=float(body.weight_kg),
        height_cm=float(body.height_cm),
        notes=body.notes.strip() if body.notes else None,
    )

    queue_state = sim.to_public_state()
    await state["manager"].broadcast(queue_state)

    return {
        "token": patient.token,
        "doctor": sim.doctor,
        "department": sim.department,
        "started_new_session": started_new_session,
        "queue": queue_state,
    }


@app.websocket("/ws/queue")
async def queue_ws(websocket: WebSocket):
    manager: ConnectionManager = state["manager"]
    simulator: QueueSimulator = state["simulator"]
    await manager.connect(websocket)
    try:
        await websocket.send_json(simulator.to_public_state())
        while True:
            # We don't expect inbound messages, but keep the socket alive
            # and detect disconnects promptly.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
