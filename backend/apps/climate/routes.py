from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from typing import Optional
import os

from apps.climate.database import get_db
from apps.climate.models import Booking, Chamber

router = APIRouter(prefix="/api/climate", tags=["climate_chamber"])

MSK = timezone(timedelta(hours=3))
os.environ['TZ'] = 'Europe/Moscow'

def get_msk_now() -> datetime:
    return datetime.now(MSK).replace(tzinfo=None)

USERS_DB = {
    "polylab": {"password": "2026", "role": "auditor", "permissions": ["climate:read", "climate:book"]},
    "admin": {"password": "admin", "role": "admin", "permissions": ["climate:read", "climate:book", "climate:cancel"]}
}

def check_auth(username: str) -> dict:
    user = USERS_DB.get(username)
    if not user:
        raise HTTPException(401, detail="Пользователь не найден")
    return user

def has_permission(user: dict, perm: str) -> bool:
    return "*" in user.get("permissions", []) or perm in user.get("permissions", [])

def cleanup_expired(db: Session):
    now = get_msk_now()
    expired = db.query(Booking).filter(
        Booking.is_cancelled == False,
        Booking.end_time < now
    ).all()
    for b in expired:
        b.is_cancelled = True
        b.cancelled_by = "system"
    if expired:
        db.commit()
    return len(expired)

@router.get("/slots")
def get_slots(
    chamber_id: Optional[str] = Query(None),
    center: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    username: str = Query(...),
    db: Session = Depends(get_db)
):
    user = check_auth(username)
    cleanup_expired(db)
    
    if chamber_id:
        chambers = db.query(Chamber).filter(Chamber.id == chamber_id).all()
    elif center:
        chambers = db.query(Chamber).filter(Chamber.center == center, Chamber.is_active == True).all()
    else:
        chambers = db.query(Chamber).filter(Chamber.is_active == True).all()
    
    ref = datetime.fromisoformat(date[:19]) if date else get_msk_now()
    result = []
    
    for chamber in chambers:
        for num in range(1, 25):
            b = db.query(Booking).filter(
                Booking.chamber_id == chamber.id,
                Booking.slot_number == num,
                Booking.is_cancelled == False,
                Booking.start_time <= ref,
                Booking.end_time > ref
            ).first()
            
            if b:
                total = (b.end_time - b.start_time).total_seconds()
                elapsed = (ref - b.start_time).total_seconds()
                progress = round((elapsed / total) * 100, 1) if total > 0 else 0
                hours_left = (b.end_time - ref).total_seconds() / 3600
                
                result.append({
                    "chamber_id": chamber.id,
                    "chamber_name": chamber.name,
                    "center": chamber.center,
                    "slot_number": num,
                    "status": "ending_soon" if hours_left < 48 else "busy",
                    "label": f"{b.fio.split()[0]} {b.sample_code}",
                    "booking_id": b.id,
                    "ends_at": b.end_time.isoformat(),
                    "start_time": b.start_time.isoformat(),
                    "progress": progress,
                    "fio": b.fio,
                    "sample_code": b.sample_code,
                    "project": b.project,
                    "specs": {
                        "min_temp": chamber.min_temp,
                        "max_temp": chamber.max_temp,
                        "min_humidity": chamber.min_humidity,
                        "max_humidity": chamber.max_humidity
                    }
                })
            else:
                future = db.query(Booking).filter(
                    Booking.chamber_id == chamber.id,
                    Booking.slot_number == num,
                    Booking.is_cancelled == False,
                    Booking.start_time > ref
                ).order_by(Booking.start_time).first()
                
                result.append({
                    "chamber_id": chamber.id,
                    "chamber_name": chamber.name,
                    "center": chamber.center,
                    "slot_number": num,
                    "status": "free",
                    "label": "Свободен",
                    "booking_id": None,
                    "ends_at": None,
                    "start_time": None,
                    "progress": 0,
                    "next_booking": future.start_time.isoformat() if future else None,
                    "specs": {
                        "min_temp": chamber.min_temp,
                        "max_temp": chamber.max_temp,
                        "min_humidity": chamber.min_humidity,
                        "max_humidity": chamber.max_humidity
                    }
                })
    return result

