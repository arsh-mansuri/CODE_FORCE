"""Run from backend/: uvicorn main:app --reload --port 8000."""
from app.main import create_app

app = create_app()
