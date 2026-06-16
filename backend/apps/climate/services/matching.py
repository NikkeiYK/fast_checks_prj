from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from apps.climate.models import Chamber, Booking, QueueRequest
from apps.climate.routes import get_msk_now

def find_matching_chambers(db: Session, req: QueueRequest) -> dict:
    now = get_msk_now()
    
    q = db.query(Chamber).filter(Chamber.is_active == True)
    if req.preferred_center:
        q = q.filter(Chamber.center == req.preferred_center)
    
    chambers = q.all()
    matching = []
    
    for ch in chambers:
        temp_ok = True
        humidity_ok = True
        
        if req.min_temp is not None and req.max_temp is not None:
            temp_ok = (ch.min_temp <= req.min_temp) and (ch.max_temp >= req.max_temp)
        
        if req.humidity is not None:
            humidity_ok = (ch.min_humidity <= req.humidity <= ch.max_humidity)
        
        if not (temp_ok and humidity_ok):
            continue
        
        duration = timedelta(hours=req.duration_hours)
        available_slots = []
        
        for slot_num in range(1, 25):
            future_bookings = db.query(Booking).filter(
                Booking.chamber_id == ch.id,
                Booking.slot_number == slot_num,
                Booking.is_cancelled == False,
                Booking.start_time > now
            ).order_by(Booking.start_time).all()
            
            candidate_start = max(now, now.replace(minute=0, second=0, microsecond=0))
            
            found = False
            for b in future_bookings:
                gap_hours = (b.start_time - candidate_start).total_seconds() / 3600
                if gap_hours >= req.duration_hours:
                    available_slots.append({
                        "slot_number": slot_num,
                        "start_time": candidate_start.isoformat()
                    })
                    found = True
                    break
                candidate_start = b.end_time
            
            if not found:
                available_slots.append({
                    "slot_number": slot_num,
                    "start_time": candidate_start.isoformat()
                })
        
        if available_slots:
            earliest = min(available_slots, key=lambda s: s["start_time"])
            matching.append({
                "chamber_id": ch.id,
                "chamber_name": ch.name,
                "center": ch.center,
                "specs": {
                    "temp_range": [ch.min_temp, ch.max_temp],
                    "humidity_range": [ch.min_humidity, ch.max_humidity]
                },
                "available_slots": available_slots,
                "earliest_start": earliest["start_time"],
                "available_count": len(available_slots)
            })
    
    matching.sort(key=lambda m: m["earliest_start"])
    
    return {
        "request_id": req.id,
        "requirements": {
            "temp": [req.min_temp, req.max_temp],
            "humidity": req.humidity,
            "duration_hours": req.duration_hours,
            "preferred_center": req.preferred_center
        },
        "total_matching": len(matching),
        "matches": matching
    }