@router.post("/book")
def create_booking(
    data: dict,
    username: str = Query(...),
    db: Session = Depends(get_db)
):
    user = check_auth(username)
    if not has_permission(user, "climate:book"):
        raise HTTPException(403, detail="Нет прав на бронирование")
    
    required = ["chamber_id", "slot_number", "fio", "sample_code", "project", "start_time", "duration_hours"]
    for f in required:
        if f not in data:
            raise HTTPException(400, detail=f"Отсутствует поле: {f}")
    
    try:
        start_str = data["start_time"][:19]
        start = datetime.fromisoformat(start_str)
    except Exception as e:
        raise HTTPException(400, detail=f"Неверный формат даты: {e}")
    
    end = start + timedelta(hours=data["duration_hours"])
    
    conflict = db.query(Booking).filter(
        Booking.chamber_id == data["chamber_id"],
        Booking.slot_number == data["slot_number"],
        Booking.is_cancelled == False,
        Booking.start_time < end,
        Booking.end_time > start
    ).first()
    if conflict:
        raise HTTPException(409, detail=f"Слот занят: {conflict.start_time.strftime('%d.%m %H:%M')} — {conflict.end_time.strftime('%d.%m %H:%M')}")
    
    new = Booking(
        chamber_id=data["chamber_id"],
        slot_number=data["slot_number"],
        fio=data["fio"],
        sample_code=data["sample_code"],
        project=data["project"],
        start_time=start,
        end_time=end,
        duration_hours=data["duration_hours"],
        conditions_template=data.get("conditions"),
        comments=data.get("comments"),
        source_request_id=data.get("source_request_id")
    )
    db.add(new)
    db.commit()
    db.refresh(new)
    
    return {
        "id": new.id,
        "chamber_id": new.chamber_id,
        "slot_number": new.slot_number,
        "start_time": start.strftime("%d.%m.%Y %H:%M"),
        "end_time": end.strftime("%d.%m.%Y %H:%M"),
        "status": "booked"
    }

@router.get("/booking/{booking_id}")
def get_details(
    booking_id: str,
    username: str = Query(...),
    db: Session = Depends(get_db)
):
    check_auth(username)
    b = db.query(Booking).filter(Booking.id == booking_id, Booking.is_cancelled == False).first()
    if not b:
        raise HTTPException(404, detail="Бронь не найдена")
    
    chamber = db.query(Chamber).filter(Chamber.id == b.chamber_id).first()
    now = get_msk_now()
    
    total_seconds = (b.end_time - b.start_time).total_seconds()
    elapsed_seconds = max(0, (now - b.start_time).total_seconds())
    
    if elapsed_seconds <= 0:
        progress = 0
    elif elapsed_seconds >= total_seconds:
        progress = 100
    else:
        progress = round((elapsed_seconds / total_seconds) * 100, 1)
    
    remaining_seconds = max(0, (b.end_time - now).total_seconds())
    remaining_hours = remaining_seconds / 3600
    remaining_days = int(remaining_hours // 24)
    
    return {
        "chamber_id": b.chamber_id,
        "chamber_name": chamber.name if chamber else "—",
        "center": chamber.center if chamber else "—",
        "start_time": b.start_time.strftime("%d.%m.%Y %H:%M"),
        "end_time": b.end_time.strftime("%d.%m.%Y %H:%M"),
        "remaining_days": remaining_days,
        "remaining_hours": round(remaining_hours, 1),
        "progress": progress,
        "sample_code": b.sample_code,
        "project": b.project,
        "fio": b.fio,
        "conditions": b.conditions_template,
        "comments": b.comments,
        "duration_hours": b.duration_hours,
        "is_cancelled": b.is_cancelled,
        "cancelled_by": b.cancelled_by,
        "cancelled_at": b.cancelled_at.strftime("%d.%m.%Y %H:%M") if b.cancelled_at else None,
        "cancel_reason": b.cancel_reason
    }

@router.post("/cancel/{booking_id}")
def cancel_booking(
    booking_id: str,
    data: dict,
    username: str = Query(...),
    db: Session = Depends(get_db)
):
    user = check_auth(username)
    if not has_permission(user, "climate:cancel"):
        raise HTTPException(403, detail="Только администратор может отменять брони")
    
    reason = (data.get("reason") or "").strip()
    if not reason:
        raise HTTPException(400, "Укажите причину отмены — поле обязательно")
    
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, detail="Бронь не найдена")
    
    b.is_cancelled = True
    b.cancelled_by = username
    b.cancelled_at = get_msk_now()
    b.cancel_reason = reason
    if data.get("comment"):
        b.comments = f"{b.comments or ''}\n[Комментарий: {data['comment']}]".strip()
    db.commit()
    return {"message": "Бронь отменена", "booking_id": booking_id}

