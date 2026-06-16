"""Парсер уведомлений о ГОСТах (fgis.gost.ru) — с обходом 403."""
from __future__ import annotations
import re, html, time, logging, random
from typing import Optional
from datetime import datetime

import requests
import urllib3.util.connection

from .config import (
    GOST_API_URL, GOST_API_IPS, GOST_DETAIL_URL,
    GOST_STATUS_FILTER, GOST_PAGES_FROM_END, ALL_GOST_STATUSES,
)

logger = logging.getLogger(__name__)

# ── DNS-патч ─────────────────────────────────────────────────
_original_create_connection = urllib3.util.connection.create_connection
_active_ip_index = 0


def _patched_create_connection(address, *args, **kwargs):
    host, port = address
    if host == "fgis.gost.ru":
        # Защита от выхода за пределы массива
        if _active_ip_index >= len(GOST_API_IPS):
            logger.warning(f"Все IP исчерпаны, используем последний: {GOST_API_IPS[-1]}")
            host = GOST_API_IPS[-1]
        else:
            host = GOST_API_IPS[_active_ip_index]
    return _original_create_connection((host, port), *args, **kwargs)


def _switch_to_next_ip() -> bool:
    global _active_ip_index
    if _active_ip_index < len(GOST_API_IPS) - 1:
        _active_ip_index += 1
        logger.warning(f"Переключение на IP: {GOST_API_IPS[_active_ip_index]}")
        return True
    else:
        logger.error("Все IP-адреса исчерпаны")
        return False


urllib3.util.connection.create_connection = _patched_create_connection

# ── Реалистичные заголовки ───────────────────────────────────
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://fgis.gost.ru/",
    "Origin": "https://fgis.gost.ru",
    "Connection": "keep-alive",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Ch-Ua": '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="8"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
}

_EMPTY_FILTERS = {
    "submittedPublicDiscussionDate": "",
    "submittedPublicDiscussionDateEnd": "",
    "publicDiscussionCompletedDate": "",
    "publicDiscussionCompletedDateEnd": "",
    "prns": "", "draftSt": "", "flUl": "", "tk": "",
    "programSubsection": "", "documentType": "",
}


def create_gost_session() -> requests.Session:
    """Создаёт сессию с реалистичными заголовками."""
    s = requests.Session()
    s.headers.update(BROWSER_HEADERS)
    return s


def _extract_uuid(prns_html: str) -> Optional[str]:
    m = re.search(r"uuid=([a-f0-9\-]{36})", prns_html)
    return m.group(1) if m else None


def _extract_prns_code(prns_html: str) -> str:
    m = re.search(r">([^<]+)<", prns_html)
    return m.group(1).strip() if m else ""


def _parse_api_row(row: dict) -> Optional[dict]:
    prns_html = row.get("@rsprsPrns:prns", "")
    uuid = _extract_uuid(prns_html)
    if not uuid:
        return None
    return {
        "id": uuid,
        "prns_code": _extract_prns_code(prns_html),
        "program": html.unescape(row.get("@rsprs-nds:subProgram", "")),
        "doc_type": html.unescape(row.get("@rsprs-nds:gostR", "")),
        "project_name": html.unescape(row.get("@rsprsPrns:draftSt", "")),
        "technical_committee": html.unescape(row.get("@rsprsPrns:tk", "")),
        "developer": html.unescape(row.get("@rsprsDeveloper:flUl", "")),
        "start_date": row.get("@rsprs-nds:submitted-public-discussion-date", ""),
        "end_date": row.get("@rsprs-nds:public-discussion-completed-date", ""),
        "status": row.get("@lecm-statemachine:status", ""),
        "url": GOST_DETAIL_URL.format(uuid=uuid),
    }


