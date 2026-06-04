# Registration endpoint
# Worker visits office once, scans face, embedding saved to disk
# From then on they can check in from the field with no internet

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services.face_service import get_embedding
import json
import os
import numpy as np
import sqlite3

router = APIRouter()

DB_PATH = "attendance.db"


@router.post("/register")
async def register_worker(
    worker_id: str        = Form(...),   # unique ID like EMP001
    name:      str        = Form(...),   # worker's full name
    password:  str        = Form(...),   # worker's password
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
        embedding = get_embedding(image_bytes)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Face processing failed: " + str(e)
        )

    # Convert embedding to JSON string
    embedding_json = json.dumps(embedding)

    # Save to SQLite DB
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

    return {
        "success":   True,
        "worker_id": worker_id,
        "name":      name,
        "message":   message
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