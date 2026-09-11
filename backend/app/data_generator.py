"""
Synthetic data generation.

We don't have access to real hospital appointment data, so we generate a
realistic-looking historical dataset of consultations to train the model
on. The generating function bakes in a few believable real-world effects
so the model has actual signal to learn (rather than pure noise):

  * some departments/appointment types simply run longer than others
  * a doctor's consultations tend to speed up slightly as a session
    goes on (warm-up effect) then slow down late in the day (fatigue)
  * a long consultation is often followed by a shorter "catch-up" one
  * new patients take longer than follow-ups
  * queue pressure (a long line waiting) very mildly compresses time
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

DEPARTMENTS = ["General Medicine", "Pediatrics", "Dermatology", "Orthopedics"]
APPOINTMENT_TYPES = ["new_patient", "follow_up", "routine_checkup"]
PATIENT_TYPES = ["adult", "child", "senior"]

# ---- synthetic patient identity, for the "Patient Profile" tab -----------
# Purely cosmetic / fake data generated fresh for each simulated session --
# never sourced from anything real.
FIRST_NAMES_MALE = [
    "Abhishek", "Rohan", "Aarav", "Vikram", "Karan", "Rahul", "Arjun", "Sanjay",
    "Aditya", "Nikhil", "Manish", "Suresh", "Deepak", "Rajesh", "Kunal",
]
FIRST_NAMES_FEMALE = [
    "Priya", "Ananya", "Neha", "Pooja", "Kavita", "Sneha", "Isha", "Riya",
    "Divya", "Meera", "Anjali", "Sunita", "Shreya", "Nisha", "Kritika",
]
LAST_NAMES = [
    "Sharma", "Verma", "Gupta", "Iyer", "Nair", "Reddy", "Singh", "Mehta",
    "Kapoor", "Rao", "Joshi", "Kulkarni", "Chatterjee", "Bhatt", "Malhotra",
]
LAST_VISIT_REASONS = [
    "Routine checkup", "Fever", "Follow-up review", "Vaccination",
    "Skin allergy", "Joint pain", "Blood pressure review", "Seasonal cold",
]
DOCTORS = ["Dr. Rao", "Dr. Mehta", "Dr. Iyer"]

BASE_DURATION = {
    "General Medicine": 10.0,
    "Pediatrics": 9.0,
    "Dermatology": 8.0,
    "Orthopedics": 13.0,
}

APPOINTMENT_TYPE_OFFSET = {
    "new_patient": 6.0,
    "follow_up": 0.0,
    "routine_checkup": -2.0,
}

PATIENT_TYPE_OFFSET = {
    "adult": 0.0,
    "child": 2.0,
    "senior": 3.0,
}

DOCTOR_SPEED = {
    "Dr. Rao": -1.0,
    "Dr. Mehta": 1.5,
    "Dr. Iyer": 0.0,
}


def generate_historical_dataset(
    n_rows: int = 6000,
    seed: int = 7,
    extra_doctors: Optional[List[Dict]] = None,
) -> pd.DataFrame:
    """Generate n_rows of historical, *completed* consultations for model training.

    extra_doctors lets you fold in doctors added at runtime through the
    "Doctors" tab: a list of dicts like
        {"name": "Dr. Sharma", "department": "Pediatrics", "avg_consultation_min": 14.0}
    Each is treated as its own doctor category (so the model actually learns
    a distinct pattern for them) and, unlike the built-in doctors -- who see
    patients across all departments in this synthetic world -- a newly added
    doctor is tied mostly to the department they were registered under,
    which is the more realistic assumption for a single new hire.
    """
    extra_doctors = extra_doctors or []
    doctor_pool = list(DOCTORS) + [d["name"] for d in extra_doctors]
    doctor_home_department = {d["name"]: d["department"] for d in extra_doctors}
    doctor_speed = dict(DOCTOR_SPEED)
    for d in extra_doctors:
        baseline = BASE_DURATION[d["department"]]
        doctor_speed[d["name"]] = float(d["avg_consultation_min"]) - baseline

    rng = np.random.default_rng(seed)
    rows = []

    for _ in range(n_rows):
        doctor = rng.choice(doctor_pool)
        if doctor in doctor_home_department:
            # A newly added doctor is seen in their own department 85% of
            # the time, same as any real new hire would be.
            department = (
                doctor_home_department[doctor] if rng.random() < 0.85 else rng.choice(DEPARTMENTS)
            )
        else:
            department = rng.choice(DEPARTMENTS)

        appointment_type = rng.choice(APPOINTMENT_TYPES, p=[0.25, 0.55, 0.20])
        patient_type = rng.choice(PATIENT_TYPES, p=[0.55, 0.20, 0.25])
        hour_of_day = int(rng.integers(9, 18))
        day_of_week = int(rng.integers(0, 7))
        queue_length_at_start = int(rng.integers(0, 25))
        time_since_doctor_started_min = float(rng.integers(0, 240))
        previous_patient_duration = float(np.clip(rng.normal(11, 4), 3, 35))
        historical_doctor_avg_time = float(np.clip(
            BASE_DURATION[department] + doctor_speed[doctor] + rng.normal(0, 1), 5, 25
        ))

        # Fatigue curve: dips slightly mid-shift, rises again late in the day.
        fatigue = 0.015 * abs(time_since_doctor_started_min - 90) / 10

        # A very long previous consult is often followed by a shorter one
        # as the doctor tries to catch back up.
        catchup = -0.15 * max(previous_patient_duration - 12, 0)

        # Heavy queue pressure very mildly compresses consultation time.
        queue_pressure = -0.03 * queue_length_at_start

        duration = (
            BASE_DURATION[department]
            + APPOINTMENT_TYPE_OFFSET[appointment_type]
            + PATIENT_TYPE_OFFSET[patient_type]
            + doctor_speed[doctor]
            + fatigue
            + catchup
            + queue_pressure
            + rng.normal(0, 2.2)  # irreducible noise
        )
        duration = float(np.clip(duration, 3, 45))

        rows.append({
            "doctor": doctor,
            "department": department,
            "appointment_type": appointment_type,
            "patient_type": patient_type,
            "hour_of_day": hour_of_day,
            "day_of_week": day_of_week,
            "historical_doctor_avg_time": historical_doctor_avg_time,
            "queue_length_at_start": queue_length_at_start,
            "time_since_doctor_started_min": time_since_doctor_started_min,
            "previous_patient_duration": previous_patient_duration,
            "consultation_duration_minutes": duration,
        })

    return pd.DataFrame(rows)


_AGE_RANGE_BY_PATIENT_TYPE = {
    "child": (4, 14),
    "adult": (18, 55),
    "senior": (60, 85),
}
_WEIGHT_RANGE_BY_PATIENT_TYPE = {
    "child": (16, 45),
    "adult": (50, 95),
    "senior": (45, 82),
}
_HEIGHT_RANGE_BY_PATIENT_TYPE = {
    "child": (100, 155),
    "adult": (150, 190),
    "senior": (145, 180),
}


def patient_type_for_age(age: int) -> str:
    """Bucket a real (staff-entered) age into the same patient_type
    categories the model was trained on, so a walk-in patient's ML
    features stay consistent with the synthetic training data."""
    if age < 18:
        return "child"
    if age >= 60:
        return "senior"
    return "adult"


def _generate_patient_identity(rng: np.random.Generator, patient_type: str) -> dict:
    """Fake, cosmetic-only identity details for one patient, used purely to
    make the 'Patient Profile' tab feel like a real person rather than just
    a token number. None of this is derived from real patient data."""
    gender = rng.choice(["male", "female"])
    first_name = rng.choice(FIRST_NAMES_MALE if gender == "male" else FIRST_NAMES_FEMALE)
    last_name = rng.choice(LAST_NAMES)

    age_lo, age_hi = _AGE_RANGE_BY_PATIENT_TYPE[patient_type]
    age = int(rng.integers(age_lo, age_hi + 1))
    weight_lo, weight_hi = _WEIGHT_RANGE_BY_PATIENT_TYPE[patient_type]
    weight_kg = round(float(rng.uniform(weight_lo, weight_hi)), 1)
    height_lo, height_hi = _HEIGHT_RANGE_BY_PATIENT_TYPE[patient_type]
    height_cm = round(float(rng.uniform(height_lo, height_hi)), 1)

    today = date.today()
    # Approximate DOB from age; the +/- day jitter just avoids every
    # patient of the same age sharing the exact same birthday.
    dob = today - timedelta(days=age * 365 + int(rng.integers(0, 365)))

    last_visit_days_ago = int(rng.integers(14, 240))
    last_visit_date = today - timedelta(days=last_visit_days_ago)
    last_visit_reason = rng.choice(LAST_VISIT_REASONS)

    # Synthetic contact details. These double as the patient's own
    # self-service login credentials: a patient signs in with the phone
    # number + Gmail address tied to their token, and staff can look either
    # one up (alongside the token) from the Patients / Patient Profile tabs.
    phone_number = f"9{int(rng.integers(0, 10 ** 9)):09d}"
    email = f"{first_name.lower()}.{last_name.lower()}{int(rng.integers(10, 999))}@gmail.com"

    return {
        "full_name": f"{first_name} {last_name}",
        "gender": gender,
        "age": age,
        "date_of_birth": dob.isoformat(),
        "weight_kg": weight_kg,
        "height_cm": height_cm,
        "phone_number": phone_number,
        "email": email,
        "last_visit_date": last_visit_date.isoformat(),
        "last_visit_reason": str(last_visit_reason),
        "notes": None,
    }


def generate_todays_queue(
    n_patients: int = 40,
    seed: Optional[int] = None,
    doctor_name: Optional[str] = None,
    department: Optional[str] = None,
) -> pd.DataFrame:
    """Generate the feature rows for a single, fresh day's queue of patients.

    Pass doctor_name/department to pin a live session to a specific doctor
    (e.g. one just added through the Doctors tab) instead of a random one.
    """
    rng = np.random.default_rng(seed)
    doctor = doctor_name or rng.choice(DOCTORS)
    dept = department or rng.choice(DEPARTMENTS)

    rows = []
    for i in range(n_patients):
        patient_type = rng.choice(PATIENT_TYPES, p=[0.55, 0.20, 0.25])
        identity = _generate_patient_identity(rng, patient_type)
        rows.append({
            "token": i + 1,
            "doctor": doctor,
            "department": dept,
            "appointment_type": rng.choice(APPOINTMENT_TYPES, p=[0.25, 0.55, 0.20]),
            "patient_type": patient_type,
            "hour_of_day": 9,
            "day_of_week": int(pd.Timestamp.now().dayofweek),
            **identity,
        })
    df = pd.DataFrame(rows)
    df.attrs["doctor"] = doctor
    df.attrs["department"] = dept
    return df
