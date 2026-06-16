# apps/audit/routes.py
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from typing import Dict, Optional, List
import pandas as pd, io, logging, uuid
from pydantic import BaseModel

from apps.audit.database import get_db, init_db
from apps.audit.models import (
    Employee, Question, AuditSession, AuditAnswer, SessionStatus,
    CENTERS_LIST, DEPARTMENTS_LIST, ALL_QUESTIONS_TEXT
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["audit"])

# 🔹 Твои Pydantic-модели (можно вынести в schemas.py)
class EmployeeSearch(BaseModel): query: str
class EmployeeIn(BaseModel): fio: str; department: str; center: str
class AuditSessionCreate(BaseModel):
    auditor_fio: str; auditor_dept: str; center: str; check_date: str
    employee_fio: str; employee_dept: str; employee_center: str
    selected_question_ids: List[int]; answers: dict
class LoginRequest(BaseModel): username: str; password: str
class LoginResponse(BaseModel):
    success: bool; message: str; user: Optional[dict] = None; permissions: List[str] = []

USERS_DB: Dict[str, dict] = {
    "polylab": {
        "password": "2026",
        "display_name": "Polylab Service",
        "role": "auditor",
        "permissions": [
            "audit:read", "audit:write",
            "monitoring:read",
            "monitoring:scrape",
        ]
    },
    "admin": {
        "password": "admin",
        "display_name": "Administrator",
        "role": "admin",
        "permissions": [
            "audit:read", "audit:write",
            "admin:dashboard", "users:manage",
            "monitoring:read",
            "monitoring:scrape",
        ]
    }
}

