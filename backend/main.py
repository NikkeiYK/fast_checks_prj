# =============================================================================
# POLILAB AUDIT SYSTEM v2 - Backend (FastAPI)
# =============================================================================
from fastapi import FastAPI, HTTPException, Depends, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, Session, joinedload
from datetime import datetime
import pandas as pd
import io
import json
from enum import Enum as PyEnum
import logging

# Настройка логирования
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# =============================================================================
# КОНФИГУРАЦИЯ
# =============================================================================
DATABASE_URL = "sqlite:///./audit_db_v2.sqlite"
Base = declarative_base()
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

app = FastAPI(title="Polilab Audit System v2")

# CORS для Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# СПРАВОЧНИКИ
# =============================================================================
CENTERS_LIST = ["Казань", "Москва", "Пермь", "Всеволожск",
                "Красноярск", "Нижнекамск", "Нижний Новгород", "Воронеж"]
DEPARTMENTS_LIST = ["СПОР", "Прикладные разработки",
                    "Продуктовое развитие", "РПИ", "РПС", "ЦИРМ", "НТР"]
ALL_QUESTIONS_TEXT = [
    "Соблюдение ТБ", "Знание SOP", "Ведение журналов", "Калибровка оборудования",
    "Хранение реактивов", "Утилизация отходов", "Работа с СИЗ", "Документирование",
    "Внутренний контроль", "Внешний контроль", "Работа с LIMS", "Сроки анализов",
    "Коммуникация", "Наставничество", "Управление рисками", "Нештатные ситуации", "Этика"
]

# =============================================================================
# ENUMS - ✅ УБРАЛИ "Не сдан"
# =============================================================================


class ResultStatus(str, PyEnum):
    PASSED = "passed"
    FAILED = "failed"


class SessionStatus(str, PyEnum):
    IN_PROGRESS = "В процессе"
    COMPLETED = "Сдан"

# =============================================================================
# МОДЕЛИ БД
# =============================================================================


class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    fio = Column(String, index=True)
    department = Column(String)
    center = Column(String, index=True)
    __table_args__ = (UniqueConstraint('fio', 'department',
                      'center', name='uq_emp_dept_center'),)


class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    text = Column(String, unique=True)
    index_num = Column(Integer)


