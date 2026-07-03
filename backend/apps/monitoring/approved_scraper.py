"""Парсер завершенных публичных обсуждений (rst.gov.ru)."""
from __future__ import annotations
import re
import logging
import time
from typing import Optional, List
from datetime import datetime

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

APPROVED_BASE_URL = "https://www.rst.gov.ru/portal/gost/home/activity/standardization/notification/public_discussion_complete"

SESSION_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
}


def create_approved_session() -> requests.Session:
    """Создаёт сессию для парсинга завершенных обсуждений."""
    s = requests.Session()
    s.headers.update(SESSION_HEADERS)
    return s


def fetch_approved_discussions(
    session: Optional[requests.Session] = None,
    year: int = 2026,
    max_pages: int = 50,
) -> List[dict]:
    """Загружает завершенные публичные обсуждения за указанный год."""
    if session is None:
        session = create_approved_session()
    
    all_discussions = []
    page_num = 0
    
    while page_num < max_pages:
        logger.info(f"Завершенные: загрузка страницы {page_num + 1}/{max_pages}...")
        
        try:
            if page_num == 0:
                resp = session.get(APPROVED_BASE_URL, timeout=15)
            else:
                # Для пагинации нужно определить механизм сайта
                # Пока просто проверяем первую страницу
                break
            
            resp.raise_for_status()
        except requests.RequestException as e:
            logger.error(f"Завершенные: ошибка загрузки страницы {page_num + 1}: {e}")
            break
        
        discussions = _parse_approved_page(resp.text, year)
        
        if not discussions:
            logger.info(f"Завершенные: страница {page_num + 1} пуста, остановка")
            break
        
        all_discussions.extend(discussions)
        logger.info(f"Завершенные: страница {page_num + 1}: {len(discussions)} записей за {year} год")
        
        page_num += 1
        time.sleep(1)
    
    logger.info(f"✅ Завершенные: всего загружено {len(all_discussions)} записей")
    return all_discussions


def _parse_approved_page(html: str, year: int) -> List[dict]:
    """Парсит HTML страницу с завершенными обсуждениями."""
    soup = BeautifulSoup(html, "html.parser")
    discussions = []
    
    # Ищем таблицу с данными
    table = soup.find("table", class_=re.compile(r"ui-jqgrid-btable"))
    if not table:
        return []
    
    # Находим все строки с данными
    rows = table.find_all("tr", class_="jqgrow")
    
    for row in rows:
        try:
            cells = row.find_all("td", role="gridcell")
            if len(cells) < 8:
                continue
            
            # Извлекаем данные из ячеек
            prns_cell = cells[0].find("a")
            prns = prns_cell.get_text(strip=True) if prns_cell else ""
            prns_link = prns_cell.get("href", "") if prns_cell else ""
            
            sub_program = cells[1].get_text(strip=True)
            doc_type = cells[2].get_text(strip=True)
            project_name = cells[3].get_text(strip=True)
            tk = cells[4].get_text(strip=True)
            developer = cells[5].get_text(strip=True)
            submitted_date = cells[6].get_text(strip=True)
            completed_date = cells[7].get_text(strip=True)
            
            # Проверяем год
            if completed_date:
                completed_year = _extract_year_from_date(completed_date)
                if completed_year != year:
                    continue
            
            # Извлекаем UUID из ссылки
            uuid = ""
            if prns_link:
                uuid_match = re.search(r"uuid=([a-f0-9-]+)", prns_link)
                if uuid_match:
                    uuid = uuid_match.group(1)
            
            discussions.append({
                "prns": prns,
                "uuid": uuid,
                "sub_program": sub_program,
                "doc_type": doc_type,
                "project_name": project_name,
                "tk": tk,
                "developer": developer,
                "submitted_date": submitted_date,
                "completed_date": completed_date,
                "url": f"https://www.rst.gov.ru{prns_link}" if prns_link else "",
            })
        except Exception as e:
            logger.debug(f"Ошибка парсинга строки: {e}")
            continue
    
    return discussions


def _extract_year_from_date(date_str: str) -> Optional[int]:
    """Извлекает год из даты в формате DD.MM.YYYY."""
    if not date_str:
        return None
    try:
        parts = date_str.split(".")
        if len(parts) == 3:
            return int(parts[2])
    except:
        pass
    return None