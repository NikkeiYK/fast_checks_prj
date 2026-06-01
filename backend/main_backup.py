# =============================================================================
# POLYLAB AUDIT SYSTEM v2 - Backend (FastAPI)
# =============================================================================
from fastapi import FastAPI, HTTPException, Depends, Header, Query, Body, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from typing import Dict, Optional, List
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, Session, joinedload
from datetime import datetime
import pandas as pd
import io
import logging
import os
import uuid

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Конфигурация БД
if os.environ.get("AMVERA") == "1":
    DATABASE_URL = "sqlite:////data/audit_db_v2.sqlite"
else:
    DATABASE_URL = "sqlite:///./audit_db_v2.sqlite"

Base = declarative_base()
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

app = FastAPI(title="Polylab Audit System v2")


def get_cors_origins() -> list[str]:
    default_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "https://platform-frontend-polylab.amvera.io",
        "*"
    ]
    env_origins = os.environ.get("AMVERA_CORS_ORIGINS", "")
    if env_origins:
        custom_origins = [o.strip() for o in env_origins.split(",") if o.strip()]
        return list(set(default_origins + custom_origins))
    return default_origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# =============================================================================
# СПРАВОЧНИКИ
# =============================================================================
CENTERS_LIST = [
    "Казань", "Москва", "Пермь", "Всеволожск",
    "Красноярск", "Нижнекамск", "Нижний Новгород", "Воронеж"
]

DEPARTMENTS_LIST = [
    "СПОР", "Прикладные разработки",
    "Продуктовое развитие", "РПИ", "РПС", "ЦИРМ", "НТР"
]

ALL_QUESTIONS_TEXT = [
    "Действия при обнаружении возгорания/задымления.",
    "Действия при атаке беспилотников/ракетная опасность. Сценарий 1,2.",
    "Действия при обнаружении пострадавшего.",
    "Бизнес контракт ОТиПБ, метрики.",
    "Бизнес контракт СИБУР ПолиЛаб.",
    "Виды кровотечений, первая помощь ранее шеи, повреждение артерии. Первая помощь при отравлении.",
    "Телефоны экстренных служб.",
    "Набор ЛАРН/ЛАРХВ/демеркуризационный набор — место расположения, порядок действий.",
    "АБВР.",
    "Какая была последняя молния, выводы.",
    "Какие правила безопасности нужно соблюдать при использовании электрооборудования? Действия при электротравме?",
    "Правила работы с химическими веществами (прекурсоры, метанол, ЛВЖ, ГЖ).",
    "Простые экологические правила. Виды отходов ПолиЛаб. Места складирования. Экологические аспекты.",
    "Первая помощь при падении сотрудника с высоты.",
    "Виды первичных средств пожаротушения, правила использования и места расположения.",
    "Термические и химические ожоги. Первая помощь.",
    "КПБ"
]

# =============================================================================
# МОДЕЛИ БД
# =============================================================================

from enum import Enum as PyEnum


class SessionStatus(str, PyEnum):
    IN_PROGRESS = "В процессе"
    COMPLETED = "Сдан"


class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    fio = Column(String, index=True)
    department = Column(String)
    center = Column(String, index=True)
    __table_args__ = (UniqueConstraint('fio', 'department', 'center', name='uq_emp_dept_center'),)
    sessions = relationship("AuditSession", back_populates="employee", passive_deletes=True)


class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    text = Column(String, unique=True)
    index_num = Column(Integer)


class AuditSession(Base):
    __tablename__ = "audit_sessions"
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    auditor_fio = Column(String, index=True)
    auditor_dept = Column(String)
    center = Column(String, index=True)
    check_date = Column(String, index=True)
    quarter = Column(String, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    status = Column(String, default=SessionStatus.IN_PROGRESS)
    employee = relationship("Employee", back_populates="sessions")
    answers = relationship("AuditAnswer", back_populates="session", cascade="all, delete-orphan")


class AuditAnswer(Base):
    __tablename__ = "audit_answers"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("audit_sessions.id"), index=True)
    question_id = Column(Integer, ForeignKey("questions.id"))
    result = Column(String)
    question = relationship("Question")
    session = relationship("AuditSession", back_populates="answers")


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if db.query(Question).count() == 0:
        for i, q_text in enumerate(ALL_QUESTIONS_TEXT, 1):
            db.add(Question(text=q_text, index_num=i))
        db.commit()
        logger.info("✅ Вопросы инициализированы")
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
# АВТОРИЗАЦИЯ
# =============================================================================

