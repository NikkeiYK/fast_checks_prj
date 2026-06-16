from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone, date
from typing import List, Optional
import logging
import json

from .database import get_db, ScientificCenter, ClimaticChamber, Booking
from .schemas import (
    BookingCreate, BookingResponse, BookingCancelRequest,
    CenterResponse, ChamberResponse, ChamberFilter
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/climate", tags=["climate"])


@router.get("/centers", response_model=List[CenterResponse])
def get_all_centers(db: Session = Depends(get_db)):
    return db.query(ScientificCenter).all()


@router.get("/centers/{center_id}", response_model=CenterResponse)
def get_center_by_id(center_id: int, db: Session = Depends(get_db)):
    center = db.query(ScientificCenter).filter(ScientificCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Центр не найден")
    return center


@router.get("/chambers", response_model=List[ChamberResponse])
def get_all_chambers(db: Session = Depends(get_db)):
    return db.query(ClimaticChamber).all()


# НОВЫЙ ЭНДПОИНТ: Получение всех доступных опций для фильтров
@router.get("/filter-options")
def get_filter_options(db: Session = Depends(get_db)):
    """Возвращает все уникальные методики и типы ламп из базы"""
    chambers = db.query(ClimaticChamber).all()
    
    all_methodologies = set()
    all_lamp_types = set()
    
    for chamber in chambers:
        if chamber.methodologies:
            all_methodologies.update(chamber.methodologies)
        if chamber.lamps:
            for lamp in chamber.lamps:
                all_lamp_types.add(lamp["name"])
    
    return {
        "methodologies": sorted(list(all_methodologies)),
        "lamp_types": sorted(list(all_lamp_types))
    }


# НОВЫЙ ЭНДПОИНТ: Фильтрация камер
@router.post("/chambers/filter", response_model=List[ChamberResponse])
def filter_chambers(filters: ChamberFilter, db: Session = Depends(get_db)):
    """Фильтрация камер по заданным параметрам"""
    query = db.query(ClimaticChamber)
    
    # Фильтр по центру
    if filters.center_id:
        query = query.filter(ClimaticChamber.center_id == filters.center_id)
    
    # Фильтр по методикам (камера должна содержать ВСЕ выбранные методики)
    if filters.methodologies:
        filtered_chambers = []
        for chamber in query.all():
            if chamber.methodologies:
                if all(m in chamber.methodologies for m in filters.methodologies):
                    filtered_chambers.append(chamber)
        return filtered_chambers
    
    # Фильтр по типам ламп (камера должна содержать хотя бы одну из выбранных)
    if filters.lamp_types:
        filtered_chambers = []
        for chamber in query.all():
            if chamber.lamps:
                chamber_lamp_names = [lamp["name"] for lamp in chamber.lamps]
                if any(lt in chamber_lamp_names for lt in filters.lamp_types):
                    filtered_chambers.append(chamber)
        return filtered_chambers
    
    # Фильтр по температуре конденсации
    if filters.condensation_temp_min is not None:
        query = query.filter(ClimaticChamber.condensation_temp_min <= filters.condensation_temp_min)
    if filters.condensation_temp_max is not None:
        query = query.filter(ClimaticChamber.condensation_temp_max >= filters.condensation_temp_max)
    
    # Фильтр по температуре облучения
    if filters.irradiation_temp_min is not None:
        query = query.filter(ClimaticChamber.irradiation_temp_min <= filters.irradiation_temp_min)
    if filters.irradiation_temp_max is not None:
        query = query.filter(ClimaticChamber.irradiation_temp_max >= filters.irradiation_temp_max)
    
    # Фильтр по интенсивности облучения (камера должна поддерживать хотя бы одну лампу с нужным диапазоном)
    if filters.intensity_min is not None or filters.intensity_max is not None:
        filtered_chambers = []
        for chamber in query.all():
            if chamber.lamps:
                for lamp in chamber.lamps:
                    if filters.intensity_min is not None and lamp["intensity_max"] < filters.intensity_min:
                        continue
                    if filters.intensity_max is not None and lamp["intensity_min"] > filters.intensity_max:
                        continue
                    filtered_chambers.append(chamber)
                    break
        return filtered_chambers
    
    # Фильтр по доступности дат (проверяем, есть ли свободные ячейки в указанный период)
    if filters.available_from or filters.available_to:
        start_date = filters.available_from or date.today()
        end_date = filters.available_to or (start_date + timedelta(days=1))
        
        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())
        
        filtered_chambers = []
        for chamber in query.all():
            if not chamber.cassette_count:
                continue
            
            # Находим занятые ячейки
            busy_bookings = db.query(Booking.cassette_number).filter(
                Booking.chamber_id == chamber.id,
                Booking.status == "active",
                Booking.start_time < end_datetime,
                Booking.end_time > start_datetime
            ).all()
            
            busy_cassettes = {row[0] for row in busy_bookings}
            available_cassettes = set(range(1, chamber.cassette_count + 1)) - busy_cassettes
            
            if available_cassettes:
                filtered_chambers.append(chamber)
        
        return filtered_chambers
    
    return query.all()


# Остальные эндпоинты для бронирований остаются без изменений...
@router.post("/bookings", response_model=BookingResponse, status_code=201)
def create_booking(booking_data: BookingCreate, db: Session = Depends(get_db)):
    chamber = db.query(ClimaticChamber).filter(ClimaticChamber.id == booking_data.chamber_id).first()
    if not chamber:
        raise HTTPException(status_code=404, detail="Климатическая камера не найдена")

    final_center_id = chamber.center_id
    if booking_data.center_id is not None and booking_data.center_id != final_center_id:
        raise HTTPException(status_code=400, detail=f"Камера ID {chamber.id} принадлежит центру ID {final_center_id}")

    if not chamber.cassette_count or chamber.cassette_count <= 0:
        raise HTTPException(status_code=500, detail="У камеры не указано количество кассет")

    start_time_utc = booking_data.start_time.astimezone(timezone.utc) if booking_data.start_time.tzinfo else booking_data.start_time.replace(tzinfo=timezone.utc)
    end_time_utc = start_time_utc + timedelta(hours=booking_data.duration_hours)

    target_cassette = booking_data.cassette_number

    if target_cassette is None:
        busy_bookings = db.query(Booking.cassette_number).filter(
            Booking.chamber_id == booking_data.chamber_id,
            Booking.status == "active",
            Booking.start_time < end_time_utc,
            Booking.end_time > start_time_utc
        ).all()
        
        busy_cassettes = {row[0] for row in busy_bookings}
        all_cassettes = set(range(1, chamber.cassette_count + 1))
        available_cassettes = all_cassettes - busy_cassettes
        
        if not available_cassettes:
            raise HTTPException(status_code=409, detail=f"В камере '{chamber.name}' нет свободных ячеек.")
        target_cassette = min(available_cassettes)
    else:
        if target_cassette > chamber.cassette_count:
            raise HTTPException(status_code=400, detail=f"Недопустимый номер ячейки. Максимум: {chamber.cassette_count}")
            
        is_busy = db.query(Booking).filter(
            Booking.chamber_id == booking_data.chamber_id,
            Booking.cassette_number == target_cassette,
            Booking.status == "active",
            Booking.start_time < end_time_utc,
            Booking.end_time > start_time_utc
        ).first()
        
        if is_busy:
            raise HTTPException(status_code=409, detail=f"Ячейка {target_cassette} уже занята.")

    new_booking = Booking(
        center_id=final_center_id,
        chamber_id=booking_data.chamber_id,
        cassette_number=target_cassette,
        department=booking_data.department,
        full_name=booking_data.full_name,
        sample_cipher=booking_data.sample_cipher,
        description=booking_data.description,
        project=booking_data.project,
        lims_request_id=booking_data.lims_request_id,
        duration_hours=booking_data.duration_hours,
        start_time=start_time_utc,
        end_time=end_time_utc,
        status="active"
    )
    
    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)
    
    logger.info(f"Создано бронирование ID {new_booking.id}")
    return new_booking


@router.post("/bookings/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking(booking_id: int, cancel_data: BookingCancelRequest, db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Бронирование не найдено")
    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="Это бронирование уже было отменено")

    booking.status = "cancelled"
    booking.cancellation_reason = cancel_data.reason
    db.commit()
    db.refresh(booking)
    
    logger.info(f"Отменено бронирование ID {booking_id}")
    return booking


@router.get("/bookings", response_model=List[BookingResponse])
def get_bookings(
    chamber_id: Optional[int] = None,
    center_id: Optional[int] = None,
    status: Optional[str] = "active",
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Booking)
    if status and status != "all":
        query = query.filter(Booking.status == status)
    if chamber_id:
        query = query.filter(Booking.chamber_id == chamber_id)
    if center_id:
        query = query.filter(Booking.center_id == center_id)
    if start_date:
        query = query.filter(Booking.end_time >= start_date)
    if end_date:
        query = query.filter(Booking.start_time <= end_date)
    return query.order_by(Booking.start_time.asc()).all()