class AuditSession(Base):
    __tablename__ = "audit_sessions"
    id = Column(Integer, primary_key=True, index=True)
    auditor_fio = Column(String, index=True)
    auditor_dept = Column(String)
    center = Column(String, index=True)
    check_date = Column(String, index=True)
    quarter = Column(String, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    status = Column(String, default=SessionStatus.IN_PROGRESS)

    employee = relationship("Employee")
    answers = relationship(
        "AuditAnswer", back_populates="session", cascade="all, delete-orphan")


class AuditAnswer(Base):
    __tablename__ = "audit_answers"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("audit_sessions.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    result = Column(String)

    question = relationship("Question")
    session = relationship("AuditSession", back_populates="answers")

# =============================================================================
# INIT DB
# =============================================================================


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if db.query(Question).count() == 0:
        for i, q_text in enumerate(ALL_QUESTIONS_TEXT, 1):
            db.add(Question(text=q_text, index_num=i))
        db.commit()
        logger.info("✅ Вопросы инициализированы в БД")
    db.close()


init_db()

# =============================================================================
# PYDANTIC MODELS
# =============================================================================


class EmployeeSearch(BaseModel):
    query: str


class EmployeeIn(BaseModel):
    fio: str
    department: str
    center: str


class AuditSessionCreate(BaseModel):
    auditor_fio: str
    auditor_dept: str
    center: str
    check_date: str
    employee_fio: str
    employee_dept: str
    employee_center: str
    selected_question_ids: List[int]
    answers: dict

# =============================================================================
# HELPERS
# =============================================================================


def get_quarter(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    q = (dt.month - 1) // 3 + 1
    return f"{dt.year}-Q{q}"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# =============================================================================
# ENDPOINTS
# =============================================================================


@app.get("/api/meta")
def get_meta(db: Session = Depends(get_db)):
    questions = db.query(Question).order_by(Question.index_num).all()
    return {
        "centers": CENTERS_LIST,
        "departments": DEPARTMENTS_LIST,
        "questions": [{"id": q.id, "text": q.text, "num": q.index_num} for q in questions]
    }


@app.post("/api/employees/search")
def search_employees(data: EmployeeSearch, db: Session = Depends(get_db)):
    if not data.query:
        return []
    results = db.query(Employee).filter(
        Employee.fio.ilike(f"%{data.query}%")).limit(10).all()
    return [{"id": r.id, "fio": r.fio, "department": r.department, "center": r.center} for r in results]


@app.post("/api/employees/upsert")
def upsert_employee(data: EmployeeIn, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(
        Employee.fio == data.fio,
        Employee.department == data.department,
        Employee.center == data.center
    ).first()
    if not emp:
        emp = Employee(fio=data.fio, department=data.department,
                       center=data.center)
        db.add(emp)
        db.commit()
        db.refresh(emp)
    return {"id": emp.id, "fio": emp.fio, "department": emp.department, "center": emp.center}


@app.post("/api/sessions")
def create_session(data: AuditSessionCreate, db: Session = Depends(get_db)):
    """Создать или обновить сессию аудита"""
    logger.info(
        f"📥 Received session data: auditor={data.auditor_fio}, employee={data.employee_fio}")
    logger.info(f"📊 selected_question_ids: {data.selected_question_ids}")
    logger.info(f"📊 answers keys: {list(data.answers.keys())}")

    try:
        # 1. Найти или создать сотрудника
        emp = db.query(Employee).filter(
            Employee.fio == data.employee_fio,
            Employee.department == data.employee_dept,
            Employee.center == data.employee_center
        ).first()

        if not emp:
            emp = Employee(
                fio=data.employee_fio, department=data.employee_dept, center=data.employee_center)
            db.add(emp)
            db.commit()
            db.refresh(emp)

        quarter = get_quarter(data.check_date)

        # 2. Найти или создать сессию
        session = db.query(AuditSession).filter(
            AuditSession.auditor_fio == data.auditor_fio,
            AuditSession.employee_id == emp.id,
            AuditSession.check_date == data.check_date
        ).first()

        if not session:
            session = AuditSession(
                auditor_fio=data.auditor_fio,
                auditor_dept=data.auditor_dept,
                center=data.center,
                check_date=data.check_date,
                quarter=quarter,
                employee_id=emp.id
            )
            db.add(session)
            db.flush()
            logger.info(f"✨ Created new session {session.id}")
        else:
            logger.info(f"📂 Found existing session {session.id}")

        # 3. Сохраняем ответы
        saved_count = 0
        for q_id in data.selected_question_ids:
            result = data.answers.get(q_id) or data.answers.get(str(q_id))
            if result is None:
                continue
            result = str(result).lower().strip()
            if result not in ['passed', 'failed']:
                continue

            existing_answer = db.query(AuditAnswer).filter(
                AuditAnswer.session_id == session.id,
                AuditAnswer.question_id == q_id
            ).first()

            if existing_answer:
                existing_answer.result = result
            else:
                new_ans = AuditAnswer(
                    session_id=session.id, question_id=q_id, result=result)
                db.add(new_ans)

            saved_count += 1

        db.commit()
        logger.info(f"💾 Committed {saved_count} answers")

        db.refresh(session)

        # 4. ✅ НОВАЯ ЛОГИКА: Статус только по количеству отвеченных вопросов
        all_quarter_sessions = db.query(AuditSession).filter(
            AuditSession.employee_id == emp.id,
            AuditSession.quarter == quarter
        ).options(joinedload(AuditSession.answers)).all()

        answered_question_ids = set()
        for s in all_quarter_sessions:
            for ans in s.answers:
                answered_question_ids.add(ans.question_id)

        # ✅ Статус "Сдан" ТОЛЬКО если все 17 вопросов отвечены
        all_17_answered = len(answered_question_ids) == 17
        final_status = SessionStatus.COMPLETED.value if all_17_answered else SessionStatus.IN_PROGRESS.value

        logger.info(
            f"📊 Answered: {len(answered_question_ids)}/17 → Status: {final_status}")

        # Обновляем статусы всех сессий квартала
        for s in all_quarter_sessions:
            s.status = final_status

        db.commit()

        return {
            "status": "ok",
            "session_id": session.id,
            "global_status": final_status,
            "answered_count": len(answered_question_ids),
            "saved_answers": saved_count
        }

    except Exception as e:
        logger.error(f"❌ Error creating session: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/history")
def get_history(
    auditor_fio: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    center: Optional[str] = Query(None),
    quarter: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(AuditSession).join(AuditSession.employee).options(
        joinedload(AuditSession.answers).joinedload(AuditAnswer.question)
    )

    if auditor_fio:
        query = query.filter(
            AuditSession.auditor_fio.ilike(f"%{auditor_fio}%"))
    if date_from:
        query = query.filter(AuditSession.check_date >= date_from)
    if date_to:
        query = query.filter(AuditSession.check_date <= date_to)
    if status:
        query = query.filter(AuditSession.status == status)
    if center:
        query = query.filter(AuditSession.center == center)
    if quarter:
        query = query.filter(AuditSession.quarter == quarter)

    sessions = query.order_by(AuditSession.check_date.desc()).all()

    result = []
    for s in sessions:
        q_nums = [a.question.index_num for a in s.answers]
        passed = sum(1 for a in s.answers if a.result == 'passed')
        failed = sum(1 for a in s.answers if a.result == 'failed')
        result.append({
            "id": s.id,
            "auditor_fio": s.auditor_fio,
            "center": s.center,
            "check_date": s.check_date,
            "quarter": s.quarter,
            "employee_fio": s.employee.fio,
            "employee_dept": s.employee.department,
            "employee_center": s.employee.center,
            "questions_asked": q_nums,
            "session_status": s.status,
            "total_passed": passed,
            "total_failed": failed
        })
    return result


@app.get("/api/dashboard/{auditor_name}")
def get_auditor_dashboard(auditor_name: str, db: Session = Depends(get_db)):
    sessions = db.query(AuditSession).filter(
        AuditSession.auditor_fio == auditor_name
    ).join(AuditSession.employee).options(
        joinedload(AuditSession.answers).joinedload(AuditAnswer.question)
    ).all()

    report = {}
    for s in sessions:
        key = f"{s.employee.fio} ({s.employee.department})"
        if key not in report:
            report[key] = {"name": s.employee.fio,
                           "dept": s.employee.department, "quarters": {}}
        q = s.quarter
        if q not in report[key]["quarters"]:
            report[key]["quarters"][q] = {"status": s.status, "questions": []}
        for ans in s.answers:
            report[key]["quarters"][q]["questions"].append({
                "num": ans.question.index_num,
                "result": ans.result
            })
    return list(report.values())


@app.get("/api/export-excel")
def export_excel(db: Session = Depends(get_db)):
    sessions = db.query(AuditSession).options(
        joinedload(AuditSession.answers).joinedload(AuditAnswer.question)
    ).all()

    data = []
    for s in sessions:
        row = {
            "Дата": s.check_date,
            "Квартал": s.quarter,
            "Аудитор": s.auditor_fio,
            "Центр аудитора": s.center,
            "Сотрудник": s.employee.fio,
            "Подразделение": s.employee.department,
            "Центр сотрудника": s.employee.center,
            "Статус": s.status
        }
        for ans in s.answers:
            row[f"Q{ans.question.index_num}"] = ans.result
        data.append(row)

    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Audit Report')
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=polilab_audit_full.xlsx"}
    )


if __name__ == "__main__":
    import uvicorn
    logger.info("🚀 Запуск сервера на http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)
