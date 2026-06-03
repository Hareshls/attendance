# Registration endpoint
# Worker visits office once, scans face, embedding saved to disk
# From then on they can check in from the field with no internet

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services.face_service import get_embedding
import json
import os
import numpy as np

router = APIRouter()

EMBEDDINGS_FILE = "saved_models/embeddings.json"
# Stores all worker face embeddings as JSON
# In production this would be a proper database


def load_embeddings():
    if not os.path.exists(EMBEDDINGS_FILE):
        return {}
    with open(EMBEDDINGS_FILE, "r") as f:
        return json.load(f)


def save_embeddings(data):
    os.makedirs("saved_models", exist_ok=True)
    with open(EMBEDDINGS_FILE, "w") as f:
        json.dump(data, f, indent=2)


@router.post("/register")
async def register_worker(
    worker_id: str        = Form(...),   # unique ID like EMP001
    name:      str        = Form(...),   # worker's full name
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

    embeddings = load_embeddings()

    if worker_id in embeddings:
        # Worker already exists — average new embedding with old one
        # This improves accuracy by capturing multiple lighting conditions
        old_vec = embeddings[worker_id]["embedding"]
        avg     = ((np.array(old_vec) + np.array(embedding)) / 2).tolist()
        embeddings[worker_id]["embedding"] = avg
        message = "Worker " + name + " embedding updated"
    else:
        embeddings[worker_id] = {
            "worker_id": worker_id,
            "name":      name,
            "embedding": embedding
        }
        message = "Worker " + name + " registered successfully"

    save_embeddings(embeddings)

    return {
        "success":   True,
        "worker_id": worker_id,
        "name":      name,
        "message":   message
    }


@router.get("/workers")
def get_all_workers():
    # Returns list of all registered workers (no embeddings exposed)
    embeddings = load_embeddings()
    workers = [
        {"worker_id": v["worker_id"], "name": v["name"]}
        for v in embeddings.values()
    ]
    return {"total": len(workers), "workers": workers}


@router.delete("/workers/{worker_id}")
def delete_worker(worker_id: str):
    # Remove a worker from the system
    embeddings = load_embeddings()
    if worker_id not in embeddings:
        raise HTTPException(
            status_code=404,
            detail="Worker " + worker_id + " not found"
        )
    del embeddings[worker_id]
    save_embeddings(embeddings)
    return {"success": True, "message": "Worker " + worker_id + " deleted"}