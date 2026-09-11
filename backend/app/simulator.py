"""
The QueueSimulator is the heart of the "live" part of this project.

Since we don't have a real clinic feeding us real appointment-completed
events, this module plays that role: it holds an in-memory queue of
patients for one doctor's session, and every SIM_TICK_SECONDS it advances
the "now serving" patient forward, exactly the way a real event would
arrive from a hospital's appointment system. On every advance it:

  1. records the actual duration the just-finished consultation took
  2. updates the doctor's running "today" average
  3. re-predicts the duration of every remaining waiting patient using
     the ML model, with fresh features (updated queue length, updated
     "previous patient duration", updated elapsed time)
  4. recomputes each patient's predicted wait / expected clock time
  5. broadcasts the full new state to every connected WebSocket client

A real system would replace step 0 (the tick loop) with a webhook or
message-queue consumer reacting to real "consultation completed" events
from the hospital's appointment system, and everything downstream
(2 through 5) stays the same.
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional

import numpy as np
from fastapi import WebSocket

from .data_generator import generate_todays_queue
from .model import QueuePredictionModel

SIM_TICK_SECONDS = 4.0  # how often (real seconds) the simulated clinic advances
SIM_MINUTES_PER_TICK_VARIANCE = 0.15  # jitter applied to actual vs predicted duration


@dataclass
class Patient:
    token: int
    doctor: str
    department: str
    appointment_type: str
    patient_type: str
    # Cosmetic identity fields for the Patient Profile tab -- synthetic,
    # generated fresh each session, never real patient data.
    full_name: str
    gender: str
    age: int
    date_of_birth: str
    weight_kg: float
    height_cm: float
    phone_number: str
    email: str
    last_visit_date: str
    last_visit_reason: str
    status: str = "waiting"  # waiting | serving | completed
    predicted_duration_min: Optional[float] = None
    actual_duration_min: Optional[float] = None
    scheduled_time: datetime = field(default_factory=datetime.now)
    predicted_start_time: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None
    added_by_staff: bool = False


class ConnectionManager:
    def __init__(self) -> None:
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: dict) -> None:
        stale = []
        payload = json.dumps(message, default=str)
        for ws in self.active:
            try:
                await ws.send_text(payload)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(ws)


class QueueSimulator:
    def __init__(
        self,
        model: QueuePredictionModel,
        manager: ConnectionManager,
        n_patients: int = 40,
        doctor_name: Optional[str] = None,
        department: Optional[str] = None,
        initial_avg_consultation_min: Optional[float] = None,
    ):
        self.model = model
        self.manager = manager
        self.rng = np.random.default_rng()

        df = generate_todays_queue(n_patients=n_patients, doctor_name=doctor_name, department=department)
        self.doctor = df.attrs["doctor"]
        self.department = df.attrs["department"]
        self.started_at = datetime.now()
        self.day_of_week = int(datetime.now().weekday())
        self.historical_doctor_avg_time = (
            initial_avg_consultation_min if initial_avg_consultation_min is not None else 11.0
        )
        self.todays_completed_durations: List[float] = []
        self.previous_patient_duration = 11.0

        self.patients: List[Patient] = [
            Patient(
                token=int(row.token),
                doctor=row.doctor,
                department=row.department,
                appointment_type=row.appointment_type,
                patient_type=row.patient_type,
                full_name=row.full_name,
                gender=row.gender,
                age=int(row.age),
                date_of_birth=row.date_of_birth,
                weight_kg=float(row.weight_kg),
                height_cm=float(row.height_cm),
                phone_number=row.phone_number,
                email=row.email,
                last_visit_date=row.last_visit_date,
                last_visit_reason=row.last_visit_reason,
                scheduled_time=self.started_at + timedelta(minutes=11 * i),
            )
            for i, row in df.iterrows()
        ]
        self.serving_index = 0
        self.patients[0].status = "serving"
        self._recompute_predictions()

        self._task: Optional[asyncio.Task] = None

    # ---------------------------------------------------------- lifecycle
    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._run_loop())

    def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            self._task = None

    async def _run_loop(self) -> None:
        while True:
            await asyncio.sleep(SIM_TICK_SECONDS)
            self.advance()
            await self.manager.broadcast(self.to_public_state())

    # ------------------------------------------------------------- logic
    def _features_for(self, patient: Patient, queue_length_at_start: int, time_since_start_min: float) -> dict:
        return {
            "doctor": patient.doctor,
            "department": patient.department,
            "appointment_type": patient.appointment_type,
            "patient_type": patient.patient_type,
            "hour_of_day": datetime.now().hour,
            "day_of_week": self.day_of_week,
            "historical_doctor_avg_time": self.historical_doctor_avg_time,
            "queue_length_at_start": queue_length_at_start,
            "time_since_doctor_started_min": time_since_start_min,
            "previous_patient_duration": self.previous_patient_duration,
        }

    def _recompute_predictions(self) -> None:
        """Re-run the model for every waiting patient using fresh queue state.
        This is what makes the ETA feel 'live': every tick, the whole tail
        of the queue gets re-predicted against the newest known conditions,
        not just recalculated with a static average."""
        elapsed = (datetime.now() - self.started_at).total_seconds() / 60.0
        waiting = [p for p in self.patients if p.status == "waiting"]
        rows = [
            self._features_for(
                p,
                queue_length_at_start=len(waiting),
                time_since_start_min=elapsed + 11.0 * i,
            )
            for i, p in enumerate(waiting)
        ]
        if rows:
            preds = self.model.predict_batch(rows)
            for p, pred in zip(waiting, preds):
                p.predicted_duration_min = pred

        # Roll predicted clock times forward from whoever is currently serving.
        cursor = datetime.now()
        serving = self.current_patient()
        if serving is not None and serving.predicted_duration_min:
            remaining = max(serving.predicted_duration_min * 0.5, 1.0)
            cursor = cursor + timedelta(minutes=remaining)
        for p in waiting:
            p.predicted_start_time = cursor
            cursor = cursor + timedelta(minutes=p.predicted_duration_min or self.historical_doctor_avg_time)

    def current_patient(self) -> Optional[Patient]:
        if 0 <= self.serving_index < len(self.patients):
            return self.patients[self.serving_index]
        return None

    def matches_session(self, doctor_name: str, department: str) -> bool:
        return self.doctor == doctor_name and self.department == department

    def add_patient(
        self,
        full_name: str,
        age: int,
        gender: str,
        phone_number: str,
        email: str,
        weight_kg: float,
        height_cm: float,
        appointment_type: str = "new_patient",
        notes: Optional[str] = None,
    ) -> Patient:
        """Register a walk-in / staff-entered patient into this live session,
        at the back of the queue, with a freshly issued token number. Their
        wait time is predicted the same way as every synthetic patient's --
        recomputing right away so they show up in Live Queue immediately."""
        from .data_generator import patient_type_for_age  # local import avoids a cycle at module load

        next_token = max((p.token for p in self.patients), default=0) + 1
        last_scheduled = max((p.scheduled_time for p in self.patients), default=self.started_at)

        patient = Patient(
            token=next_token,
            doctor=self.doctor,
            department=self.department,
            appointment_type=appointment_type,
            patient_type=patient_type_for_age(age),
            full_name=full_name,
            gender=gender,
            age=age,
            date_of_birth="",
            weight_kg=weight_kg,
            height_cm=height_cm,
            phone_number=phone_number,
            email=email,
            last_visit_date="",
            last_visit_reason="First visit",
            scheduled_time=last_scheduled + timedelta(minutes=11),
            notes=notes,
            added_by_staff=True,
        )
        self.patients.append(patient)
        self._recompute_predictions()
        return patient

    def advance(self) -> None:
        """Simulate the currently-served patient finishing, and the next one starting."""
        current = self.current_patient()
        if current is None:
            return  # queue fully drained

        predicted = current.predicted_duration_min or self.historical_doctor_avg_time
        jitter = self.rng.normal(0, predicted * SIM_MINUTES_PER_TICK_VARIANCE)
        actual = float(np.clip(predicted + jitter, 2, 45))

        current.actual_duration_min = round(actual, 1)
        current.status = "completed"
        current.completed_at = datetime.now()

        self.todays_completed_durations.append(actual)
        self.previous_patient_duration = actual
        window = self.todays_completed_durations[-8:]
        self.historical_doctor_avg_time = float(np.mean(window)) if window else self.historical_doctor_avg_time

        self.serving_index += 1
        next_patient = self.current_patient()
        if next_patient is not None:
            next_patient.status = "serving"

        self._recompute_predictions()

    # -------------------------------------------------------- public API
    def todays_avg(self) -> float:
        if not self.todays_completed_durations:
            return self.historical_doctor_avg_time
        return float(np.mean(self.todays_completed_durations))

    def last_patient_duration(self) -> Optional[float]:
        if not self.todays_completed_durations:
            return None
        return round(self.todays_completed_durations[-1], 1)

    def patients_ahead_of(self, token: int) -> int:
        target = next((p for p in self.patients if p.token == token), None)
        if target is None:
            return 0
        return sum(1 for p in self.patients if p.status == "waiting" and p.token < token) + (
            1 if self.current_patient() and self.current_patient().status == "serving" else 0
        )

    def predict_for_token(self, token: int) -> Optional[dict]:
        target = next((p for p in self.patients if p.token == token), None)
        if target is None:
            return None

        if target.status == "completed":
            return {
                "token": token,
                "status": "completed",
                "patients_ahead": 0,
                "predicted_wait_min": 0.0,
                "expected_time": (target.predicted_start_time or datetime.now()).isoformat(),
                "confidence": 1.0,
                "delay_min": 0.0,
                "is_delayed": False,
            }

        ahead = [p for p in self.patients if p.status == "waiting" and p.token < token]
        wait_min = sum(p.predicted_duration_min or self.historical_doctor_avg_time for p in ahead)
        serving = self.current_patient()
        if serving is not None and serving.status == "serving" and serving.token < token:
            wait_min += (serving.predicted_duration_min or self.historical_doctor_avg_time) * 0.5

        original_schedule = target.scheduled_time
        expected_time = target.predicted_start_time or (datetime.now() + timedelta(minutes=wait_min))
        delay_min = max((expected_time - original_schedule).total_seconds() / 60.0, 0.0)

        return {
            "token": token,
            "status": target.status,
            "patients_ahead": len(ahead),
            "predicted_wait_min": round(wait_min, 1),
            "expected_time": expected_time.isoformat(),
            "confidence": self.model.confidence_for(len(ahead)),
            "delay_min": round(delay_min, 1),
            "is_delayed": delay_min > 10,
        }

    def to_public_state(self) -> dict:
        current = self.current_patient()
        return {
            "now_serving": current.token if current and current.status == "serving" else None,
            "patients_ahead_of_next": sum(1 for p in self.patients if p.status == "waiting"),
            "doctor": {
                "doctor_name": self.doctor,
                "department": self.department,
                "avg_consultation_min": round(self.historical_doctor_avg_time, 1),
                "todays_avg_consultation_min": round(self.todays_avg(), 1),
                "last_patient_duration_min": self.last_patient_duration(),
                "started_at": self.started_at.isoformat(),
            },
            "patients": [
                {
                    "token": p.token,
                    "status": p.status,
                    "predicted_duration_min": round(p.predicted_duration_min, 1) if p.predicted_duration_min else None,
                    "actual_duration_min": p.actual_duration_min,
                    "scheduled_time": p.scheduled_time.isoformat(),
                    "predicted_start_time": p.predicted_start_time.isoformat() if p.predicted_start_time else None,
                    "completed_at": p.completed_at.isoformat() if p.completed_at else None,
                    "doctor": p.doctor,
                    "department": p.department,
                    "appointment_type": p.appointment_type,
                    "patient_type": p.patient_type,
                    "full_name": p.full_name,
                    "gender": p.gender,
                    "age": p.age,
                    "date_of_birth": p.date_of_birth,
                    "weight_kg": p.weight_kg,
                    "height_cm": p.height_cm,
                    "phone_number": p.phone_number,
                    "email": p.email,
                    "last_visit_date": p.last_visit_date,
                    "last_visit_reason": p.last_visit_reason,
                    "notes": p.notes,
                    "added_by_staff": p.added_by_staff,
                }
                for p in self.patients
            ],
            "server_time": datetime.now().isoformat(),
        }
