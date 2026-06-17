"""Планировщик автообновления данных Росстандарта."""
import logging
from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from .database import SessionLocal, GostNotification, SpNotification, ScrapingLog
from .scraper import (
    create_session as create_sp_session,
    fetch_notifications_list,
    fetch_notification_details_parallel,
    is_in_date_range,
)
from .gost_scraper import create_gost_session, fetch_gost_notifications
from .polymer_filter import is_polymer_related, get_matched_keywords

logger = logging.getLogger(__name__)


def run_daily_scraping():
    """Ежедневный парсинг (9:00 MSK). Парсит только текущий год."""
    current_year = datetime.now().year
    date_from = f"01.01.{current_year}"
    date_to = f"31.12.{current_year}"
    
    logger.info(f"⏰ [SCHEDULER] Запуск ежедневного парсинга за {current_year} год")
    
    db = SessionLocal()
    try:
        log = ScrapingLog(status="running")
        db.add(log)
        db.commit()
        db.refresh(log)

        sp_session = create_sp_session()
        gost_session = create_gost_session()
        today = datetime.now().strftime("%Y-%m-%d")
        sp_new_count = 0
        gost_new_count = 0
        new_sp_ids = []
        new_gost_ids = []
        updated_statuses = []

        # ── СП ─────────────────────────────────────────────
        try:
            existing_sp_ids = {row[0] for row in db.query(SpNotification.id).all()}
            sp_raw = fetch_notifications_list(
                sp_session,
                date_from=date_from,
                date_to=date_to,
                existing_ids=existing_sp_ids,
            )
            
            if sp_raw:
                details = fetch_notification_details_parallel(sp_raw, sp_session)
                for n in sp_raw:
                    detail = details.get(n["id"], {})
                    merged = {**n, **detail}
                    is_poly = is_polymer_related(merged)
                    keywords = get_matched_keywords(merged) if is_poly else []
                    db.add(SpNotification(
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
                    ))
                    new_sp_ids.append(n["id"])
                    sp_new_count += 1
        except Exception as e:
            logger.error(f"Ошибка парсинга СП: {e}", exc_info=True)

        # ── ГОСТ ───────────────────────────────────────────
        try:
            existing_gost_ids = {row[0] for row in db.query(GostNotification.id).all()}
            gost_raw = fetch_gost_notifications(gost_session, full_backfill=True)
            
            for n in gost_raw:
                if not is_in_date_range(n.get("start_date"), date_from, date_to):
                    continue
                
                if n["id"] in existing_gost_ids:
                    existing = db.query(GostNotification).filter_by(id=n["id"]).first()
                    if existing:
                        new_status = n.get("status", "")
                        if existing.status != new_status and new_status:
                            updated_statuses.append({
                                "id": n["id"], "type": "gost",
                                "title": n.get("project_name", "")[:100],
                                "old_status": existing.status, "new_status": new_status,
                            })
                            existing.status = new_status
                    continue

                is_poly = is_polymer_related(n)
                keywords = get_matched_keywords(n) if is_poly else []
                db.add(GostNotification(
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
                ))
                new_gost_ids.append(n["id"])
                gost_new_count += 1
        except Exception as e:
            logger.error(f"Ошибка парсинга ГОСТ: {e}", exc_info=True)

        db.commit()
        log.status = "success"
        log.gost_new = gost_new_count
        log.sp_new = sp_new_count
        log.new_gost_ids = new_gost_ids
        log.new_sp_ids = new_sp_ids
        log.updated_statuses = updated_statuses
        log.finished_at = datetime.now(timezone.utc)
        db.commit()
        logger.info(f"⏰ [SCHEDULER] Готово: +{gost_new_count} ГОСТ, +{sp_new_count} СП")
    except Exception as e:
        logger.exception("⏰ [SCHEDULER] Глобальная ошибка")
        db.rollback()
    finally:
        db.close()


scheduler = BackgroundScheduler(timezone="Europe/Moscow")


def start_scheduler():
    scheduler.add_job(
        run_daily_scraping,
        CronTrigger(hour=13, minute=30, timezone="Europe/Moscow"),
        id="daily_monitoring_scraping",
        name="Ежедневный парсинг Росстандарта (13:30 MSK)",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("⏰ Планировщик запущен. Парсинг ежедневно в 13:30 MSK (только текущий год)")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)