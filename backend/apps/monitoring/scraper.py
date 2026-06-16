"""Парсер уведомлений о сводах правил (rst.gov.ru)."""
from __future__ import annotations
import re, time, logging, base64, random
from typing import Optional, Set
from datetime import datetime
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

from .config import SP_BASE_URL, SP_COMPONENT_ID

logger = logging.getLogger(__name__)
SITE_ORIGIN = "https://www.rst.gov.ru"

SESSION_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
}

MAX_PAGES = 50
MAX_DETAIL_WORKERS = 8


def create_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(SESSION_HEADERS)
    return s


# ─────────────────────────────────────────────────────────────
# УТИЛИТЫ ПАРСИНГА ДАТ
# ─────────────────────────────────────────────────────────────

def parse_date(date_str: Optional[str]) -> Optional[datetime]:
    """Парсит дату в форматах DD.MM.YYYY, DD.MM.YY, YYYY-MM-DD."""
    if not date_str:
        return None
    s = str(date_str).strip()
    for fmt in ["%d.%m.%Y", "%d.%m.%y", "%Y-%m-%d"]:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def is_in_date_range(
    date_str: Optional[str],
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> bool:
    """Проверяет, попадает ли дата в заданный диапазон."""
    if not date_from and not date_to:
        return True
    dt = parse_date(date_str)
    if not dt:
        return True
    if date_from:
        from_dt = parse_date(date_from)
        if from_dt and dt < from_dt:
            return False
    if date_to:
        to_dt = parse_date(date_to)
        if to_dt and dt > to_dt:
            return False
    return True


# ─────────────────────────────────────────────────────────────
# ПАРСИНГ СПИСКА
# ─────────────────────────────────────────────────────────────

def _extract_notification_id(url: str) -> Optional[str]:
    match = re.search(r"navigationalstate=([^&]+)", url)
    if not match:
        return None
    nav_state = match.group(1)
    try:
        decoded = base64.b64decode(nav_state.replace("JBPNS_", "")).decode("latin-1")
        id_match = re.search(r"id.{1,10}?(\d{3,})", decoded)
        if id_match:
            return id_match.group(1).strip()
    except Exception:
        pass
    id_match = re.search(r"(%20|%C2%A0|\s)(\d{3,})", nav_state)
    if id_match:
        return id_match.group(2)
    return nav_state[:20]


def _build_page_state(page_num: int) -> str:
    state_data = (
        f"\x00\x06length\x00\x00\x00\x01\x00\x0210"
        f"\x00\x04page\x00\x00\x00\x01\x00\x01{page_num}"
        f"\x00\x05state\x00\x00\x00\x01\x00\x06ACTUAL"
        f"\x00\x07__EOF__"
    )
    encoded = base64.b64encode(state_data.encode("latin-1")).decode()
    return f"JBPNS_{encoded}"


def _parse_list_page(html: str) -> list:
    """Парсит HTML списка уведомлений."""
    soup = BeautifulSoup(html, "html.parser")
    notifications = []

    links = soup.find_all("a", href=re.compile(r"navigationalstate=.*notification"))
    if not links:
        links = soup.find_all("a", href=re.compile(r"navigationalstate="))

    skip_phrases = [
        "версия для слабовидящих", "назад", "вперед", "архив",
        "сбросить фильтр", "поиск", "войти", "регистрация",
    ]
    
    for link in links:
        href = link.get("href", "")
        title = link.get_text(strip=True)
        if not title or len(title) < 15:
            continue
        if any(p in title.lower() for p in skip_phrases):
            continue
        
        nid = _extract_notification_id(href)
        if not nid or not nid.isdigit():
            continue
        
        stable_url = f"{SP_BASE_URL}#search:{nid}"
        internal_url = urljoin(SITE_ORIGIN, href) if not href.startswith("http") else href
        
        date_text = ""
        parent = link.find_parent(["tr", "div", "li"])
        if parent:
            dm = re.search(r"\d{2}\.\d{2}\.\d{2,4}", parent.get_text())
            if dm:
                date_text = dm.group(0)
        
        notifications.append({
            "id": nid,
            "title": title,
            "url": stable_url,
            "_internal_url": internal_url,
            "date": date_text,
        })
    return notifications


# ─────────────────────────────────────────────────────────────
# ЗАГРУЗКА ДЕТАЛЕЙ
# ─────────────────────────────────────────────────────────────

def fetch_notification_detail(
    url: str,
    session: Optional[requests.Session] = None,
    internal_url: Optional[str] = None,
) -> dict:
    """Получает детали одного уведомления."""
    if session is None:
        session = create_session()
    
    fetch_url = internal_url or url
    try:
        resp = session.get(fetch_url, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.error(f"СП: ошибка/таймаут загрузки {fetch_url}: {e}")
        return {}
    return _parse_detail_page(resp.text, url)


def fetch_notification_details_parallel(
    notifications: list,
    session: requests.Session,
    max_workers: int = MAX_DETAIL_WORKERS,
) -> dict:
    """Параллельно загружает детали для списка уведомлений."""
    results = {}
    
    def fetch_one(n):
        try:
            detail = fetch_notification_detail(
                n["url"], session, internal_url=n.get("_internal_url")
            )
            return n["id"], detail
        except Exception as e:
            logger.error(f"Ошибка загрузки деталей {n['id']}: {e}")
            return n["id"], {}
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(fetch_one, n): n for n in notifications}
        try:
            for future in as_completed(futures):
                nid, detail = future.result()
                results[nid] = detail
        except KeyboardInterrupt:
            logger.warning("⚠️ Получен сигнал прерывания, остановка загрузки деталей...")
            executor.shutdown(wait=False, cancel_futures=True)
            raise
    
    return results


# ─────────────────────────────────────────────────────────────
# ГЛАВНАЯ ФУНКЦИЯ ЗАГРУЗКИ СП
# ─────────────────────────────────────────────────────────────

def fetch_notifications_list(
    session: Optional[requests.Session] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    existing_ids: Optional[Set[str]] = None,
) -> list:
    """Загружает СП с фильтрацией по датам."""
    if session is None:
        session = create_session()
    if existing_ids is None:
        existing_ids = set()
    
    all_notifications = []
    page_num = 0
    pages_without_new = 0
    all_seen_ids: Set[str] = set()  # Все ID, которые мы уже видели в этой сессии
    
    while page_num < MAX_PAGES:
        logger.info(f"СП: загрузка страницы {page_num + 1}/{MAX_PAGES}...")
        
        try:
            if page_num == 0:
                resp = session.get(SP_BASE_URL, timeout=15)
            else:
                resp = session.get(
                    SP_BASE_URL,
                    params={
                        "portal:isSecure": "true",
                        "portal:componentId": SP_COMPONENT_ID,
                        "interactionstate": _build_page_state(page_num),
                        "portal:type": "action",
                    },
                    timeout=15,
                )
            resp.raise_for_status()
        except requests.RequestException as e:
            logger.error(f"СП: ошибка загрузки страницы {page_num + 1}: {e}")
            break
        except KeyboardInterrupt:
            logger.warning("⚠️ Прерывание парсинга пользователем (Ctrl+C)")
            raise
        
        notifications = _parse_list_page(resp.text)
        
        if not notifications:
            logger.info(f"СП: страница {page_num + 1} пуста, остановка")
            break
        
        # Фильтрация: пропускаем дубликаты и уже существующие в БД
        page_new_count = 0
        for n in notifications:
            # Пропускаем если уже видели в этой сессии
            if n["id"] in all_seen_ids:
                continue
            all_seen_ids.add(n["id"])
            
            # Пропускаем если уже есть в БД
            if n["id"] in existing_ids:
                continue
            
            # Проверяем диапазон дат
            if not is_in_date_range(n.get("date"), date_from, date_to):
                continue
            
            all_notifications.append(n)
            page_new_count += 1
        
        logger.info(
            f"СП: страница {page_num + 1}: "
            f"{len(notifications)} записей, "
            f"{page_new_count} новых"
        )
        
        if page_new_count == 0:
            pages_without_new += 1
            if pages_without_new >= 3:
                logger.info(f"СП: 3 страницы подряд без новых записей, остановка")
                break
        else:
            pages_without_new = 0
        
        page_num += 1
        time.sleep(random.uniform(0.3, 0.8))
    
    logger.info(f"✅ СП: всего загружено {len(all_notifications)} записей с {page_num} страниц")
    return all_notifications


# ─────────────────────────────────────────────────────────────
# ПАРСИНГ ДЕТАЛЬНОЙ СТРАНИЦЫ
# ─────────────────────────────────────────────────────────────

def _parse_detail_page(html: str, url: str) -> dict:
    """Парсит страницу детали уведомления."""
    detail = {
        "notification_type": "", "doc_type": "", "project_name": "",
        "developer": "", "placement_date": "", "url": url,
    }
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text()

    if "завершении публичного обсуждения" in text:
        detail["notification_type"] = "о завершении публичного обсуждения проекта"
    elif "разработке проекта" in text:
        detail["notification_type"] = "о разработке проекта"

    dev_match = re.search(
        r"(?:разработчик[аи]?\s*:?\s*)(Министерство[^.;,\n]{10,200}|"
        r"Федеральн[а-я]+\s+служб[а-я]+[^.;,\n]{10,200}|"
        r"Госкорпорац[а-я]+[^.;,\n]{10,100})",
        text, re.IGNORECASE,
    )
    if dev_match:
        detail["developer"] = dev_match.group(1).strip()

    name_matches = re.findall(r"«([^»]{20,})»", text)
    if name_matches:
        detail["project_name"] = max(name_matches, key=len).strip()

    date_match = re.search(r"\d{2}\.\d{2}\.\d{2,4}", text)
    if date_match:
        detail["placement_date"] = date_match.group(0)

    return detail