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
    work_site_id:     str        = Form(default=""),
    work_site_name:   str        = Form(default=""),
    work_site_lat:    float      = Form(default=None),
    work_site_lon:    float      = Form(default=None),
    work_site_radius: float      = Form(default=None),
    dob:              str        = Form(default=""),
    image:     UploadFile = File(None),   # face photo (optional if embedding is provided)
    embedding_json: str   = Form(default="") # Pre-calculated embedding from the edge device
):
    try:
        # If the mobile device already computed the embedding using its native C++ TFLite engine,
        # we just accept it directly! This ensures model compatibility and saves server CPU.
        embedding = []
        if embedding_json:
            # Just use the pre-calculated embedding
            embedding = json.loads(embedding_json)
        else:
            # Fallback to server-side FaceNet if no embedding was provided
            if not image:
                raise HTTPException(status_code=400, detail="Must provide either image or embedding_json")
            if not image.content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="File must be an image (jpg or png)")
            image_bytes = await image.read()
            if len(image_bytes) == 0:
                raise HTTPException(status_code=400, detail="Empty image file")
                
            try:
                import cv2
                import numpy as np
                from app.services.face_service import detect_face
                
                img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
                if img is None:
                    raise ValueError("Invalid image file")
                    
                face = detect_face(img)
                embedding = get_embedding(face).tolist()
                embedding_json = json.dumps(embedding)
            except Exception as e:
                return {"success": False, "message": "Face processing failed: " + str(e)}

        # Save to SQLite DB
        try:
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute("SELECT worker_id FROM workers WHERE worker_id = ?", (worker_id,))
            exists = c.fetchone()

            if exists:
                c.execute('''UPDATE workers 
                             SET name=?, password=?, role=?, phone=?, department=?, embedding=?,
                                 work_site_id=?, work_site_name=?, work_site_lat=?, work_site_lon=?, work_site_radius=?,
                                 dob=?
                             WHERE worker_id=?''',
                           (name, password, role, phone, department, embedding_json,
                            work_site_id, work_site_name, work_site_lat, work_site_lon, work_site_radius,
                            dob, worker_id))
                message = "Worker " + name + " embedding, work site and DOB updated"
            else:
                c.execute('''INSERT INTO workers 
                             (worker_id, name, password, role, phone, department, embedding,
                              work_site_id, work_site_name, work_site_lat, work_site_lon, work_site_radius, dob) 
                             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                           (worker_id, name, password, role, phone, department, embedding_json,
                            work_site_id, work_site_name, work_site_lat, work_site_lon, work_site_radius, dob))
                message = "Worker " + name + " registered successfully with work site"
            
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
    except Exception as global_err:
        import traceback
        traceback.print_exc()
        return {"success": False, "message": "Internal Server Error 500: " + str(global_err)}


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
def worker_login(worker_id: str = Form(...), password: str = Form(default="")):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT name, password, department, role, embedding FROM workers WHERE worker_id = ?", (worker_id,))
    row = c.fetchone()
    conn.close()

    if row:
        name, saved_pwd, department, role, embedding_str = row
        if saved_pwd and saved_pwd != password:
            return {"success": False, "message": "Incorrect password."}

        return {
            "success": True, 
            "worker_id": worker_id, 
            "name": name,
            "department": department or "",
            "role": role or "",
            "embedding": json.loads(embedding_str) if embedding_str else []
        }
    else:
        return {"success": False, "message": "Worker ID not found. Please register first."}

from pydantic import BaseModel
import datetime

class FaceLoginRequest(BaseModel):
    worker_id: str
    password: str = ""
    image_base64: str = ""
    embedding_json: str = ""

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

    # Use the provided JS embedding, otherwise fallback to Python extraction
    if req.embedding_json:
        login_embedding = json.loads(req.embedding_json)
        # Manually compute similarity
        from scipy.spatial.distance import cosine
        distance = cosine(login_embedding, saved_embedding)
        similarity = max(0.0, 1.0 - distance)
        
        result = {
            "success": similarity >= 0.50,
            "similarity": similarity,
            "reason": f"Similarity too low: {similarity:.2f}" if similarity < 0.50 else "Match"
        }
    else:
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
        "role": role or "",
        "embedding": saved_embedding,
        "image_base64": req.image_base64
    }