@router.get("/cancellations")
def list_cancellations(
    username: str = Query(...),
    mine_only: bool = Query(False),
    db: Session = Depends(get_db)
):
    user = check_auth(username)
    q = db.query(Booking).filter(Booking.is_cancelled == True)
    if mine_only:
        q = q.filter(Booking.fio.contains(username))
    
    return [{
        "id": b.id,
        "slot": b.slot_number,
        "chamber_id": b.chamber_id,
        "fio": b.fio,
        "sample_code": b.sample_code,
        "project": b.project,
        "start": b.start_time.strftime("%d.%m.%Y %H:%M"),
        "end": b.end_time.strftime("%d.%m.%Y %H:%M"),
        "cancelled_at": b.cancelled_at.strftime("%d.%m.%Y %H:%M") if b.cancelled_at else None,
        "cancelled_by": b.cancelled_by,
        "reason": b.cancel_reason or "—"
    } for b in q.order_by(Booking.cancelled_at.desc()).limit(100).all()]

@router.get("/meta")
def get_meta():
    return {
        "conditions": ["GOST 32317", "ISO 4892-2", "ASTM G154", "Пользовательский"],
        "status_info": {
            "free": {"label": "Свободен", "color": "#22c55e"},
            "busy": {"label": "Занят", "color": "#ef4444"},
            "ending_soon": {"label": "Завершается <48ч", "color": "#eab308"},
            "unavailable": {"label": "Недоступен", "color": "#6b7280"}
        }
    }

@router.get("/history")
def get_history(
    username: str = Query(...),
    limit: int = Query(50),
    db: Session = Depends(get_db)
):
    check_auth(username)
    bookings = db.query(Booking).order_by(Booking.start_time.desc()).limit(limit).all()
    now = get_msk_now()
    
    result = []
    for b in bookings:
        if b.is_cancelled:
            status = "Отменена"
        elif now >= b.end_time:
            status = "Завершена"
        else:
            status = "Активна"
        
        chamber = db.query(Chamber).filter(Chamber.id == b.chamber_id).first()
        
        result.append({
            "id": b.id,
            "chamber_id": b.chamber_id,
            "chamber_name": chamber.name if chamber else "—",
            "center": chamber.center if chamber else "—",
            "slot": b.slot_number,
            "fio": b.fio,
            "sample": b.sample_code,
            "project": b.project,
            "start": b.start_time.strftime("%d.%m.%Y %H:%M"),
            "end": b.end_time.strftime("%d.%m.%Y %H:%M"),
            "status": status,
            "cancelled_by": b.cancelled_by,
            "cancel_reason": b.cancel_reason
        })
    return result