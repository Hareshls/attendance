# Registration endpoint
# Worker visits office once, scans face, embedding saved to disk
# From then on they can check in from the field with no internet

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services.face_service import get_embedding, full_verify_pipeline
import json
import os
import numpy as np
import sqlite3

router = APIRouter()

DB_PATH = os.path.join(os.path.dirname(__file__), "../../attendance.db")


@router.post("/register")
async def register_worker(
    worker_id: str        = Form(...),   # unique ID like EMP001
    name:      str        = Form(...),   # worker's full name
    password:  str        = Form(default=""),   # optional password
    role:      str        = Form(default=""),   # worker's role
    phone:     str        = Form(default=""),   # worker's phone
    department:str        = Form(default=""),   # worker's department
    image:     UploadFile = File(...)    # face photo
):
    # Validate it's an image
    if not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="File must be an image (jpg or png)"
        )

    image_bytes = await image.read()

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty image file")

    # Run face through FaceNet → get 128-number embedding
    try:
        import cv2
        import numpy as np
        from app.services.face_service import detect_face
        
        img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Invalid image file")
            
        face = detect_face(img)
        embedding = get_embedding(face).tolist()
    except Exception as e:
        return {"success": False, "message": "Face processing failed: " + str(e)}

    # Convert embedding to JSON string
    embedding_json = json.dumps(embedding)

    # Save to SQLite DB
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT worker_id FROM workers WHERE worker_id = ?", (worker_id,))
        exists = c.fetchone()

        if exists:
            c.execute('''UPDATE workers 
                         SET name=?, password=?, role=?, phone=?, department=?, embedding=? 
                         WHERE worker_id=?''',
                      (name, password, role, phone, department, embedding_json, worker_id))
            message = "Worker " + name + " embedding updated"
        else:
            c.execute('''INSERT INTO workers 
                         (worker_id, name, password, role, phone, department, embedding) 
                         VALUES (?,?,?,?,?,?,?)''',
                      (worker_id, name, password, role, phone, department, embedding_json))
            message = "Worker " + name + " registered successfully"
        
        conn.commit()
        conn.close()
    except Exception as db_err:
        return {"success": False, "message": "Database error: " + str(db_err)}

    return {
        "success":   True,
        "worker_id": worker_id,
        "name":      name,
        "message":   message,
        "embedding": embedding
    }


@router.get("/workers")
def get_all_workers():
    # Returns list of all registered workers (no embeddings exposed)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT worker_id, name FROM workers")
    workers = [{"worker_id": row[0], "name": row[1]} for row in c.fetchall()]
    conn.close()
    return {"total": len(workers), "workers": workers}


@router.get("/worker/delete/{worker_id}")
def delete_worker(worker_id: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT worker_id FROM workers WHERE worker_id = ?", (worker_id,))
    if not c.fetchone():
        conn.close()
        raise HTTPException(
            status_code=404,
            detail=f"Worker {worker_id} not found."
        )
    
    c.execute("DELETE FROM workers WHERE worker_id = ?", (worker_id,))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Worker " + worker_id + " deleted"}

@router.post("/worker/login")
def worker_login(worker_id: str = Form(...), password: str = Form(...)):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT name, password, department, role FROM workers WHERE worker_id = ?", (worker_id,))
    row = c.fetchone()
    conn.close()

    if row:
        name, saved_pwd, department, role = row
        if saved_pwd and saved_pwd != password:
            return {"success": False, "message": "Incorrect password."}

        return {
            "success": True, 
            "worker_id": worker_id, 
            "name": name,
            "department": department or "",
            "role": role or ""
        }
    else:
        return {"success": False, "message": "Worker ID not found. Please register first."}

from pydantic import BaseModel
import datetime

class FaceLoginRequest(BaseModel):
    worker_id: str
    password: str = ""
    image_base64: str

@router.post("/worker/face-login")
def worker_face_login(req: FaceLoginRequest):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT name, department, role, embedding, password FROM workers WHERE worker_id = ?", (req.worker_id,))
    row = c.fetchone()
    conn.close()

    if not row:
        return {"success": False, "message": "Worker not registered"}

    name, department, role, embedding_str, saved_pwd = row
    
    saved_embedding = json.loads(embedding_str)

    # Use the full_verify_pipeline to check for liveness/spoofs. We skip location checks by passing mock coords.
    result = full_verify_pipeline(
        base64_image=req.image_base64,
        saved_embedding=saved_embedding,
        lat=0.0,
        lon=0.0,
        site_lat=0.0,
        site_lon=0.0,
        ear_value=0.20,
        response_latency=300.0,
        challenge="blink",
        is_mock_location=False,
        previous_hash="LOGIN"
    )

    if not result["success"]:
        # Log to failed_attempts so supervisor can see the spoof
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        timestamp = datetime.datetime.now().isoformat()
        
        # Save photo to disk for supervisor review
        import base64
        import time
        os.makedirs("saved_models/photos", exist_ok=True)
        photo_path = f"saved_models/photos/login_{req.worker_id}_{int(time.time())}.jpg"
        try:
            with open(photo_path, "wb") as f:
                f.write(base64.b64decode(req.image_base64))
        except:
            photo_path = ""
            
        c.execute("INSERT INTO failed_attempts (worker_id, timestamp, latitude, longitude, reason, photo_path) VALUES (?,?,?,?,?,?)",
                  (req.worker_id, timestamp, 0.0, 0.0, f"Login Spoof: {result.get('reason', 'Unknown')}", photo_path))
        conn.commit()
        conn.close()
        return {"success": False, "message": result.get("reason", "Face verification failed")}

    return {
        "success": True, 
        "worker_id": req.worker_id, 
        "name": name,
        "department": department or "",
        "role": role or ""
    }