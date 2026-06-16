from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid

from apps.climate.database import get_db
from apps.climate.models import Chamber, QueueRequest, Booking
from apps.climate.routes import check_auth, get_msk_now
from apps.climate.services.matching import find_matching_chambers

router = APIRouter(prefix="/api/climate/queue", tags=["queue"])

@router.post("")
def create_queue_request(
    data: dict,
    username: str = Query(...),
    db: Session = Depends(get_db)
):
    user = check_auth(username)
    required = ["fio", "project", "duration_hours"]
    for f in required:
        if f not in data:
            raise HTTPException(400, detail=f"Отсутствует поле: {f}")
    
    req = QueueRequest(
        id=str(uuid.uuid4()),
        fio=data["fio"],
        project=data["project"],
        created_by=username,
        min_temp=data.get("min_temp"),
        max_temp=data.get("max_temp"),
        humidity=data.get("humidity"),
        duration_hours=data["duration_hours"],
        conditions_text=data.get("conditions_text"),
        preferred_center=data.get("preferred_center")
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {"id": req.id, "status": "pending"}

@router.get("")
def list_queue(
    status: str = Query("pending"),
    username: str = Query(...),
    db: Session = Depends(get_db)
):
    check_auth(username)
    q = db.query(QueueRequest).filter(QueueRequest.status == status)
    q = q.order_by(QueueRequest.created_at.desc())
    return [{
        "id": r.id,
        "fio": r.fio,
        "project": r.project,
        "min_temp": r.min_temp,
        "max_temp": r.max_temp,
        "humidity": r.humidity,
        "duration_hours": r.duration_hours,
        "conditions_text": r.conditions_text,
        "preferred_center": r.preferred_center,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "status": r.status
    } for r in q.all()]

@router.get("/{request_id}/matching-chambers")
def matching_chambers(
    request_id: str,
    username: str = Query(...),
    db: Session = Depends(get_db)
):
    check_auth(username)
    req = db.query(QueueRequest).filter(QueueRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Заявка не найдена")
    
    return find_matching_chambers(db, req)

@router.post("/{request_id}/convert")
def convert_to_booking(
    request_id: str,
    data: dict,
    username: str = Query(...),
    db: Session = Depends(get_db)
):
    user = check_auth(username)
    req = db.query(QueueRequest).filter(QueueRequest.id == request_id).first()
    if not req or req.status != "pending":
        raise HTTPException(404, "Заявка не найдена или уже обработана")
    
    required = ["chamber_id", "slot_number", "start_time", "sample_code"]
    for f in required:
        if f not in data:
            raise HTTPException(400, f"Отсутствует поле: {f}")
    
    try:
        start = datetime.fromisoformat(data["start_time"][:19])
    except Exception as e:
        raise HTTPException(400, detail=f"Неверный формат даты: {e}")
    
    end = start + timedelta(hours=req.duration_hours)
    
    conflict = db.query(Booking).filter(
        Booking.chamber_id == data["chamber_id"],
        Booking.slot_number == data["slot_number"],
        Booking.is_cancelled == False,
        Booking.start_time < end,
        Booking.end_time > start
    ).first()
    if conflict:
        raise HTTPException(409, "Слот уже занят")
    
    booking = Booking(
        id=str(uuid.uuid4()),
        chamber_id=data["chamber_id"],
        slot_number=data["slot_number"],
        fio=req.fio,
        sample_code=data["sample_code"],
        project=req.project,
        start_time=start,
        end_time=end,
        duration_hours=req.duration_hours,
        conditions_template=req.conditions_text,
        source_request_id=request_id
    )
    db.add(booking)
    req.status = "converted"
    req.converted_to_booking_id = booking.id
    db.commit()
    return {"booking_id": booking.id, "status": "converted"}