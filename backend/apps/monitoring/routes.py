"""API-эндпоинты модуля мониторинга Росстандарта."""
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone
from typing import List, Optional
from collections import Counter
import logging

from .database import (
    get_db, GostNotification, SpNotification,
    TechnicalCommittee, ScrapingLog, NpaProject
)
from .schemas import (
    GostNotificationOut, SpNotificationOut,
    TechnicalCommitteeOut, TechnicalCommitteeCreate,
    DashboardResponse, DashboardStats, ScrapingResponse, ScrapingLogOut, NpaProjectOut, ApprovedDiscussionOut
)
from .polymer_filter import is_polymer_related, get_matched_keywords
from .scraper import is_in_date_range
from .priority_filter import is_priority_developer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


# ─────────────────────────────────────────────────────────────
# DASHBOARD DATA
# ─────────────────────────────────────────────────────────────

def _get_current_year() -> int:
    return datetime.now().year


def _extract_year(date_str: Optional[str]) -> Optional[int]:
    """Извлекает год из строки даты в различных форматах."""
    if not date_str:
        return None
    s = str(date_str).strip()
    
    # Формат DD.MM.YYYY или DD.MM.YY
    if "." in s:
        parts = s.split(".")
        if len(parts) == 3:
            try:
                return int(parts[2]) if len(parts[2]) == 4 else int("20" + parts[2])
            except ValueError:
                return None
        elif len(parts) == 2:
            try:
                return int(parts[1]) if len(parts[1]) == 4 else int("20" + parts[1])
            except ValueError:
                return None
    
    # Формат YYYY-MM-DD
    elif "-" in s:
        try:
            return int(s.split("-")[0])
        except ValueError:
            return None
    
    # Русский формат: "17 июня 2026"
    else:
        parts = s.split()
        if len(parts) == 3:
            try:
                return int(parts[2])
            except ValueError:
                return None
    
    return None


