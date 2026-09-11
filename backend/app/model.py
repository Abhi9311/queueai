"""
QueuePredictionModel wraps a scikit-learn pipeline that predicts how long
an individual consultation will take (`consultation_duration_minutes`),
given features about the patient, the doctor, and the state of the queue
at that moment.

We use a RandomForestRegressor inside a ColumnTransformer pipeline. It's
swapped in here for XGBoost/LightGBM because it has zero extra system
dependencies and trains in well under a second on this dataset size ---
but the pipeline shape (feature list in, single regressor out) is exactly
what you'd keep if you swapped the regressor for XGBoost later. See the
README for notes on making that swap.
"""
from __future__ import annotations

from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from .data_generator import generate_historical_dataset

CATEGORICAL_FEATURES = ["doctor", "department", "appointment_type", "patient_type"]
NUMERIC_FEATURES = [
    "hour_of_day",
    "day_of_week",
    "historical_doctor_avg_time",
    "queue_length_at_start",
    "time_since_doctor_started_min",
    "previous_patient_duration",
]
ALL_FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES
TARGET = "consultation_duration_minutes"


def build_pipeline() -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            ("categorical", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
            ("numeric", "passthrough", NUMERIC_FEATURES),
        ]
    )
    regressor = RandomForestRegressor(
        n_estimators=200,
        max_depth=10,
        min_samples_leaf=4,
        random_state=42,
        n_jobs=-1,
    )
    return Pipeline(steps=[("preprocess", preprocessor), ("model", regressor)])


class QueuePredictionModel:
    """Trains itself on synthetic historical data and serves predictions.

    In production you would train offline (see train_model.py), persist the
    artifact with joblib, and have the API load it at startup. For this
    project the training set is synthetic and trains in under a second, so
    the API trains fresh on startup if no saved model is found.
    """

    def __init__(self, model_path: Optional[str] = None):
        self.pipeline: Pipeline = build_pipeline()
        self.mae_minutes: float = float("nan")
        self._trained = False
        if model_path:
            try:
                self.pipeline = joblib.load(model_path)
                self._trained = True
            except FileNotFoundError:
                pass

    def train(
        self,
        n_rows: int = 6000,
        seed: int = 7,
        extra_doctors: Optional[list] = None,
    ) -> "QueuePredictionModel":
        df = generate_historical_dataset(n_rows=n_rows, seed=seed, extra_doctors=extra_doctors)
        X = df[ALL_FEATURES]
        y = df[TARGET]
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        self.pipeline.fit(X_train, y_train)
        preds = self.pipeline.predict(X_test)
        self.mae_minutes = float(mean_absolute_error(y_test, preds))
        self._trained = True
        return self

    def save(self, path: str) -> None:
        joblib.dump(self.pipeline, path)

    def predict_duration(self, features: dict) -> float:
        if not self._trained:
            raise RuntimeError("Model has not been trained yet.")
        row = pd.DataFrame([{k: features[k] for k in ALL_FEATURES}])
        pred = self.pipeline.predict(row)[0]
        return float(np.clip(pred, 2, 60))

    def predict_batch(self, rows: list[dict]) -> list[float]:
        if not self._trained:
            raise RuntimeError("Model has not been trained yet.")
        frame = pd.DataFrame(rows)[ALL_FEATURES]
        preds = self.pipeline.predict(frame)
        return [float(np.clip(p, 2, 60)) for p in preds]

    def confidence_for(self, patients_ahead: int) -> float:
        """A simple, explainable confidence heuristic: certainty falls off
        the further out a prediction has to compound across multiple
        upcoming (and therefore uncertain) consultations."""
        base = 0.93
        decay = 0.025 * patients_ahead
        return round(float(np.clip(base - decay, 0.35, 0.95)), 3)
