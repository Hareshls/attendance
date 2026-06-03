# Pydantic schemas define the shape of API request/response data
# FastAPI uses these to auto-validate inputs and auto-generate /docs
from pydantic import BaseModel
from typing import Optional

class WorkerRegisterResponse(BaseModel):
    # Shape of response when registering a worker
    success:   bool
    worker_id: str
    name:      str
    message:   str

class CheckInResponse(BaseModel):
    # Shape of response when worker checks in
    success:    bool
    verified:   bool
    similarity: float
    message:    str

class WorkerInfo(BaseModel):
    # Minimal worker info for listing
    worker_id: str
    name:      str

class AttendanceRecord(BaseModel):
    # Full attendance record shape
    id:         str
    worker_id:  str
    name:       str
    timestamp:  str
    latitude:   float
    longitude:  float
    similarity: float
    verified:   bool