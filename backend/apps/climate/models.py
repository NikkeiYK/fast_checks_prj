from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func
from apps.climate.database import Base
import uuid

class Booking(Base):
    __tablename__ = "bookings"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    slot_number = Column(Integer, nullable=False, index=True)  # 1..24
    
    # Основные данные
    fio = Column(String, nullable=False)
    sample_code = Column(String, nullable=False)
    project = Column(String, nullable=False)
    
    # Время
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    duration_hours = Column(Integer, nullable=False)
    
    # Доп. поля
    conditions_template = Column(String, nullable=True)
    comments = Column(Text, nullable=True)
    
    # Мета
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_cancelled = Column(Boolean, default=False)
    cancelled_by = Column(String, nullable=True)