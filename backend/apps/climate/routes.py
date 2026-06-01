from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from typing import Optional
import os

from apps.climate.database import get_db
from apps.climate.models import Booking

router = APIRouter(prefix="/api/climate", tags=["climate_chamber"])

# 🔹 Принудительно устанавливаем MSK (UTC+3) для всех операций
MSK = timezone(timedelta(hours=3))
os.environ['TZ'] = 'Europe/Moscow'

def get_msk_now() -> datetime:
    """Возвращает текущее время в MSK (без timezone info)"""
    return datetime.now(MSK).replace(tzinfo=None)

# 🔹 База пользователей
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
    """Помечает просроченные брони как отменённые"""
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
    date: Optional[str] = Query(None),
    username: str = Query(...),
    db: Session = Depends(get_db)
):
    user = check_auth(username)
    cleanup_expired(db)
    
    # Референсное время в MSK
    if date:
        ref = datetime.fromisoformat(date[:19])
    else:
        ref = get_msk_now()
    
    slots = []
    for num in range(1, 25):
        b = db.query(Booking).filter(
            Booking.slot_number == num,
            Booking.is_cancelled == False,
            Booking.start_time <= ref,
            Booking.end_time > ref
        ).first()
        
        if b:
            # Считаем прогресс
            total_seconds = (b.end_time - b.start_time).total_seconds()
            elapsed_seconds = (ref - b.start_time).total_seconds()
            progress = min(100, max(0, round((elapsed_seconds / total_seconds) * 100, 1))) if total_seconds > 0 else 0
            
            hours_left = (b.end_time - ref).total_seconds() / 3600
            status = "ending_soon" if hours_left < 48 else "busy"
            
            slots.append({
                "slot_number": num,
                "status": status,
                "label": f"{b.fio.split()[0]} {b.sample_code}",
                "booking_id": b.id,
                "ends_at": b.end_time.isoformat(),
                "start_time": b.start_time.isoformat(),
                "progress": progress,
                "fio": b.fio,
                "sample_code": b.sample_code,
                "project": b.project
            })
        else:
            # Свободный слот — ищем следующее бронирование
            future = db.query(Booking).filter(
                Booking.slot_number == num,
                Booking.is_cancelled == False,
                Booking.start_time > ref
            ).order_by(Booking.start_time).first()
            
            slots.append({
                "slot_number": num,
                "status": "free",
                "label": "Свободен",
                "booking_id": None,
                "ends_at": None,
                "start_time": None,
                "progress": 0,
                "next_booking": future.start_time.isoformat() if future else None
            })
    return slots

@router.post("/book")
def create_booking(
    data: dict,
    username: str = Query(...),
    db: Session = Depends(get_db)
):
    user = check_auth(username)
    if not has_permission(user, "climate:book"):
        raise HTTPException(403, detail="Нет прав на бронирование")
    
    for f in ["slot_number", "fio", "sample_code", "project", "start_time", "duration_hours"]:
        if f not in data:
            raise HTTPException(400, detail=f"Отсутствует поле: {f}")
    
    try:
        # Парсим время от фронта (формат: "2026-06-01T15:48")
        start_str = data["start_time"][:19]
        start = datetime.fromisoformat(start_str)
    except Exception as e:
        raise HTTPException(400, detail=f"Неверный формат даты: {e}")
    
    end = start + timedelta(hours=data["duration_hours"])
    
    # Проверка конфликтов
    conflict = db.query(Booking).filter(
        Booking.slot_number == data["slot_number"],
        Booking.is_cancelled == False,
        Booking.start_time < end,
        Booking.end_time > start
    ).first()
    if conflict:
        raise HTTPException(409, detail=f"Слот занят: {conflict.start_time.strftime('%d.%m %H:%M')} — {conflict.end_time.strftime('%d.%m %H:%M')}")
    
    new = Booking(
        slot_number=data["slot_number"], fio=data["fio"], sample_code=data["sample_code"],
        project=data["project"], start_time=start, end_time=end, duration_hours=data["duration_hours"],
        conditions_template=data.get("conditions"), comments=data.get("comments")
    )
    db.add(new); db.commit(); db.refresh(new)
    
    return {
        "id": new.id, "slot_number": new.slot_number,
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
    
    now = get_msk_now()
    
    # Считаем прогресс корректно
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
        "duration_hours": b.duration_hours
    }

@router.post("/cancel/{booking_id}")
def cancel_booking(
    booking_id: str,
    username: str = Query(...),
    comment: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    user = check_auth(username)
    if not has_permission(user, "climate:cancel"):
        raise HTTPException(403, detail="Только администратор может отменять брони")
    
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, detail="Бронь не найдена")
    
    b.is_cancelled = True
    b.cancelled_by = username
    if comment:
        b.comments = f"{b.comments or ''}\n[Отменено админом: {comment}]".strip()
    db.commit()
    return {"message": "Бронь отменена", "booking_id": booking_id}

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
        
        result.append({
            "id": b.id,
            "slot": b.slot_number,
            "fio": b.fio,
            "sample": b.sample_code,
            "project": b.project,
            "start": b.start_time.strftime("%d.%m.%Y %H:%M"),
            "end": b.end_time.strftime("%d.%m.%Y %H:%M"),
            "status": status,
            "cancelled_by": b.cancelled_by
        })
    return result