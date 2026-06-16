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
    TechnicalCommittee, ScrapingLog,
)
from .schemas import (
    GostNotificationOut, SpNotificationOut,
    TechnicalCommitteeOut, TechnicalCommitteeCreate,
    DashboardResponse, DashboardStats, ScrapingResponse, ScrapingLogOut,
)
from .polymer_filter import is_polymer_related, get_matched_keywords
from .scraper import is_in_date_range

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


# ─────────────────────────────────────────────────────────────
# DASHBOARD DATA
# ─────────────────────────────────────────────────────────────

def _get_current_year() -> int:
    return datetime.now().year


def _extract_year(date_str: Optional[str]) -> Optional[int]:
    if not date_str:
        return None
    s = str(date_str).strip()
    if "." in s:
        parts = s.split(".")
        if len(parts) == 3:
            try:
                return int(parts[2]) if len(parts[2]) == 4 else int("20" + parts[2])
            except ValueError:
                return None
    elif "-" in s:
        try:
            return int(s.split("-")[0])
        except ValueError:
            return None
    return None


def _compute_stats(
    gost_list: List[GostNotification],
    sp_list: List[SpNotification],
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
def get_dashboard(year: Optional[int] = None, db: Session = Depends(get_db)):
    """Полные данные для дашборда."""
    from .config import OUR_TECHNICAL_COMMITTEES
    
    target_year = year or _get_current_year()

    all_gost = db.query(GostNotification).all()
    gost = [g for g in all_gost if _extract_year(g.start_date) == target_year]

    all_sp = db.query(SpNotification).all()
    sp = [s for s in all_sp if _extract_year(s.placement_date) == target_year]

    stats = _compute_stats(gost, sp)

    # ← ИСПОЛЬЗУЕМ СПИСОК ИЗ КОНФИГА
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
        stats=stats,
        my_tks=my_tks,  # ← Просто возвращаем список из конфига
        last_updated=last_updated,
        current_year=target_year,
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
    full_backfill: bool = Query(default=True),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    year: Optional[int] = Query(default=None),
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
    db: Session = Depends(get_db),
):
    """Запускает парсинг СП + ГОСТ."""
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

    new_gost_ids = []
    new_sp_ids = []
    updated_statuses = []

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
        sp_new_count = 0
        gost_new_count = 0

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
                    
                    # Используем savepoint для безопасной вставки
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
                    matched_keywords=keywords,
                    fetched_date=n.get("fetched_date", today),
                )
                
                # ✅ ИСПОЛЬЗУЕМ SAVEPOINT для безопасной вставки
                db.add(g_obj)
                try:
                    with db.begin_nested():  # ← savepoint
                        db.flush()
                    new_gost_ids.append(n["id"])
                    gost_new_count += 1
                except IntegrityError:
                    logger.warning(f"⚠️ ГОСТ {n['id']} уже существует, пропускаем")
                    continue
            
            logger.info(f"✅ ГОСТ обработано. Новых: {gost_new_count}")
        except KeyboardInterrupt:
            logger.warning("⚠️ Парсинг ГОСТ прерван пользователем (Ctrl+C)")
            raise
        except Exception as e:
            logger.error(f"❌ Ошибка при парсинге ГОСТ: {e}", exc_info=True)

        db.commit()

        log.status = "success"
        log.gost_new = gost_new_count
        log.sp_new = sp_new_count
        log.new_gost_ids = new_gost_ids
        log.new_sp_ids = new_sp_ids
        log.updated_statuses = updated_statuses
        log.finished_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(f"🎉 Скрапинг завершён: ГОСТ +{gost_new_count}, СП +{sp_new_count}")
        return ScrapingResponse(
            status="success",
            gost_new=gost_new_count,
            sp_new=sp_new_count,
            message=f"Готово! Добавлено: {gost_new_count} ГОСТ, {sp_new_count} СП",
            new_gost_ids=new_gost_ids,
            new_sp_ids=new_sp_ids,
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