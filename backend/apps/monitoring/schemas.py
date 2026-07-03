"""Pydantic-схемы для модуля мониторинга."""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ── ГОСТ ─────────────────────────────────────────────────────
class GostNotificationOut(BaseModel):
    id: str
    prns_code: Optional[str] = None
    doc_type: Optional[str] = None
    project_name: Optional[str] = None
    technical_committee: Optional[str] = None
    developer: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    url: Optional[str] = None
    is_polymer: bool = False
    matched_keywords: Optional[List[str]] = None
    fetched_date: Optional[str] = None

    class Config:
        from_attributes = True


# ── СП ───────────────────────────────────────────────────────
class SpNotificationOut(BaseModel):
    id: str
    notification_type: Optional[str] = None
    doc_type: Optional[str] = None
    project_name: Optional[str] = None
    title: Optional[str] = None
    developer: Optional[str] = None
    placement_date: Optional[str] = None
    url: Optional[str] = None
    stakeholders: Optional[List[str]] = None
    is_polymer: bool = False
    matched_keywords: Optional[List[str]] = None

    class Config:
        from_attributes = True


# ── ТК ───────────────────────────────────────────────────────
class TechnicalCommitteeOut(BaseModel):
    id: int
    name: str
    is_ours: bool

    class Config:
        from_attributes = True


class TechnicalCommitteeCreate(BaseModel):
    name: str
    is_ours: bool = False
    

# ── НПА ──────────────────────────────────────────────────────
class NpaProjectOut(BaseModel):
    id: str
    title: Optional[str] = None
    developer: Optional[str] = None
    doc_type: Optional[str] = None
    created_date: Optional[str] = None
    published_date: Optional[str] = None
    stage: Optional[str] = None
    status: Optional[str] = None
    procedure: Optional[str] = None
    url: Optional[str] = None
    is_polymer: bool = False
    is_priority: bool = False
    matched_keywords: Optional[List[str]] = None

    class Config:
        from_attributes = True


# ── Статистика ───────────────────────────────────────────────
class DashboardStats(BaseModel):
    total_gost: int
    total_sp: int
    total_npa: int 
    active_count: int
    total_approved: int = 0
    completed_count: int
    polymer_total: int
    polymer_commented: int
    status_labels: List[str]
    status_values: List[int]
    month_labels: List[str]
    month_values: List[int]
    all_tk_labels: List[str]
    all_tk_values: List[int]


class DashboardResponse(BaseModel):
    gost: List[GostNotificationOut]
    sp: List[SpNotificationOut]
    stats: DashboardStats
    npa: List[NpaProjectOut]
    my_tks: List[str]
    last_updated: str
    current_year: int
    available_countries: List[dict] = []


# ── Scraping ─────────────────────────────────────────────────
class ScrapingResponse(BaseModel):
    status: str
    gost_new: int = 0
    sp_new: int = 0
    message: str = ""
    new_gost_ids: List[str] = []
    new_sp_ids: List[str] = []
    updated_statuses: List[dict] = []
    new_npa_ids: List[str] = [] 
    npa_new: int = 0


class ScrapingLogOut(BaseModel):
    id: int
    started_at: datetime
    finished_at: Optional[datetime]
    status: str
    gost_new: int
    sp_new: int
    new_gost_ids: Optional[List[str]]
    new_sp_ids: Optional[List[str]]
    updated_statuses: Optional[List[dict]]

    class Config:
        from_attributes = True

# ── Завершенные обсуждения ──────────────────────────────────
class ApprovedDiscussionOut(BaseModel):
    id: int
    uuid: Optional[str] = None
    prns: Optional[str] = None
    sub_program: Optional[str] = None
    doc_type: Optional[str] = None
    project_name: Optional[str] = None
    tk: Optional[str] = None
    developer: Optional[str] = None
    submitted_date: Optional[str] = None
    completed_date: Optional[str] = None
    url: Optional[str] = None
    is_polymer: bool = False
    matched_keywords: Optional[List[str]] = None

    class Config:
        from_attributes = True