def _fetch_with_retry(
    session: requests.Session,
    url: str,
    params: dict,
    max_retries: int = 3,
) -> Optional[dict]:
    """Делает запрос с retry и переключением IP при 403."""
    global _active_ip_index
    
    for attempt in range(max_retries):
        try:
            if attempt > 0:
                delay = 2 + random.uniform(0.5, 2.0)
                logger.info(f"  ⏳ Retry {attempt}/{max_retries}, ждём {delay:.1f}с...")
                time.sleep(delay)
            
            resp = session.get(url, params=params, timeout=15)
            
            if resp.status_code == 403:
                logger.warning(f"  ⚠️ 403 Forbidden (IP: {GOST_API_IPS[_active_ip_index]})")
                if _switch_to_next_ip():
                    # Создаём новую сессию с новым IP
                    session.close()
                    session = create_gost_session()
                    continue
                else:
                    logger.error("  ❌ Все IP недоступны")
                    return None
            
            resp.raise_for_status()
            return resp.json()
            
        except (requests.RequestException, ValueError) as e:
            logger.error(f"  ❌ Ошибка запроса (попытка {attempt+1}): {e}")
            if attempt == max_retries - 1:
                return None
    
    return None


def fetch_gost_notifications(
    session: Optional[requests.Session] = None,
    full_backfill: bool = True,
) -> list:
    """Загружает уведомления ГОСТ с обходом 403."""
    if session is None:
        session = create_gost_session()
    
    # Сбрасываем индекс IP при каждом запуске
    global _active_ip_index
    _active_ip_index = 0
    
    if full_backfill:
        return _fetch_full_backfill(session)
    return _fetch_recent(session)


def _fetch_recent(session: requests.Session) -> list:
    """Загружает только последние страницы."""
    data = _fetch_with_retry(
        session, GOST_API_URL,
        params={**_EMPTY_FILTERS, "statusDocumentNDS": GOST_STATUS_FILTER,
                "page": 1, "rows": 20}
    )
    if not data:
        return []

    total_pages = int(str(data.get("total", "0")).replace(" ", "").replace("\xa0", ""))
    if total_pages == 0:
        return []

    all_notifications = []
    for page_num in range(max(1, total_pages - GOST_PAGES_FROM_END + 1), total_pages + 1):
        logger.info(f"ГОСТ: загрузка страницы {page_num}/{total_pages}...")
        data = _fetch_with_retry(
            session, GOST_API_URL,
            params={**_EMPTY_FILTERS, "statusDocumentNDS": GOST_STATUS_FILTER,
                    "page": page_num, "rows": 20}
        )
        if not data:
            continue
        for row in data.get("rows", []):
            n = _parse_api_row(row)
            if n:
                all_notifications.append(n)
        time.sleep(random.uniform(0.3, 1.0))
    
    return all_notifications


def _fetch_full_backfill(session: requests.Session) -> list:
    """Полная загрузка за текущий год по всем статусам."""
    all_records = []
    today = datetime.now().strftime("%Y-%m-%d")
    date_from = f"{datetime.now().year}-01-01"

    for status in ALL_GOST_STATUSES:
        logger.info(f"ГОСТ: статус «{status}»...")
        
        params = {
            **_EMPTY_FILTERS,
            "submittedPublicDiscussionDate": date_from,
            "statusDocumentNDS": status,
            "page": 1, "rows": 20,
        }
        
        data = _fetch_with_retry(session, GOST_API_URL, params)
        if not data:
            logger.warning(f"  ⚠️ Не удалось получить данные для статуса «{status}»")
            continue

        total_pages = int(str(data.get("total", "0")).replace(" ", "").replace("\xa0", ""))
        total_records = data.get("records", "0")
        logger.info(f"  📊 Найдено: {total_records} записей на {total_pages} стр.")
        
        if total_pages == 0:
            continue

        for row in data.get("rows", []):
            n = _parse_api_row(row)
            if n:
                n["fetched_date"] = today
                n["source"] = "gost"
                all_records.append(n)

        for page_num in range(2, total_pages + 1):
            if page_num % 10 == 0 or page_num == total_pages:
                logger.info(f"  📄 Страница {page_num}/{total_pages}...")
            
            params["page"] = page_num
            data = _fetch_with_retry(session, GOST_API_URL, params)
            if not data:
                continue
            
            for row in data.get("rows", []):
                n = _parse_api_row(row)
                if n:
                    n["fetched_date"] = today
                    n["source"] = "gost"
                    all_records.append(n)
            
            time.sleep(random.uniform(0.5, 1.5))

    logger.info(f"✅ ГОСТ: загружено {len(all_records)} записей (full backfill)")
    return all_records