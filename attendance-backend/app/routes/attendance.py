from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from app.services.face_service import full_verify_pipeline, verify_face
import sqlite3, json, os, hashlib, datetime

router  = APIRouter()
DB_PATH = os.path.join(os.path.dirname(__file__), "../../attendance.db")

# ── Request model ──
class AttendanceRequest(BaseModel):
    worker_id       : str
    image_base64    : str
    latitude        : float
    longitude       : float
    timestamp       : str
    site_lat        : Optional[float] = 17.4532
    site_lon        : Optional[float] = 78.3821
    ear_value       : Optional[float] = 0.20
    response_latency: Optional[float] = 280.0
    challenge       : Optional[str]   = "blink"
    is_mock_location: Optional[bool]  = False
    wifi_bssids     : Optional[List[str]] = []

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c    = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS attendance (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_id    TEXT NOT NULL,
        worker_name  TEXT,
        similarity   REAL,
        latitude     REAL,
        longitude    REAL,
        timestamp    TEXT,
        risk_level   TEXT,
        trust_score  REAL,
        record_hash  TEXT,
        synced       INTEGER DEFAULT 0
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS failed_attempts (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_id TEXT,
        timestamp TEXT,
        latitude  REAL,
        longitude REAL,
        reason    TEXT
    )''')
    conn.commit()
    conn.close()

init_db()

def get_last_hash() -> str:
    conn = sqlite3.connect(DB_PATH)
    c    = conn.cursor()
    c.execute("SELECT record_hash FROM attendance ORDER BY id DESC LIMIT 1")
    row  = c.fetchone()
    conn.close()
    return row[0] if row else "GENESIS"

@router.post("/attendance/checkin")
def check_in(req: AttendanceRequest):
    # Get worker saved embedding
    conn = sqlite3.connect(DB_PATH)
    c    = conn.cursor()
    c.execute("SELECT worker_name, embedding FROM workers WHERE worker_id = ?", (req.worker_id,))
    row  = c.fetchone()
    conn.close()

    if not row:
        return {"success": False, "message": "Worker not registered ❌"}

    worker_name     = row[0]
    saved_embedding = json.loads(row[1])
    previous_hash   = get_last_hash()

    # Run full 6-module pipeline
    result = full_verify_pipeline(
        base64_image    = req.image_base64,
        saved_embedding = saved_embedding,
        lat             = req.latitude,
        lon             = req.longitude,
        site_lat        = req.site_lat,
        site_lon        = req.site_lon,
        ear_value       = req.ear_value,
        response_latency= req.response_latency,
        challenge       = req.challenge,
        is_mock_location= req.is_mock_location,
        previous_hash   = previous_hash
    )

    if not result["success"]:
        # Log failed attempt
        conn = sqlite3.connect(DB_PATH)
        c    = conn.cursor()
        c.execute("INSERT INTO failed_attempts (worker_id, timestamp, latitude, longitude, reason) VALUES (?,?,?,?,?)",
                  (req.worker_id, req.timestamp, req.latitude, req.longitude, result.get("reason", "Unknown")))
        conn.commit()
        conn.close()
        return {"success": False, "worker_id": req.worker_id, "message": result["reason"]}

    # Save attendance with hash chain
    conn = sqlite3.connect(DB_PATH)
    c    = conn.cursor()
    c.execute('''INSERT INTO attendance
        (worker_id, worker_name, similarity, latitude, longitude, timestamp, risk_level, trust_score, record_hash, synced)
        VALUES (?,?,?,?,?,?,?,?,?,0)''',
        (req.worker_id, worker_name, result["similarity"],
         req.latitude, req.longitude, req.timestamp,
         result["risk_level"], result["trust_score"], result["record_hash"]))
    conn.commit()
    conn.close()

    return {
        "success"    : True,
        "worker_name": worker_name,
        "similarity" : result["similarity"],
        "risk_level" : result["risk_level"],
        "trust_score": result["trust_score"],
        "in_zone"    : result["in_zone"],
        "elapsed_ms" : result["elapsed_ms"],
        "message"    : f"Attendance marked ✅ | {result['similarity']}% match | Risk: {result['risk_level']}"
    }

@router.get("/attendance/unsynced")
def get_unsynced():
    conn = sqlite3.connect(DB_PATH)
    c    = conn.cursor()
    c.execute("SELECT * FROM attendance WHERE synced = 0")
    rows = c.fetchall()
    conn.close()
    cols = ["id","worker_id","worker_name","similarity","latitude","longitude","timestamp","risk_level","trust_score","record_hash","synced"]
    return {"records": [dict(zip(cols, r)) for r in rows]}

@router.post("/attendance/mark-synced")
def mark_synced(ids: list[int]):
    conn = sqlite3.connect(DB_PATH)
    c    = conn.cursor()
    for rid in ids:
        c.execute("UPDATE attendance SET synced = 1 WHERE id = ?", (rid,))
    conn.commit()
    conn.close()
    return {"message": f"{len(ids)} records synced and purged ✅"}

@router.get("/attendance/verify-chain")
def verify_chain_endpoint():
    from app.services.risk_service import verify_record_chain
    conn = sqlite3.connect(DB_PATH)
    c    = conn.cursor()
    c.execute("SELECT worker_id, timestamp, similarity, record_hash FROM attendance ORDER BY id")
    rows = c.fetchall()
    conn.close()
    records = [{"worker_id": r[0], "timestamp": r[1], "similarity": r[2], "record_hash": r[3]} for r in rows]
    return verify_record_chain(records)