from fastapi import FastAPI
from .api import incidents

app = FastAPI(title="Factory WHY - Backend Slice")

app.include_router(incidents.router, prefix="/api")
