from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, date
from typing import Optional, List, Dict, Any


class LampInfo(BaseModel):
    name: str
    intensity_min: float
    intensity_max: float
    unit: str


class ChamberResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    cassette_count: Optional[int]
    center_id: int
    methodologies: Optional[List[str]]
    lamps: Optional[List[LampInfo]]
    condensation_temp_min: Optional[int]
    condensation_temp_max: Optional[int]
    irradiation_temp_min: Optional[int]
    irradiation_temp_max: Optional[int]

    model_config = ConfigDict(from_attributes=True)


class CenterResponse(BaseModel):
    id: int
    name: str
    chambers: List[ChamberResponse]

    model_config = ConfigDict(from_attributes=True)


class BookingCreate(BaseModel):
    center_id: Optional[int] = None
    chamber_id: int
    cassette_number: Optional[int] = Field(None, gt=0)
    department: str
    full_name: str
    sample_cipher: str
    description: Optional[str] = None
    project: Optional[str] = None
    lims_request_id: Optional[str] = None
    duration_hours: int = Field(..., gt=0)
    start_time: datetime


class BookingCancelRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=500)


class BookingResponse(BaseModel):
    id: int
    center_id: int
    chamber_id: int
    cassette_number: int
    department: str
    full_name: str
    sample_cipher: str
    description: Optional[str]
    project: Optional[str]
    lims_request_id: Optional[str]
    duration_hours: int
    start_time: datetime
    end_time: datetime
    status: str
    cancellation_reason: Optional[str]

    model_config = ConfigDict(from_attributes=True)


# Схема для фильтров
class ChamberFilter(BaseModel):
    center_id: Optional[int] = None
    methodologies: Optional[List[str]] = None
    lamp_types: Optional[List[str]] = None
    condensation_temp_min: Optional[int] = None
    condensation_temp_max: Optional[int] = None
    irradiation_temp_min: Optional[int] = None
    irradiation_temp_max: Optional[int] = None
    intensity_min: Optional[float] = None
    intensity_max: Optional[float] = None
    available_from: Optional[date] = None
    available_to: Optional[date] = None