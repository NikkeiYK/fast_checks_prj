from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

if os.environ.get("AMVERA") == "1":
    DATABASE_URL = "sqlite:////data/audit_db_v2.sqlite"
else:
    DATABASE_URL = "sqlite:///./audit_db_v2.sqlite"

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
    from apps.audit.models import Question, ALL_QUESTIONS_TEXT
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if db.query(Question).count() == 0:
        for i, q_text in enumerate(ALL_QUESTIONS_TEXT, 1):
            db.add(Question(text=q_text, index_num=i))
        db.commit()
    db.close()