# Helpers
def get_quarter(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return f"{dt.year}-Q{(dt.month - 1) // 3 + 1}"


@router.post("/api/login")
def login(data: LoginRequest):
    user = USERS_DB.get(data.username)
    if not user or user["password"] != data.password:
        raise HTTPException(401, detail="Неверный логин или пароль")
    return LoginResponse(success=True, message="Вход выполнен", user={"username": data.username, "display_name": user["display_name"], "role": user["role"]}, permissions=user["permissions"])

@router.get("/api/meta")
def get_meta(db: Session = Depends(get_db)):
    questions = db.query(Question).order_by(Question.index_num).all()
    return {"centers": CENTERS_LIST, "departments": DEPARTMENTS_LIST, "questions": [{"id": q.id, "text": q.text, "num": q.index_num} for q in questions]}

@router.post("/api/employees/search")
def search_employees(data: EmployeeSearch, db: Session = Depends(get_db)):
    if not data.query: return []
    results = db.query(Employee).filter(Employee.fio.ilike(f"%{data.query}%")).limit(10).all()
    return [{"id": r.id, "fio": r.fio, "department": r.department, "center": r.center} for r in results]

@router.post("/api/employees/upsert")
def upsert_employee(data: EmployeeIn, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.fio == data.fio, Employee.department == data.department, Employee.center == data.center).first()
    if not emp:
        emp = Employee(fio=data.fio, department=data.department, center=data.center); db.add(emp); db.commit(); db.refresh(emp)
    return {"id": emp.id, "fio": emp.fio, "department": emp.department, "center": emp.center}

@router.post("/api/sessions")
def create_session(data: AuditSessionCreate, db: Session = Depends(get_db)):
    logger.info(f"📥 Received: auditor={data.auditor_fio}, employee={data.employee_fio}")
    emp = db.query(Employee).filter(Employee.fio == data.employee_fio, Employee.department == data.employee_dept, Employee.center == data.employee_center).first()
    if not emp: raise HTTPException(400, detail="Сотрудник не найден в справочнике")
    quarter = get_quarter(data.check_date)
    session = db.query(AuditSession).filter(AuditSession.auditor_fio == data.auditor_fio, AuditSession.employee_id == emp.id, AuditSession.check_date == data.check_date).first()
    if not session:
        session = AuditSession(auditor_fio=data.auditor_fio, auditor_dept=data.auditor_dept, center=data.center, check_date=data.check_date, quarter=quarter, employee_id=emp.id); db.add(session); db.flush()
    saved_count = 0
    for q_id in data.selected_question_ids:
        result = data.answers.get(q_id) or data.answers.get(str(q_id))
        if result is None or str(result).lower().strip() not in ['passed', 'failed']: continue
        existing = db.query(AuditAnswer).filter(AuditAnswer.session_id == session.id, AuditAnswer.question_id == q_id).first()
        if existing: existing.result = str(result).lower().strip()
        else: db.add(AuditAnswer(session_id=session.id, question_id=q_id, result=str(result).lower().strip()))
        saved_count += 1
    db.commit(); db.refresh(session)
    all_q = db.query(AuditSession).filter(AuditSession.employee_id == emp.id, AuditSession.quarter == quarter).options(joinedload(AuditSession.answers)).all()
    answered = set(a.question_id for s in all_q for a in s.answers)
    final_status = SessionStatus.COMPLETED.value if len(answered) == 17 else SessionStatus.IN_PROGRESS.value
    for s in all_q: s.status = final_status
    db.commit()
    return {"status": "ok", "session_id": session.id, "global_status": final_status, "answered_count": len(answered), "saved_answers": saved_count}

@router.get("/api/history")
def get_history(auditor_fio: Optional[str] = Query(None), date_from: Optional[str] = Query(None), date_to: Optional[str] = Query(None), status: Optional[str] = Query(None), center: Optional[str] = Query(None), quarter: Optional[str] = Query(None), db: Session = Depends(get_db)):
    query = db.query(AuditSession).join(AuditSession.employee).options(joinedload(AuditSession.answers).joinedload(AuditAnswer.question))
    if auditor_fio: query = query.filter(AuditSession.auditor_fio.ilike(f"%{auditor_fio}%"))
    if date_from: query = query.filter(AuditSession.check_date >= date_from)
    if date_to: query = query.filter(AuditSession.check_date <= date_to)
    if status: query = query.filter(AuditSession.status == status)
    if center: query = query.filter(AuditSession.center == center)
    if quarter: query = query.filter(AuditSession.quarter == quarter)
    sessions = query.order_by(AuditSession.check_date.desc()).all()
    result = []
    for s in sessions:
        q_nums = [a.question.index_num for a in s.answers]
        passed = sum(1 for a in s.answers if a.result == 'passed')
        failed = sum(1 for a in s.answers if a.result == 'failed')
        result.append({"id": str(s.id), "auditor_fio": s.auditor_fio, "center": s.center, "check_date": s.check_date, "quarter": s.quarter, "employee_fio": s.employee.fio if s.employee else "Сотрудник удалён", "employee_dept": s.employee.department if s.employee else "", "employee_center": s.employee.center if s.employee else "", "questions_asked": q_nums, "session_status": s.status, "total_passed": passed, "total_failed": failed})
    return result

@router.get("/api/export-excel")
def export_excel(auditor_fio: Optional[str] = Query(None), date_from: Optional[str] = Query(None), date_to: Optional[str] = Query(None), status: Optional[str] = Query(None), center: Optional[str] = Query(None), quarter: Optional[str] = Query(None), db: Session = Depends(get_db)):
    from fastapi.responses import StreamingResponse
    query = db.query(AuditSession).join(AuditSession.employee).options(joinedload(AuditSession.answers).joinedload(AuditAnswer.question))
    if auditor_fio: query = query.filter(AuditSession.auditor_fio.ilike(f"%{auditor_fio}%"))
    if date_from: query = query.filter(AuditSession.check_date >= date_from)
    if date_to: query = query.filter(AuditSession.check_date <= date_to)
    if status: query = query.filter(AuditSession.status == status)
    if center: query = query.filter(AuditSession.center == center)
    if quarter: query = query.filter(AuditSession.quarter == quarter)
    sessions = query.all()
    rows = []
    for s in sessions:
        check_dt = datetime.strptime(s.check_date, "%Y-%m-%d")
        report_month = f"{check_dt.month:02d}.{check_dt.year}"
        for ans in s.answers:
            status_ru = "Сдал" if ans.result == "passed" else "Не сдал"
            rows.append({"Подразделение": s.employee.department if s.employee else "", "ФИО": s.employee.fio if s.employee else "Сотрудник удалён", "Центр ПолиЛаб": s.employee.center if s.employee else "", "Отчетный месяц": report_month, "Вопрос": ans.question.text, "Дата": s.check_date, "Статус": status_ru, "Кто провел БП ФИО": s.auditor_fio, "Подразделение проводившего": s.auditor_dept, "ID_проверки": str(s.id)})
    df = pd.DataFrame(rows)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer: df.to_excel(writer, index=False, sheet_name='Audit Report')
    output.seek(0)
    filename = f"polilab_audit_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={filename}"})