USERS_DB: Dict[str, dict] = {
    "polylab": {
        "password": "2026",
        "display_name": "Polylab Service",
        "role": "auditor",  # аудитор: видит только аудит
        "permissions": ["audit:read", "audit:write"]
    },
    "admin": {
        "password": "admin",  
        "display_name": "Administrator",
        "role": "admin",  # админ: видит всё + вкладку "Главная"
        "permissions": ["audit:read", "audit:write", "admin:dashboard", "users:manage"]
    }
}

# Для будущего расширения — можно добавить middleware
security = HTTPBearer(auto_error=False)

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    success: bool
    message: str
    user: Optional[dict] = None
    permissions: List[str] = []  # возвращаем права для фронтенда


@app.post("/api/login")
def login(data: LoginRequest):
    user = USERS_DB.get(data.username)
    
    if not user or user["password"] != data.password:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    
    return LoginResponse(
        success=True,
        message="Вход выполнен",
        user={
            "username": data.username,
            "display_name": user["display_name"],
            "role": user["role"]
        },
        permissions=user["permissions"]
    )


@app.get("/api/me")
def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """
    Эндпоинт для проверки текущей сессии.
    В текущей реализации — возвращает заглушку.
    В будущем: декодировать JWT и возвращать реального пользователя.
    """
    # 🔹 Для MVP: фронтенд хранит user в localStorage, этот эндпоинт — для валидации
    return {"authenticated": False, "message": "Use /api/login for authentication"}


# =============================================================================
# ОСНОВНЫЕ ЭНДПОИНТЫ
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
        Employee.fio.ilike(f"%{data.query}%")
    ).limit(10).all()
    return [{"id": r.id, "fio": r.fio, "department": r.department, "center": r.center} for r in results]


@app.post("/api/employees/upsert")
def upsert_employee(data: EmployeeIn, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(
        Employee.fio == data.fio,
        Employee.department == data.department,
        Employee.center == data.center
    ).first()
    if not emp:
        emp = Employee(fio=data.fio, department=data.department, center=data.center)
        db.add(emp)
        db.commit()
        db.refresh(emp)
    return {"id": emp.id, "fio": emp.fio, "department": emp.department, "center": emp.center}


@app.post("/api/sessions")
def create_session(data: AuditSessionCreate, db: Session = Depends(get_db)):
    logger.info(f"📥 Received session data: auditor={data.auditor_fio}, employee={data.employee_fio}")

    # Ищем сотрудника строго в справочнике
    emp = db.query(Employee).filter(
        Employee.fio == data.employee_fio,
        Employee.department == data.employee_dept,
        Employee.center == data.employee_center
    ).first()

    if not emp:
        raise HTTPException(
            status_code=400,
            detail="Сотрудник не найден в справочнике. Сначала импортируйте актуальный список."
        )

    quarter = get_quarter(data.check_date)

    # Найти или создать сессию
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

    # Сохраняем ответы
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
            new_ans = AuditAnswer(session_id=session.id, question_id=q_id, result=result)
            db.add(new_ans)
        saved_count += 1

    db.commit()
    db.refresh(session)

    # Определяем глобальный статус сотрудника за квартал
    all_quarter_sessions = db.query(AuditSession).filter(
        AuditSession.employee_id == emp.id,
        AuditSession.quarter == quarter
    ).options(joinedload(AuditSession.answers)).all()

    answered_question_ids = set()
    for s in all_quarter_sessions:
        for ans in s.answers:
            answered_question_ids.add(ans.question_id)

    final_status = SessionStatus.COMPLETED.value if len(answered_question_ids) == 17 else SessionStatus.IN_PROGRESS.value

    # Обновляем статус всех сессий сотрудника в квартале
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
        query = query.filter(AuditSession.auditor_fio.ilike(f"%{auditor_fio}%"))
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
            "id": str(s.id),
            "auditor_fio": s.auditor_fio,
            "center": s.center,
            "check_date": s.check_date,
            "quarter": s.quarter,
            "employee_fio": s.employee.fio if s.employee else "Сотрудник удалён",
            "employee_dept": s.employee.department if s.employee else "",
            "employee_center": s.employee.center if s.employee else "",
            "questions_asked": q_nums,
            "session_status": s.status,
            "total_passed": passed,
            "total_failed": failed
        })
    return result


