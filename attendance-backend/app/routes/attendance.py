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
        synced       INTEGER DEFAULT 0,
        photo_path   TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS failed_attempts (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_id TEXT,
        timestamp TEXT,
        latitude  REAL,
        longitude REAL,
        reason    TEXT,
        photo_path TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS workers (
        worker_id  TEXT PRIMARY KEY,
        name       TEXT,
        password   TEXT,
        role       TEXT,
        phone      TEXT,
        department TEXT,
        embedding  TEXT,
        work_site_id TEXT,
        work_site_name TEXT,
        work_site_lat REAL,
        work_site_lon REAL,
        work_site_radius REAL,
        dob TEXT
    )''')
    
    # Try adding photo_path column to existing tables just in case
    try:
        c.execute("ALTER TABLE attendance ADD COLUMN photo_path TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE failed_attempts ADD COLUMN photo_path TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE workers ADD COLUMN work_site_id TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE workers ADD COLUMN work_site_name TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE workers ADD COLUMN work_site_lat REAL")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE workers ADD COLUMN work_site_lon REAL")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE workers ADD COLUMN work_site_radius REAL")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE workers ADD COLUMN dob TEXT")
    except sqlite3.OperationalError:
        pass
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
    # Get worker saved embedding and work site details from sqlite
    conn = sqlite3.connect(DB_PATH)
    c    = conn.cursor()
    c.execute("SELECT name, embedding, work_site_lat, work_site_lon, work_site_radius FROM workers WHERE worker_id = ?", (req.worker_id,))
    row  = c.fetchone()
    conn.close()

    if not row:
        return {"success": False, "message": "Worker not registered ❌"}

    worker_name     = row[0]
    saved_embedding = json.loads(row[1])
    site_lat        = row[2] if row[2] is not None else req.site_lat
    site_lon        = row[3] if row[3] is not None else req.site_lon
    site_radius     = row[4] if row[4] is not None else 200.0
    previous_hash   = get_last_hash()

    import base64
    import time
    
    # Save photo to disk
    os.makedirs("saved_models/photos", exist_ok=True)
    photo_filename = f"{req.worker_id}_{int(time.time())}.jpg"
    photo_path = f"saved_models/photos/{photo_filename}"
    try:
        with open(photo_path, "wb") as f:
            f.write(base64.b64decode(req.image_base64))
    except Exception as e:
        photo_path = ""

    # Run full 6-module pipeline
    result = full_verify_pipeline(
        base64_image    = req.image_base64,
        saved_embedding = saved_embedding,
        lat             = req.latitude,
        lon             = req.longitude,
        site_lat        = site_lat,
        site_lon        = site_lon,
        site_radius     = site_radius,
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
        c.execute("INSERT INTO failed_attempts (worker_id, timestamp, latitude, longitude, reason, photo_path) VALUES (?,?,?,?,?,?)",
                  (req.worker_id, req.timestamp, req.latitude, req.longitude, result.get("reason", "Unknown"), photo_path))
        conn.commit()
        conn.close()
        return {"success": False, "worker_id": req.worker_id, "message": result["reason"]}

    # Save attendance with hash chain
    conn = sqlite3.connect(DB_PATH)
    c    = conn.cursor()
    c.execute('''INSERT INTO attendance
        (worker_id, worker_name, similarity, latitude, longitude, timestamp, risk_level, trust_score, record_hash, synced, photo_path)
        VALUES (?,?,?,?,?,?,?,?,?,0,?)''',
        (req.worker_id, worker_name, result["similarity"],
         req.latitude, req.longitude, req.timestamp,
         result["risk_level"], result["trust_score"], result["record_hash"], photo_path))
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

@router.get("/attendance/all")
def get_all_records():
    conn = sqlite3.connect(DB_PATH)
    c    = conn.cursor()
    
    # Load workers to get departments
    c.execute("SELECT worker_id, department, role FROM workers")
    workers_rows = c.fetchall()
    workers_map = {r[0]: {"department": r[1], "role": r[2]} for r in workers_rows}

    c.execute("SELECT * FROM attendance ORDER BY id DESC")
    att_rows = c.fetchall()
    att_cols = ["id","worker_id","worker_name","similarity","latitude","longitude","timestamp","risk_level","trust_score","record_hash","synced","photo_path"]
    attendance_records = [dict(zip(att_cols, r)) for r in att_rows]
    
    # Read photo as base64 and attach department for dashboard
    import base64
    for rec in attendance_records:
        wid = rec["worker_id"]
        rec["department"] = workers_map.get(wid, {}).get("department", "Unassigned")
        rec["role"]       = workers_map.get(wid, {}).get("role", "Unknown")
        
        path = rec.get("photo_path")
        if path and os.path.exists(path):
            with open(path, "rb") as f:
                rec["image_base64"] = base64.b64encode(f.read()).decode('utf-8')
        else:
            rec["image_base64"] = None

    c.execute("SELECT * FROM failed_attempts ORDER BY id DESC")
    fail_rows = c.fetchall()
    fail_cols = ["id","worker_id","timestamp","latitude","longitude","reason","photo_path"]
    failed_records = [dict(zip(fail_cols, r)) for r in fail_rows]
    
    for rec in failed_records:
        wid = rec["worker_id"]
        rec["department"] = workers_map.get(wid, {}).get("department", "Unassigned")
        rec["role"]       = workers_map.get(wid, {}).get("role", "Unknown")

        path = rec.get("photo_path")
        if path and os.path.exists(path):
            with open(path, "rb") as f:
                rec["image_base64"] = base64.b64encode(f.read()).decode('utf-8')
        else:
            rec["image_base64"] = None
            
    conn.close()
    return {"attendance": attendance_records, "failed_attempts": failed_records}