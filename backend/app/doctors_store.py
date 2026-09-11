"""
A tiny in-memory store for doctors added at runtime through the
"Doctors" tab. Kept separate from the simulator/model so both can import
it without a circular dependency. Not persisted to disk on purpose --
this is a demo project with a synthetic dataset; see the README's
"Going to production" section for how this would become a real table.
"""
from __future__ import annotations

from typing import Dict, List, Optional

_custom_doctors: List[Dict] = []


def list_custom_doctors() -> List[Dict]:
    return list(_custom_doctors)


def add_custom_doctor(name: str, department: str, avg_consultation_min: float) -> List[Dict]:
    global _custom_doctors
    _custom_doctors = [d for d in _custom_doctors if d["name"] != name]
    _custom_doctors.append({
        "name": name,
        "department": department,
        "avg_consultation_min": avg_consultation_min,
    })
    return list(_custom_doctors)


def get_custom_doctor(name: str) -> Optional[Dict]:
    return next((d for d in _custom_doctors if d["name"] == name), None)
