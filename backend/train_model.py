"""
Standalone training script.

Run this to train the consultation-duration model on the synthetic
historical dataset and persist it to disk as model.joblib. The FastAPI
app will automatically pick up backend/model.joblib on startup if it
exists; otherwise it trains an equivalent model in-memory on boot.

Usage:
    python train_model.py
"""
from app.model import QueuePredictionModel

if __name__ == "__main__":
    model = QueuePredictionModel()
    model.train(n_rows=6000, seed=7)
    model.save("model.joblib")
    print(f"Trained model on 6000 synthetic consultations.")
    print(f"Held-out mean absolute error: {model.mae_minutes:.2f} minutes")
    print("Saved to backend/model.joblib")
