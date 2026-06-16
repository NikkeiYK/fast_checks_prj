from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func
from apps.climate.database import Base
import uuid

class Chamber(Base):
    __tablename__ = "chambers"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    center = Column(String, nullable=False, index=True)
    
    min_temp = Column(Integer, nullable=False, default=-70)
    max_temp = Column(Integer, nullable=False, default=180)
    min_humidity = Column(Integer, nullable=False, default=10)
    max_humidity = Column(Integer, nullable=False, default=98)
    
    is_active = Column(Boolean, default=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class QueueRequest(Base):
    __tablename__ = "queue_requests"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    fio = Column(String, nullable=False)
    project = Column(String, nullable=False)
    created_by = Column(String, nullable=False)
    
    min_temp = Column(Integer, nullable=True)
    max_temp = Column(Integer, nullable=True)
    humidity = Column(Integer, nullable=True)
    duration_hours = Column(Integer, nullable=False)
    conditions_text = Column(Text, nullable=True)
    preferred_center = Column(String, nullable=True)
    
    status = Column(String, default="pending")
    converted_to_booking_id = Column(String, nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by = Column(String, nullable=True)
    cancel_reason = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Booking(Base):
    __tablename__ = "bookings"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    chamber_id = Column(String, nullable=False, index=True)
    slot_number = Column(Integer, nullable=False, index=True)
    
    fio = Column(String, nullable=False)
    sample_code = Column(String, nullable=False)
    project = Column(String, nullable=False)
    
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    duration_hours = Column(Integer, nullable=False)
    
    conditions_template = Column(String, nullable=True)
    comments = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_cancelled = Column(Boolean, default=False)
    cancelled_by = Column(String, nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancel_reason = Column(Text, nullable=True)
    
    source_request_id = Column(String, nullable=True)