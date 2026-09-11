"""
Pydantic models describing the shapes returned by the REST and WebSocket
endpoints. Keeping these separate from the simulation logic makes it easy
to see, at a glance, the exact contract the React frontend depends on.
"""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel


class PatientPublic(BaseModel):
    token: int
    status: str  # "waiting" | "serving" | "completed"
    predicted_duration_min: Optional[float] = None
    actual_duration_min: Optional[float] = None
    scheduled_time: str
    predicted_start_time: Optional[str] = None
    completed_at: Optional[str] = None
    doctor: str
    department: str
    appointment_type: str
    patient_type: str
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
    notes: Optional[str] = None
    added_by_staff: bool = False


class DoctorInfo(BaseModel):
    name: str
    department: Optional[str] = None  # None for built-in doctors, who see every department
    avg_consultation_min: float
    is_custom: bool


class AddDoctorRequest(BaseModel):
    name: str
    department: str
    avg_consultation_min: float


class AddDoctorResponse(BaseModel):
    doctors: List[DoctorInfo]
    model_mae_minutes: float


class ResetRequest(BaseModel):
    doctor_name: Optional[str] = None
    department: Optional[str] = None


class AddPatientRequest(BaseModel):
    full_name: str
    age: int
    gender: Optional[str] = "unspecified"
    phone_number: str
    email: str
    weight_kg: float
    height_cm: float
    doctor_name: str
    department: str
    notes: Optional[str] = None


class AddPatientResponse(BaseModel):
    token: int
    doctor: str
    department: str
    started_new_session: bool


class DoctorStats(BaseModel):
    doctor_name: str
    department: str
    avg_consultation_min: float
    todays_avg_consultation_min: float
    last_patient_duration_min: Optional[float] = None
    started_at: str


class QueueState(BaseModel):
    now_serving: Optional[int]
    patients_ahead_of_next: int
    doctor: DoctorStats
    patients: List[PatientPublic]
    server_time: str


class TokenPrediction(BaseModel):
    token: int
    status: str
    patients_ahead: int
    predicted_wait_min: float
    expected_time: str
    confidence: float
    delay_min: float
    is_delayed: bool