def _compute_stats(
    gost_list: List[GostNotification],
    sp_list: List[SpNotification],
    npa_list: List[NpaProject],
) -> DashboardStats:
    month_counter = Counter()
    tk_counter = Counter()
    status_counter = Counter()
    active = 0
    polymer_total = 0

    month_names = {
        "01": "Янв", "02": "Фев", "03": "Мар", "04": "Апр",
        "05": "Май", "06": "Июн", "07": "Июл", "08": "Авг",
        "09": "Сен", "10": "Окт", "11": "Ноя", "12": "Дек",
    }

    for g in gost_list:
        if g.start_date and "." in g.start_date:
            parts = g.start_date.split(".")
            if len(parts) == 3:
                month_counter[f"{parts[2]}-{parts[1]}"] += 1

        if g.technical_committee:
            tk_counter[g.technical_committee] += 1

        status_counter[g.status or "Неизвестно"] += 1
        if g.status == "Вынесен на публичное обсуждение":
            active += 1
        if g.is_polymer:
            polymer_total += 1

    sorted_months = sorted(month_counter.keys())
    m_labels = [
        f"{month_names.get(p[1], p[1])} {p[0]}"
        for p in [m.split("-") for m in sorted_months]
    ]
    m_values = [month_counter[m] for m in sorted_months]

    tk_most = tk_counter.most_common()

    return DashboardStats(
        total_gost=len(gost_list),
        total_npa=len(npa_list),
        total_sp=len(sp_list),
        active_count=active,
        completed_count=len(gost_list) - active,
        polymer_total=polymer_total,
        polymer_commented=0,
        status_labels=list(status_counter.keys()),
        status_values=list(status_counter.values()),
        month_labels=m_labels,
        month_values=m_values,
        all_tk_labels=[t[0] for t in tk_most],
        all_tk_values=[t[1] for t in tk_most],
    )


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    year: Optional[int] = None,
    country: Optional[str] = Query(default=None, description="RU, KZ или all"),
    db: Session = Depends(get_db),
):
    """Полные данные для дашборда с поддержкой фильтрации по стране."""
    from .config import OUR_TECHNICAL_COMMITTEES, SUPPORTED_COUNTRIES
    
    target_year = year or _get_current_year()
    
    # Базовые запросы
    q_gost = db.query(GostNotification)
    q_sp = db.query(SpNotification)
    q_npa = db.query(NpaProject)
    
    # Фильтр по стране
    if country and country.lower() != "all":
        country_upper = country.upper()
        q_gost = q_gost.filter(GostNotification.country == country_upper)
        q_sp = q_sp.filter(SpNotification.country == country_upper)
        q_npa = q_npa.filter(NpaProject.country == country_upper)
    
    # Фильтр по году
    all_gost = q_gost.all()
    gost = [g for g in all_gost if _extract_year(g.start_date) == target_year]
    
    all_sp = q_sp.all()
    sp = [s for s in all_sp if _extract_year(s.placement_date) == target_year]
    
    all_npa = q_npa.all()
    npa = [n for n in all_npa if _extract_year(n.published_date) == target_year]
    
    stats = _compute_stats(gost, sp, npa)
    
    # Доступные страны
    available_countries = [
        {"code": code, **info}
        for code, info in SUPPORTED_COUNTRIES.items()
    ]
    
    my_tks = OUR_TECHNICAL_COMMITTEES
    
    last_log = (
        db.query(ScrapingLog)
        .filter_by(status="success")
        .order_by(ScrapingLog.finished_at.desc())
        .first()
    )
    if last_log and last_log.finished_at:
        last_updated = last_log.finished_at.strftime("%d.%m.%Y %H:%M")
    else:
        last_updated = "—"
    
    return DashboardResponse(
        gost=[GostNotificationOut.model_validate(g) for g in gost],
        sp=[SpNotificationOut.model_validate(s) for s in sp],
        npa=[NpaProjectOut.model_validate(n) for n in npa],
        stats=stats,
        my_tks=my_tks,
        last_updated=last_updated,
        current_year=target_year,
        available_countries=available_countries,
    )


# ─────────────────────────────────────────────────────────────
# LISTS
# ─────────────────────────────────────────────────────────────

@router.get("/gost", response_model=List[GostNotificationOut])
def list_gost(
    year: Optional[int] = None,
    status: Optional[str] = None,
    tk: Optional[str] = None,
    is_polymer: Optional[bool] = None,
    limit: int = Query(default=500, le=5000),
    db: Session = Depends(get_db),
):
    q = db.query(GostNotification)
    if year:
        all_items = q.all()
        all_items = [g for g in all_items if _extract_year(g.start_date) == year]
        return all_items[:limit]
    if status:
        q = q.filter(GostNotification.status == status)
    if tk:
        q = q.filter(GostNotification.technical_committee.ilike(f"%{tk}%"))
    if is_polymer is not None:
        q = q.filter(GostNotification.is_polymer == is_polymer)
    return q.order_by(GostNotification.created_at.desc()).limit(limit).all()


@router.get("/sp", response_model=List[SpNotificationOut])
def list_sp(
    year: Optional[int] = None,
    is_polymer: Optional[bool] = None,
    limit: int = Query(default=500, le=5000),
    db: Session = Depends(get_db),
):
    q = db.query(SpNotification)
    if year:
        all_items = q.all()
        all_items = [s for s in all_items if _extract_year(s.placement_date) == year]
        return all_items[:limit]
    if is_polymer is not None:
        q = q.filter(SpNotification.is_polymer == is_polymer)
    return q.order_by(SpNotification.created_at.desc()).limit(limit).all()


@router.delete("/committees/{tk_id}", status_code=204)
def delete_committee(tk_id: int, db: Session = Depends(get_db)):
    tk = db.query(TechnicalCommittee).filter_by(id=tk_id).first()
    if not tk:
        raise HTTPException(status_code=404, detail="ТК не найден")
    db.delete(tk)
    db.commit()