@app.get("/api/export-excel")
def export_excel(
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
        query = query.filter(AuditSession.auditor_fio.ilike(f"%{auditor_fio}%"))
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

    sessions = query.all()
    rows = []
    for s in sessions:
        check_dt = datetime.strptime(s.check_date, "%Y-%m-%d")
        report_month = f"{check_dt.month:02d}.{check_dt.year}"
        for ans in s.answers:
            status_ru = "Сдал" if ans.result == "passed" else "Не сдал"
            rows.append({
                "Подразделение": s.employee.department if s.employee else "",
                "ФИО": s.employee.fio if s.employee else "Сотрудник удалён",
                "Центр ПолиЛаб": s.employee.center if s.employee else "",
                "Отчетный месяц": report_month,
                "Вопрос": ans.question.text,
                "Дата": s.check_date,
                "Статус": status_ru,
                "Кто провел БП ФИО": s.auditor_fio,
                "Подразделение проводившего": s.auditor_dept,
                "ID_проверки": str(s.id),
            })

    df = pd.DataFrame(rows)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Audit Report')
    output.seek(0)
    filename = f"polilab_audit_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# =============================================================================
# НОВЫЕ ЭНДПОИНТЫ (импорт, кварталы, отчёт)
# =============================================================================

@app.post("/api/import-employees")
async def import_employees(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Синхронизация справочника сотрудников.
    ✅ Сессии проверок сохраняются даже если сотрудник удалён из справочника.
    """
    try:
        logger.info(f"📥 Начат импорт: {file.filename}")
        
        if not file.filename:
            raise HTTPException(400, detail="Файл не выбран")
            
        filename_lower = file.filename.lower()
        contents = await file.read()
        logger.info(f"📄 Размер файла: {len(contents)} байт")
        
        # 🔹 Чтение файла (xlsx/csv) — без изменений
        if filename_lower.endswith('.xlsx'):
            try:
                df = pd.read_excel(io.BytesIO(contents), engine='openpyxl')
            except ValueError as e:
                if "stylesheet" in str(e).lower() or "xml" in str(e).lower():
                    try:
                        df = pd.read_excel(io.BytesIO(contents), engine='openpyxl',
                                         engine_kwargs={'data_only': True, 'keep_vba': False})
                    except Exception:
                        try:
                            df = pd.read_excel(io.BytesIO(contents), engine='calamine')
                        except ImportError:
                            raise HTTPException(400, detail="Файл Excel содержит невалидные стили. "
                                                           "Сохраните его заново в Excel или установите: pip install fastexcel")
                        except Exception as e2:
                            raise HTTPException(400, detail=f"Не удалось прочитать файл: {str(e2)}")
                else:
                    raise
            except ImportError:
                try:
                    df = pd.read_excel(io.BytesIO(contents), engine='calamine')
                except ImportError:
                    raise HTTPException(400, detail="Не установлен движок для чтения Excel. Установите: pip install openpyxl")
        elif filename_lower.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents), encoding='utf-8-sig')
        else:
            raise HTTPException(400, detail="Поддерживаются только .xlsx и .csv файлы")

        # 🔹 Обработка данных — без изменений
        df.columns = df.columns.str.strip().str.lower()
        col_map = {}
        for col in df.columns:
            if col in ('фио', 'fio', 'fullname', 'full_name', 'name'):
                col_map[col] = 'fio'
            elif col in ('центр', 'center', 'city', 'location', 'офис'):
                col_map[col] = 'center'
            elif col in ('подразделение', 'department', 'dept', 'департамент', 'отдел'):
                col_map[col] = 'department'
        
        if len(col_map) != 3:
            raise HTTPException(400, detail=f"Файл должен содержать колонки: ФИО, Центр, Подразделение")
        
        df.rename(columns=col_map, inplace=True)
        df['fio'] = df['fio'].astype(str).str.strip()
        df['center'] = df['center'].astype(str).str.strip()
        df['department'] = df['department'].astype(str).str.strip()
        df = df[(df['fio'] != '') & (df['center'] != '') & (df['department'] != '') & (df['fio'] != 'nan')]
        df = df.drop_duplicates(subset=['fio', 'center', 'department'])
        
        file_keys = set()
        for _, row in df.iterrows():
            fio = str(row['fio']).strip()
            center = str(row['center']).strip()
            department = str(row['department']).strip()
            if fio and center and department and fio.lower() != 'nan':
                file_keys.add((fio, department, center))
        
        # ✅ ИСПРАВЛЕНИЕ: не удалять сотрудников физически, а "отвязывать" сессии
        existing = db.query(Employee).all()
        existing_map = {(e.fio, e.department, e.center): e for e in existing}
        
        added = 0
        for fio, department, center in file_keys:
            if (fio, department, center) not in existing_map:
                db.add(Employee(fio=fio, department=department, center=center))
                added += 1
        
        removed = 0
        for emp in existing:
            if (emp.fio, emp.department, emp.center) not in file_keys:
                # 🔹 Сначала отвязываем сессии: employee_id = NULL
                db.query(AuditSession).filter(AuditSession.employee_id == emp.id).update(
                    {"employee_id": None},
                    synchronize_session=False
                )
                # 🔹 Теперь можно удалить сотрудника
                db.delete(emp)
                removed += 1
        
        db.commit()
        logger.info(f"🎉 Импорт завершён: +{added}, -{removed}")
        
        return {
            "message": "Справочник синхронизирован",
            "added": added,
            "removed": removed,
            "total_after": len(file_keys)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 Ошибка импорта: {type(e).__name__}: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка обработки файла: {str(e)}")
    

@app.get("/api/quarters")
def get_quarters(db: Session = Depends(get_db)):
    """Список кварталов, по которым есть сессии."""
    quarters = db.query(AuditSession.quarter).distinct().order_by(AuditSession.quarter.desc()).all()
    return [q[0] for q in quarters]


@app.get("/api/report/quarterly")
def quarterly_report(quarter: str = Query(...), db: Session = Depends(get_db)):
    """
    Отчёт по центрам за квартал.
    ✅ Показывает все центры из CENTERS_LIST + дополнительные из БД.
    ✅ Показывает всех сотрудников, даже если у них нет проверок.
    """
    employees = db.query(Employee).all()
    sessions = db.query(AuditSession).filter(AuditSession.quarter == quarter).all()
    checked_ids = set(s.employee_id for s in sessions if s.employee_id is not None)

    # ✅ Инициализируем центры из справочника
    centers_dict = {}
    for center_name in CENTERS_LIST:
        centers_dict[center_name] = {
            "center": center_name,
            "total_employees": 0,
            "checked": 0,
            "not_checked": 0,
            "employees": []
        }

    # ✅ Добавляем сотрудников в соответствующие центры
    for emp in employees:
        center = emp.center
        if center not in centers_dict:
            # Если центр не в справочнике — создаём запись для него
            centers_dict[center] = {
                "center": center,
                "total_employees": 0,
                "checked": 0,
                "not_checked": 0,
                "employees": []
            }
        
        is_checked = emp.id in checked_ids
        centers_dict[center]["total_employees"] += 1
        if is_checked:
            centers_dict[center]["checked"] += 1
            emp_status = "checked"
            status_text = "Проверка пройдена"
        else:
            centers_dict[center]["not_checked"] += 1
            emp_status = "not_checked"
            status_text = "Не проходил(а)"

        centers_dict[center]["employees"].append({
            "fio": emp.fio,
            "department": emp.department,
            "status": emp_status,
            "status_text": status_text
        })

    # ✅ Сортировка: сначала центры из справочника, потом остальные
    known_centers = set(CENTERS_LIST)
    centers_list = sorted(
        centers_dict.values(), 
        key=lambda x: (0 if x["center"] in known_centers else 1, x["center"])
    )
    
    return {
        "quarter": quarter,
        "centers": centers_list
    }
    
@app.get("/api/employees/not-checked")
def get_employees_not_checked(
    quarter: Optional[str] = Query(None, description="Квартал, например 2024-Q1"),
    center: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    fio: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Возвращает список сотрудников, которые НЕ проходили быструю проверку 
    в указанном квартале.
    """
    
    # 1. Базовый запрос: все сотрудники из справочника
    query = db.query(Employee)
    
    # 2. Применяем фильтры по справочнику (если переданы)
    if fio:
        query = query.filter(Employee.fio.ilike(f"%{fio}%"))
    if center:
        query = query.filter(Employee.center == center)
    if department:
        query = query.filter(Employee.department == department)
    
    all_employees = query.all()
    
    # 3. Если указан квартал — исключаем тех, кто уже проходил проверку
    if quarter:
        # ✅ Выполняем запрос и получаем список ID как обычные значения
        checked_rows = (
            db.query(AuditSession.employee_id)
            .filter(
                AuditSession.quarter == quarter,
                AuditSession.employee_id.isnot(None)
            )
            .distinct()
            .all()  # Возвращает список кортежей: [(1,), (2,), ...]
        )
        # ✅ Преобразуем в плоский список чисел: [1, 2, ...]
        checked_ids = [row[0] for row in checked_rows if row[0] is not None]
        
        # ✅ Фильтруем в памяти Python
        result = [emp for emp in all_employees if emp.id not in checked_ids]
    else:
        result = all_employees
    
    # 4. Формируем ответ
    return [
        {
            "id": emp.id,
            "fio": emp.fio,
            "center": emp.center,
            "department": emp.department
        }
        for emp in result
    ]
    
@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    """
    Удаление записи проверки.
    🔹 Без проверки авторизации — для внутреннего использования.
    """
    session = db.query(AuditSession).filter(AuditSession.id == session_id).first()
    if not session:
        raise HTTPException(404, detail="Запись проверки не найдена")
    
    db.delete(session)
    db.commit()
    
    logger.info(f"🗑️ Сессия {session_id} удалена")
    return {"message": "Запись успешно удалена", "session_id": session_id}


if __name__ == "__main__":
    import uvicorn
    logger.info("🚀 Запуск сервера на http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)