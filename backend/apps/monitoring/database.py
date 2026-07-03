"""SQLAlchemy модели для модуля мониторинга Росстандарта."""
from sqlalchemy import (
    create_engine, Column, Integer, String, Text, Boolean,
    DateTime, JSON
)
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime, timezone
import os, json, logging

from .config import DATA_DIR

logger = logging.getLogger(__name__)

if os.environ.get("AMVERA") == "1":
    DATABASE_URL = "sqlite:////data/monitoring_db.sqlite"
else:
    DATABASE_URL = "sqlite:///./monitoring_db.sqlite"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────
# МОДЕЛИ
# ─────────────────────────────────────────────────────────────

class GostNotification(Base):
    """Публичные обсуждения ГОСТов (fgis.gost.ru)."""
    __tablename__ = "gost_notifications"

    id = Column(String, primary_key=True, index=True)
    country = Column(String, default="RU", index=True, nullable=False)  # ← RU, KZ, BY, UZ
    prns_code = Column(String, index=True)
    doc_type = Column(String)
    project_name = Column(Text)
    technical_committee = Column(String, index=True)
    developer = Column(String)
    start_date = Column(String)
    end_date = Column(String)
    status = Column(String, index=True)
    url = Column(String)
    is_polymer = Column(Boolean, default=False, index=True)
    matched_keywords = Column(JSON)
    fetched_date = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class SpNotification(Base):
    """Уведомления о сводах правил (rst.gov.ru)."""
    __tablename__ = "sp_notifications"

    id = Column(String, primary_key=True, index=True)
    country = Column(String, default="RU", index=True, nullable=False)
    notification_type = Column(String)
    doc_type = Column(String)
    project_name = Column(Text)
    title = Column(String)
    developer = Column(String)
    placement_date = Column(String, index=True)
    url = Column(String)
    stakeholders = Column(JSON)
    is_polymer = Column(Boolean, default=False, index=True)
    matched_keywords = Column(JSON)
    fetched_date = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class TechnicalCommittee(Base):
    """Технические комитеты (для отметки «наши»)."""
    __tablename__ = "technical_committees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    is_ours = Column(Boolean, default=False, index=True)


class ScrapingLog(Base):
    """Лог запусков парсинга."""
    __tablename__ = "scraping_logs"

    id = Column(Integer, primary_key=True, index=True)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    finished_at = Column(DateTime, nullable=True)
    status = Column(String, default="running")  # running / success / error / cancelled
    gost_new = Column(Integer, default=0)
    sp_new = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    new_gost_ids = Column(JSON, nullable=True)
    new_sp_ids = Column(JSON, nullable=True)
    updated_statuses = Column(JSON, nullable=True)
    

class NpaProject(Base):
    """Проекты нормативных правовых актов (regulation.gov.ru)."""
    __tablename__ = "npa_projects"

    id = Column(String, primary_key=True, index=True)  # ID проекта (например, 04/15/06-26/00168649)
    title = Column(Text)
    country = Column(String, default="RU", index=True, nullable=False)
    developer = Column(String, index=True)  # Орган государственной власти
    doc_type = Column(String)  # Вид (Проект федерального закона, Проект постановления и т.д.)
    created_date = Column(String)
    published_date = Column(String, index=True)
    stage = Column(String)  # Этап (Текст, Уведомление и т.д.)
    status = Column(String, index=True)  # Статус (Идет обсуждение и т.д.)
    procedure = Column(String)  # Процедура (ОРВ, Антикоррупционная экспертиза и т.д.)
    url = Column(String)
    is_priority = Column(Boolean, default=False, index=True)
    is_polymer = Column(Boolean, default=False, index=True)
    matched_keywords = Column(JSON)
    fetched_date = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
class ApprovedDiscussion(Base):
    """Завершенные публичные обсуждения (rst.gov.ru)."""
    __tablename__ = "approved_discussions"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String, unique=True, index=True)
    prns = Column(String, index=True)
    sub_program = Column(String)
    doc_type = Column(String)
    project_name = Column(Text)
    tk = Column(String, index=True)
    developer = Column(String)
    submitted_date = Column(String)
    completed_date = Column(String, index=True)
    url = Column(String)
    is_polymer = Column(Boolean, default=False, index=True)
    matched_keywords = Column(JSON)
    fetched_date = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# ─────────────────────────────────────────────────────────────
# ИНИЦИАЛИЗАЦИЯ
# ─────────────────────────────────────────────────────────────
def init_db():
    """Создание таблиц."""
    Base.metadata.create_all(bind=engine)