# ─────────────────────────────────────────────────────────────
# SCRAPING LOG
# ─────────────────────────────────────────────────────────────

@router.get("/scraping-log/last", response_model=Optional[ScrapingLogOut])
def get_last_scraping_log(db: Session = Depends(get_db)):
    """Возвращает последний успешный лог скрапинга."""
    log = (
        db.query(ScrapingLog)
        .filter(ScrapingLog.status.in_(["success", "cancelled"]))
        .order_by(ScrapingLog.finished_at.desc())
        .first()
    )
    return log


# ─────────────────────────────────────────────────────────────
# SCRAPING
# ─────────────────────────────────────────────────────────────

@router.post("/scrape", response_model=ScrapingResponse)
def run_scraping(
    full_backfill: bool = Query(default=False),
    incremental: bool = Query(default=True),
    country: str = Query(default="all", description="RU, KZ, BY, UZ или all"),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    year: Optional[int] = Query(default=None),
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
    db: Session = Depends(get_db),
):
    """Запускает парсинг СП + ГОСТ + НПА."""
    is_admin = (x_user_role == "admin")
    
    if (date_from or date_to or year) and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Фильтрация по датам доступна только администратору"
        )
    
    if year:
        date_from = f"01.01.{year}"
        date_to = f"31.12.{year}"
    
    logger.info(
        f"🚀 ЗАПУСК ПАРСИНГА (full_backfill={full_backfill}, "
        f"date_from={date_from}, date_to={date_to}, admin={is_admin})"
    )
    
    log = ScrapingLog(status="running")
    db.add(log)
    db.commit()
    db.refresh(log)

    # ✅ ИНИЦИАЛИЗИРУЕМ все счётчики и списки в начале
    new_gost_ids = []
    new_sp_ids = []
    new_npa_ids = []
    updated_statuses = []
    gost_new_count = 0
    sp_new_count = 0
    npa_new_count = 0
    kz_new_count = 0  
    by_new_count = 0  
    uz_new_count = 0 

    try:
        from .scraper import (
            create_session as create_sp_session,
            fetch_notifications_list,
            fetch_notification_details_parallel,
        )
        from .gost_scraper import create_gost_session, fetch_gost_notifications

        sp_session = create_sp_session()
        gost_session = create_gost_session()
        today = datetime.now().strftime("%Y-%m-%d")

        # ── 1. ПАРСИНГ СП ──────────────────────────────────
        logger.info("🕸️ Начинаем парсинг СП (rst.gov.ru)...")
        try:
            existing_sp_ids = {
                row[0] for row in db.query(SpNotification.id).all()
            }
            logger.info(f"📋 В БД уже есть {len(existing_sp_ids)} записей СП")
            
            sp_raw = fetch_notifications_list(
                sp_session,
                date_from=date_from,
                date_to=date_to,
                existing_ids=existing_sp_ids,
            )
            logger.info(f"📥 Получено {len(sp_raw)} записей СП")
            
            if sp_raw:
                logger.info(f"⚡ Загружаем детали {len(sp_raw)} записей параллельно...")
                details = fetch_notification_details_parallel(sp_raw, sp_session)
                
                for n in sp_raw:
                    detail = details.get(n["id"], {})
                    merged = {**n, **detail}
                    
                    is_poly = is_polymer_related(merged)
                    keywords = get_matched_keywords(merged) if is_poly else []
                    
                    sp_obj = SpNotification(
                        id=n["id"],
                        country="RU", 
                        notification_type=merged.get("notification_type", ""),
                        doc_type=merged.get("doc_type", ""),
                        project_name=merged.get("project_name", ""),
                        title=merged.get("title", ""),
                        developer=merged.get("developer", ""),
                        placement_date=merged.get("placement_date", merged.get("date", "")),
                        url=merged.get("url", ""),
                        is_polymer=is_poly,
                        matched_keywords=keywords,
                        fetched_date=today,
                    )
                    
                    db.add(sp_obj)
                    try:
                        with db.begin_nested():
                            db.flush()
                        new_sp_ids.append(n["id"])
                        sp_new_count += 1
                    except IntegrityError:
                        logger.warning(f"⚠️ СП {n['id']} уже существует, пропускаем")
                        continue
            
            logger.info(f"✅ СП обработано. Новых: {sp_new_count}")
        except KeyboardInterrupt:
            logger.warning("⚠️ Парсинг СП прерван пользователем (Ctrl+C)")
            raise
        except Exception as e:
            logger.error(f"❌ Ошибка при парсинге СП: {e}", exc_info=True)

        # ── 2. ПАРСИНГ ГОСТ ────────────────────────────────
        logger.info("🕸️ Начинаем парсинг ГОСТ (fgis.gost.ru)...")
        try:
            existing_gost_ids = {
                row[0] for row in db.query(GostNotification.id).all()
            }
            logger.info(f"📋 В БД уже есть {len(existing_gost_ids)} записей ГОСТ")
            
            gost_raw = fetch_gost_notifications(gost_session, full_backfill=full_backfill)
            logger.info(f"📥 Получено {len(gost_raw)} записей ГОСТ")
            
            for n in gost_raw:
                if date_from or date_to:
                    if not is_in_date_range(n.get("start_date"), date_from, date_to):
                        continue
                
                # Проверяем, существует ли запись
                if n["id"] in existing_gost_ids:
                    # Проверяем изменение статуса
                    existing = db.query(GostNotification).filter_by(id=n["id"]).first()
                    if existing:
                        new_status = n.get("status", "")
                        if existing.status != new_status and new_status:
                            updated_statuses.append({
                                "id": n["id"],
                                "type": "gost",
                                "title": n.get("project_name", "")[:100],
                                "old_status": existing.status,
                                "new_status": new_status,
                            })
                            existing.status = new_status
                    continue

                is_poly = is_polymer_related(n)
                keywords = get_matched_keywords(n) if is_poly else []

                g_obj = GostNotification(
                    id=n["id"],
                    prns_code=n.get("prns_code", ""),
                    doc_type=n.get("doc_type", ""),
                    project_name=n.get("project_name", ""),
                    technical_committee=n.get("technical_committee", ""),
                    developer=n.get("developer", ""),
                    start_date=n.get("start_date", ""),
                    end_date=n.get("end_date", ""),
                    status=n.get("status", ""),
                    url=n.get("url", ""),
                    is_polymer=is_poly,
                    country="RU",
                    matched_keywords=keywords,
                    fetched_date=n.get("fetched_date", today),
                )
                
                # ✅ ПРОВЕРЯЕМ перед добавлением
                if db.query(GostNotification).filter_by(id=n["id"]).first():
                    logger.debug(f"ГОСТ {n['id']} уже существует, пропускаем")
                    continue
                
                db.add(g_obj)
                new_gost_ids.append(n["id"])
                gost_new_count += 1
                
                # Коммитим каждую 50-ю запись для экономии памяти
                if gost_new_count % 50 == 0:
                    db.commit()
                    logger.info(f"💾 Сохранено {gost_new_count} записей ГОСТ...")
                    # Обновляем множество существующих ID
                    existing_gost_ids = {
                        row[0] for row in db.query(GostNotification.id).all()
                    }
            
            logger.info(f"✅ ГОСТ обработано. Новых: {gost_new_count}")
        except KeyboardInterrupt:
            logger.warning("⚠️ Парсинг ГОСТ прерван пользователем (Ctrl+C)")
            raise
        except Exception as e:
            logger.error(f"❌ Ошибка при парсинге ГОСТ: {e}", exc_info=True)
            # Откатываем транзакцию при ошибке
            db.rollback()
        
        # ── 3. ПАРСИНГ НПА ─────────────────────────────────
        logger.info("🕸️ Начинаем парсинг НПА (regulation.gov.ru)...")
        try:
            from .npa_scraper import create_npa_session, fetch_npa_projects
            
            npa_session = create_npa_session()
            existing_npa_ids = {
                row[0] for row in db.query(NpaProject.id).all()
            }
            logger.info(f"📋 В БД уже есть {len(existing_npa_ids)} записей НПА")
            
            npa_raw = fetch_npa_projects(npa_session, max_pages=50)
            logger.info(f"📥 Получено {len(npa_raw)} записей НПА")
            
            for n in npa_raw:
                if n["id"] in existing_npa_ids:
                    continue
                
                is_poly = is_polymer_related(n)
                keywords = get_matched_keywords(n) if is_poly else []
                
                npa_obj = NpaProject(
                    id=n["id"],
                    country="RU",
                    title=n.get("title", ""),
                    developer=n.get("developer", ""),
                    doc_type=n.get("doc_type", ""),
                    created_date=n.get("created_date", ""),
                    published_date=n.get("published_date", ""),
                    stage=n.get("stage", ""),
                    status=n.get("status", ""),
                    procedure=n.get("procedure", ""),
                    url=n.get("url", ""),
                    is_polymer=is_poly,
                    matched_keywords=keywords,
                    fetched_date=today,
                    is_priority=is_priority_developer(n.get("developer", "")),
                )
                
                db.add(npa_obj)
                try:
                    with db.begin_nested():
                        db.flush()
                    new_npa_ids.append(n["id"])
                    npa_new_count += 1
                except IntegrityError:
                    logger.warning(f"⚠️ НПА {n['id']} уже существует, пропускаем")
                    continue
            
            logger.info(f"✅ НПА обработано. Новых: {npa_new_count}")
        except KeyboardInterrupt:
            logger.warning("⚠️ Парсинг НПА прерван пользователем (Ctrl+C)")
            raise
        except Exception as e:
            logger.error(f"❌ Ошибка при парсинге НПА: {e}", exc_info=True)
            
        # ── 4. ПАРСИНГ СТ РК (КАЗАХСТАН) ─────────────────────
        logger.info("🇰🇿 Начинаем парсинг СТ РК (Казахстан)...")
        try:
            from .kz_gost_scraper import create_kz_session, fetch_kz_gost_notifications
            
            kz_session = create_kz_session()
            existing_kz_ids = {
                row[0] for row in db.query(GostNotification.id)
                .filter(GostNotification.country == "KZ").all()
            }
            logger.info(f"📋 В БД уже есть {len(existing_kz_ids)} записей СТ РК")
            
            target_year = year or datetime.now().year
            kz_raw = fetch_kz_gost_notifications(kz_session, year=target_year, max_pages=50)
            logger.info(f"📥 Получено {len(kz_raw)} записей СТ РК")
            
            # ✅ УБИРАЕМ ДУБЛИКАТЫ внутри данных парсера
            seen_kz_ids = set()
            kz_unique = []
            for n in kz_raw:
                if n["id"] in seen_kz_ids:
                    logger.debug(f"⚠️ Дубликат СТ РК {n['id']}, пропускаем")
                    continue
                seen_kz_ids.add(n["id"])
                kz_unique.append(n)
            
            logger.info(f"📊 После удаления дубликатов: {len(kz_unique)} уникальных записей")
            
            kz_new_count = 0
            for n in kz_unique:
                # Пропускаем уже существующие в БД
                if n["id"] in existing_kz_ids:
                    continue
                
                # ✅ ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА перед добавлением
                if db.query(GostNotification).filter_by(id=n["id"]).first():
                    logger.debug(f"⚠️ СТ РК {n['id']} уже существует в БД, пропускаем")
                    existing_kz_ids.add(n["id"])
                    continue
                
                is_poly = is_polymer_related(n)
                keywords = get_matched_keywords(n) if is_poly else []
                
                kz_obj = GostNotification(
                    id=n["id"],
                    country="KZ",
                    prns_code=n.get("prns_code", ""),
                    doc_type=n.get("doc_type", "СТ РК"),
                    project_name=n.get("project_name", ""),
                    technical_committee=n.get("technical_committee", ""),
                    developer=n.get("developer", ""),
                    start_date=n.get("start_date", ""),
                    end_date=n.get("end_date"),
                    status=n.get("status", ""),
                    url=n.get("url", ""),
                    is_polymer=is_poly,
                    matched_keywords=keywords,
                    fetched_date=n.get("fetched_date", today),
                )
                
                db.add(kz_obj)
                new_gost_ids.append(n["id"])
                existing_kz_ids.add(n["id"])
                kz_new_count += 1
                gost_new_count += 1
                
                # Коммитим каждую 20-ю запись для экономии памяти
                if kz_new_count % 20 == 0:
                    try:
                        db.commit()
                        logger.info(f"💾 Сохранено {kz_new_count} записей СТ РК...")
                    except Exception as e:
                        logger.error(f"❌ Ошибка коммита СТ РК: {e}")
                        db.rollback()
                
                
            
            logger.info(f"✅ СТ РК обработано. Новых: {kz_new_count}")
        except KeyboardInterrupt:
            logger.warning("⚠️ Парсинг СТ РК прерван пользователем (Ctrl+C)")
            raise
        except Exception as e:
            logger.error(f"❌ Ошибка при парсинге СТ РК: {e}", exc_info=True)
            # ✅ ВАЖНО: откатываем транзакцию при ошибке
            try:
                db.rollback()
            except:
                pass
        
        # ── 5. ПАРСИНГ STB (БЕЛАРУСЬ) ─────────────────────
        logger.info("🇧🇾 Начинаем парсинг STB (Беларусь)...")
        try:
            from .by_gost_scraper import create_by_session, fetch_by_gost_notifications
            
            by_session = create_by_session()
            existing_by_ids = {
                row[0] for row in db.query(GostNotification.id)
                .filter(GostNotification.country == "BY").all()
            }
            logger.info(f"📋 В БД уже есть {len(existing_by_ids)} записей STB")
            
            target_year = year or datetime.now().year
            by_raw = fetch_by_gost_notifications(by_session, year=target_year, max_retries=3)
            logger.info(f"📥 Получено {len(by_raw)} записей STB")
            
            # Убираем дубликаты внутри данных парсера
            seen_by_ids = set()
            by_unique = []
            for n in by_raw:
                if n["id"] in seen_by_ids:
                    logger.debug(f"⚠️ Дубликат STB {n['id']}, пропускаем")
                    continue
                seen_by_ids.add(n["id"])
                by_unique.append(n)
            
            logger.info(f"📊 После удаления дубликатов: {len(by_unique)} уникальных записей")
            
            by_new_count = 0
            for n in by_unique:
                if n["id"] in existing_by_ids:
                    continue
                
                if db.query(GostNotification).filter_by(id=n["id"]).first():
                    logger.debug(f"⚠️ STB {n['id']} уже существует в БД, пропускаем")
                    existing_by_ids.add(n["id"])
                    continue
                
                is_poly = is_polymer_related(n)
                keywords = get_matched_keywords(n) if is_poly else []
                
                by_obj = GostNotification(
                    id=n["id"],
                    country="BY",
                    prns_code=n.get("prns_code", ""),
                    doc_type=n.get("doc_type", ""),
                    project_name=n.get("project_name", ""),
                    technical_committee=n.get("technical_committee", ""),
                    developer=n.get("developer", ""),
                    start_date=n.get("start_date", ""),
                    end_date=n.get("end_date"),
                    status=n.get("status", ""),
                    url=n.get("url", ""),
                    is_polymer=is_poly,
                    matched_keywords=keywords,
                    fetched_date=n.get("fetched_date", today),
                )
                
                db.add(by_obj)
                new_gost_ids.append(n["id"])
                existing_by_ids.add(n["id"])
                by_new_count += 1
                gost_new_count += 1
                
                if by_new_count % 20 == 0:
                    try:
                        db.commit()
                        logger.info(f"💾 Сохранено {by_new_count} записей STB...")
                    except Exception as e:
                        logger.error(f"❌ Ошибка коммита STB: {e}")
                        db.rollback()
            
            logger.info(f"✅ STB обработано. Новых: {by_new_count}")
        except KeyboardInterrupt:
            logger.warning("⚠️ Парсинг STB прерван пользователем (Ctrl+C)")
            raise
        except Exception as e:
            logger.error(f"❌ Ошибка при парсинге STB: {e}", exc_info=True)
            try:
                db.rollback()
            except:
                pass
        
        # ── 6. ПАРСИНГ UZSTI (УЗБЕКИСТАН) ─────────────────────
        logger.info("🇺🇿 Начинаем парсинг UZSTI (Узбекистан)...")
        try:
            from .uz_gost_scraper import create_uz_session, fetch_uz_gost_notifications
            
            uz_session = create_uz_session()
            existing_uz_ids = {
                row[0] for row in db.query(GostNotification.id)
                .filter(GostNotification.country == "UZ").all()
            }
            logger.info(f"📋 В БД уже есть {len(existing_uz_ids)} записей UZSTI")
            
            target_year = year or datetime.now().year
            uz_raw = fetch_uz_gost_notifications(uz_session, year=target_year)
            logger.info(f"📥 Получено {len(uz_raw)} записей UZSTI")
            
            uz_new_count = 0
            for n in uz_raw:
                if n["id"] in existing_uz_ids:
                    continue
                
                if db.query(GostNotification).filter_by(id=n["id"]).first():
                    logger.debug(f"⚠️ UZSTI {n['id']} уже существует в БД, пропускаем")
                    existing_uz_ids.add(n["id"])
                    continue
                
                is_poly = is_polymer_related(n)
                keywords = get_matched_keywords(n) if is_poly else []
                
                uz_obj = GostNotification(
                    id=n["id"],
                    country="UZ",
                    prns_code=n.get("prns_code", ""),
                    doc_type=n.get("doc_type", "O'zDSt (СТ УЗ)"),
                    project_name=n.get("project_name", ""),
                    technical_committee=n.get("technical_committee", ""),
                    developer=n.get("developer", ""),
                    start_date=n.get("start_date", ""),
                    end_date=n.get("end_date"),
                    status=n.get("status", ""),
                    url=n.get("url", ""),
                    is_polymer=is_poly,
                    matched_keywords=keywords,
                    fetched_date=n.get("fetched_date", today),
                )
                
                db.add(uz_obj)
                new_gost_ids.append(n["id"])
                existing_uz_ids.add(n["id"])
                uz_new_count += 1
                gost_new_count += 1
                
                if uz_new_count % 20 == 0:
                    try:
                        db.commit()
                        logger.info(f"💾 Сохранено {uz_new_count} записей UZSTI...")
                    except Exception as e:
                        logger.error(f"❌ Ошибка коммита UZSTI: {e}")
                        db.rollback()
            
            logger.info(f"✅ UZSTI обработано. Новых: {uz_new_count}")
        except KeyboardInterrupt:
            logger.warning("⚠️ Парсинг UZSTI прерван пользователем (Ctrl+C)")
            raise
        except Exception as e:
            logger.error(f"❌ Ошибка при парсинге UZSTI: {e}", exc_info=True)
            try:
                db.rollback()
            except:
                pass
            
        db.commit()

        log.status = "success"
        log.gost_new = gost_new_count
        log.sp_new = sp_new_count
        log.new_gost_ids = new_gost_ids
        log.new_sp_ids = new_sp_ids
        log.new_npa_ids = new_npa_ids 
        log.npa_new = npa_new_count    
        log.updated_statuses = updated_statuses
        log.finished_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(
            f"🎉 Скрапинг завершён: "
            f"ГОСТ +{gost_new_count} (RU, KZ: {kz_new_count}, BY: {by_new_count}, UZ: {uz_new_count}), "
            f"СП +{sp_new_count}, НПА +{npa_new_count}"
        )
        return ScrapingResponse(
            status="success",
            gost_new=gost_new_count,
            sp_new=sp_new_count,
            npa_new=npa_new_count,
            message=f"Готово! Добавлено: {gost_new_count} ГОСТ, {sp_new_count} СП, {npa_new_count} НПА",
            new_gost_ids=new_gost_ids,
            new_sp_ids=new_sp_ids,
            new_npa_ids=new_npa_ids,
            updated_statuses=updated_statuses,
        )

    except KeyboardInterrupt:
        logger.warning("🛑 Скрапинг принудительно остановлен пользователем")
        db.rollback()
        log.status = "cancelled"
        log.finished_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(status_code=499, detail="Парсинг отменен пользователем")
        
    except Exception as e:
        logger.exception("💥 Глобальная ошибка скрапинга")
        db.rollback()
        log.status = "error"
        log.error_message = str(e)[:500]
        log.finished_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Ошибка скрапинга: {e}")

