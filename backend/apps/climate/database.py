# apps/climate/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 🔹 Твоя логика путей: AMVERA → /data, иначе → рядом с файлом
if os.environ.get("AMVERA") == "1":
    DATABASE_URL = "sqlite:////data/climate_db.sqlite"
else:
    DATABASE_URL = "sqlite:///./climate_db.sqlite"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Создаёт таблицу bookings, если её нет"""
    Base.metadata.create_all(bind=engine)