@router.post("/api/import-employees")
async def import_employees(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        logger.info(f"📥 Импорт: {file.filename}")
        if not file.filename: raise HTTPException(400, detail="Файл не выбран")
        contents = await file.read()
        filename_lower = file.filename.lower()
        if filename_lower.endswith('.xlsx'):
            try: df = pd.read_excel(io.BytesIO(contents), engine='openpyxl')
            except ImportError: df = pd.read_excel(io.BytesIO(contents), engine='calamine')
        elif filename_lower.endswith('.csv'): df = pd.read_csv(io.BytesIO(contents), encoding='utf-8-sig')
        else: raise HTTPException(400, detail="Только .xlsx и .csv")
        df.columns = df.columns.str.strip().str.lower()
        col_map = {}
        for col in df.columns:
            if col in ('фио', 'fio', 'fullname'): col_map[col] = 'fio'
            elif col in ('центр', 'center', 'city'): col_map[col] = 'center'
            elif col in ('подразделение', 'department', 'dept'): col_map[col] = 'department'
        if len(col_map) != 3: raise HTTPException(400, detail="Нужны колонки: ФИО, Центр, Подразделение")
        df.rename(columns=col_map, inplace=True)
        for col in ['fio', 'center', 'department']: df[col] = df[col].astype(str).str.strip()
        df = df[(df['fio'] != '') & (df['center'] != '') & (df['department'] != '') & (df['fio'] != 'nan')].drop_duplicates(subset=['fio', 'center', 'department'])
        file_keys = {(str(r['fio']).strip(), str(r['department']).strip(), str(r['center']).strip()) for _, r in df.iterrows() if str(r['fio']).strip() and str(r['fio']).lower() != 'nan'}
        existing = {e.id: e for e in db.query(Employee).all()}
        existing_map = {(e.fio, e.department, e.center): e for e in existing.values()}
        added = sum(1 for k in file_keys if k not in existing_map)
        for fio, dept, center in file_keys:
            if (fio, dept, center) not in existing_map: db.add(Employee(fio=fio, department=dept, center=center))
        removed = 0
        for emp in existing.values():
            if (emp.fio, emp.department, emp.center) not in file_keys:
                db.query(AuditSession).filter(AuditSession.employee_id == emp.id).update({"employee_id": None}, synchronize_session=False)
                db.delete(emp); removed += 1
        db.commit()
        logger.info(f"🎉 Импорт: +{added}, -{removed}")
        return {"message": "Справочник синхронизирован", "added": added, "removed": removed, "total_after": len(file_keys)}
    except HTTPException: raise
    except Exception as e:
        logger.error(f"💥 Ошибка импорта: {e}", exc_info=True); db.rollback()
        raise HTTPException(500, detail=f"Ошибка: {str(e)}")

@router.get("/api/quarters")
def get_quarters(db: Session = Depends(get_db)):
    return [q[0] for q in db.query(AuditSession.quarter).distinct().order_by(AuditSession.quarter.desc()).all()]

@router.get("/api/report/quarterly")
def quarterly_report(quarter: str = Query(...), db: Session = Depends(get_db)):
    employees = db.query(Employee).all()
    sessions = db.query(AuditSession).filter(AuditSession.quarter == quarter).all()
    checked_ids = {s.employee_id for s in sessions if s.employee_id is not None}
    centers_dict = {}
    for c in CENTERS_LIST: centers_dict[c] = {"center": c, "total_employees": 0, "checked": 0, "not_checked": 0, "employees": []}
    for emp in employees:
        c = emp.center
        if c not in centers_dict: centers_dict[c] = {"center": c, "total_employees": 0, "checked": 0, "not_checked": 0, "employees": []}
        is_checked = emp.id in checked_ids
        centers_dict[c]["total_employees"] += 1
        if is_checked: centers_dict[c]["checked"] += 1; centers_dict[c]["employees"].append({"fio": emp.fio, "department": emp.department, "status": "checked", "status_text": "Проверка пройдена"})
        else: centers_dict[c]["not_checked"] += 1; centers_dict[c]["employees"].append({"fio": emp.fio, "department": emp.department, "status": "not_checked", "status_text": "Не проходил(а)"})
    known = set(CENTERS_LIST)
    return {"quarter": quarter, "centers": sorted(centers_dict.values(), key=lambda x: (0 if x["center"] in known else 1, x["center"]))}

@router.get("/api/employees/not-checked")
def get_employees_not_checked(quarter: Optional[str] = Query(None), center: Optional[str] = Query(None), department: Optional[str] = Query(None), fio: Optional[str] = Query(None), db: Session = Depends(get_db)):
    query = db.query(Employee)
    if fio: query = query.filter(Employee.fio.ilike(f"%{fio}%"))
    if center: query = query.filter(Employee.center == center)
    if department: query = query.filter(Employee.department == department)
    all_emp = query.all()
    if quarter:
        checked = [r[0] for r in db.query(AuditSession.employee_id).filter(AuditSession.quarter == quarter, AuditSession.employee_id.isnot(None)).distinct().all() if r[0]]
        result = [e for e in all_emp if e.id not in checked]
    else: result = all_emp
    return [{"id": e.id, "fio": e.fio, "center": e.center, "department": e.department} for e in result]

@router.delete("/api/sessions/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(AuditSession).filter(AuditSession.id == session_id).first()
    if not session: raise HTTPException(404, detail="Не найдена")
    db.delete(session); db.commit()
    logger.info(f"🗑️ Удалена сессия {session_id}")
    return {"message": "Удалено", "session_id": session_id}