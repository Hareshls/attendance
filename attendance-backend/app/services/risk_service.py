# risk_service.py
# Thin wrapper — actual logic lives in face_service MODULE 5
from app.services.face_service import calculate_risk_score, verify_chain

def assess_risk(face_ok, liveness_ok, zone_ok, device_ok, temporal_ok, hours=0):
    return calculate_risk_score(face_ok, liveness_ok, zone_ok, device_ok, temporal_ok, hours)

def verify_record_chain(records: list):
    return verify_chain(records)