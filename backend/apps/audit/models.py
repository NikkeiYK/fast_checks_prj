# apps/audit/models.py
from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from apps.audit.database import Base
from enum import Enum as PyEnum
import uuid

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

# Справочники (чтобы не импортировать циклически)
CENTERS_LIST = ["Казань", "Москва", "Пермь", "Всеволожск", "Красноярск", "Нижнекамск", "Нижний Новгород", "Воронеж"]
DEPARTMENTS_LIST = ["СПОР", "Прикладные разработки", "Продуктовое развитие", "РПИ", "РПС", "ЦИРМ", "НТР"]
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