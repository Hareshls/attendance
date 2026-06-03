# Entry point for the FastAPI server
# Loads the ML model once at startup
# Registers all routes
# Handles CORS so React Native app can call this API

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import attendance, register

app = FastAPI(
    title       = "Attendance API",
    description = "Offline face attendance system for remote workers",
    version     = "1.0.0"
)

# CORS allows the React Native app to call this API
# In production, replace * with your actual domain
app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["*"],
    allow_methods  = ["*"],
    allow_headers  = ["*"],
)

# Register route groups
app.include_router(register.router,   prefix="/api/v1", tags=["Registration"])
app.include_router(attendance.router, prefix="/api/v1", tags=["Attendance"])


@app.on_event("startup")
def startup_event():
    # Runs once when server starts
    # Loads TFLite model into memory
    print("Starting Attendance API...")
    print("API ready at http://localhost:8000")
    print("Docs at    http://localhost:8000/docs")


@app.get("/health")
def health():
    # Simple health check — React Native app pings this to check connection
    return {"status": "ok", "version": "1.0.0"}


@app.get("/")
def root():
    # Shows all available endpoints
    return {
        "message": "Attendance API running",
        "docs":    "http://localhost:8000/docs",
        "endpoints": {
            "register":   "POST /api/v1/register",
            "workers":    "GET  /api/v1/workers",
            "checkin":    "POST /api/v1/checkin",
            "attendance": "GET  /api/v1/attendance",
            "today":      "GET  /api/v1/attendance/today",
            "flagged":    "GET  /api/v1/attendance/flagged"
        }
    }