@router.get("/npa", response_model=List[NpaProjectOut])
def list_npa(
    year: Optional[int] = None,
    status: Optional[str] = None,
    developer: Optional[str] = None,
    is_polymer: Optional[bool] = None,
    limit: int = Query(default=500, le=5000),
    db: Session = Depends(get_db),
    is_priority: Optional[bool] = None,
):
    q = db.query(NpaProject)
    if year:
        all_items = q.all()
        all_items = [n for n in all_items if _extract_year(n.published_date) == year]
        if is_priority is not None:
            all_items = [n for n in all_items if n.is_priority == is_priority]
        if is_polymer is not None:
            all_items = [n for n in all_items if n.is_polymer == is_polymer]
        return all_items[:limit]
    if status:
        q = q.filter(NpaProject.status == status)
    if developer:
        q = q.filter(NpaProject.developer.ilike(f"%{developer}%"))
    if is_polymer is not None:
        q = q.filter(NpaProject.is_polymer == is_polymer)
    if is_priority is not None:
        q = q.filter(NpaProject.is_priority == is_priority)
    return q.order_by(NpaProject.created_at.desc()).limit(limit).all()

@router.get("/approved-discussions", response_model=List[GostNotificationOut])
def get_approved_discussions(
    year: Optional[int] = None,
    tk: Optional[str] = None,
    is_polymer: Optional[bool] = None,
    limit: int = Query(default=500, le=5000),
    db: Session = Depends(get_db),
):
    """Получить завершенные публичные обсуждения (статус: Публичное обсуждение завершено)."""
    
    # Завершенные = ГОСТы со статусом "Публичное обсуждение завершено"
    q = db.query(GostNotification).filter(
        GostNotification.status == "Публичное обсуждение завершено"
    )
    
    if year:
        all_items = q.all()
        # Фильтруем по году завершения (completed_date)
        filtered = [
            g for g in all_items 
            if _extract_year(g.end_date) == year
        ]
        return filtered[:limit]
    
    if tk:
        q = q.filter(GostNotification.technical_committee.ilike(f"%{tk}%"))
    if is_polymer is not None:
        q = q.filter(GostNotification.is_polymer == is_polymer)
    
    # Сортируем по дате завершения (убывание)
    return q.order_by(GostNotification.end_date.desc()).limit(limit).all()