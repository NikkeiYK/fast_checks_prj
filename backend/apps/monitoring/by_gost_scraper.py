"""Парсер стандартов Беларуси (STB) с сайта stb.by."""
from __future__ import annotations
import re
import logging
import time
from typing import Optional, List
from datetime import datetime

import requests
import urllib3
from bs4 import BeautifulSoup

# Отключаем предупреждения о небезопасных SSL-запросах
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

BY_BASE_URL = "https://stb.by/pgs"

SESSION_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "Referer": "https://stb.by/",
}

# Маппинг стадий белорусских стандартов на наши статусы
STAGE_TO_STATUS = {
    "Разработка": "Вынесен на публичное обсуждение",
    "Общественное обсуждение": "Вынесен на публичное обсуждение",
    "Публичное обсуждение": "Вынесен на публичное обсуждение",
    "Техническое редактирование": "Направлено уведомление о завершении публичного обсуждения",
    "Согласование": "Направлено уведомление о завершении публичного обсуждения",
    "Утверждение": "Публичное обсуждение завершено",
    "Введен в действие": "Публичное обсуждение завершено",
    "Отменен": "Публичное обсуждение завершено",
}


def create_by_session() -> requests.Session:
    """Создаёт сессию для парсинга Белорусских стандартов."""
    s = requests.Session()
    s.headers.update(SESSION_HEADERS)
    s.verify = False  # Отключаем проверку SSL для stb.by
    return s


def fetch_by_gost_notifications(
    session: Optional[requests.Session] = None,
    year: int = 2026,
    max_retries: int = 3,
) -> List[dict]:
    """Загружает стандарты Беларуси (STB) за указанный год."""
    if session is None:
        session = create_by_session()
    
    logger.info(f"🇧🇾 Начинаем парсинг STB (Беларусь) за {year} год...")
    
    params = {
        "field": 1,  # Шифр плана
        "query": str(year),
    }
    
    # Загружаем страницу с ретраями
    html = None
    for attempt in range(max_retries):
        try:
            resp = session.get(BY_BASE_URL, params=params, timeout=30)
            resp.raise_for_status()
            html = resp.text
            break
        except requests.RequestException as e:
            logger.warning(f"STB: попытка {attempt + 1}/{max_retries} не удалась: {e}")
            if attempt < max_retries - 1:
                time.sleep(3 * (attempt + 1))
    
    if html is None:
        logger.error("STB: не удалось загрузить страницу")
        return []
    
    # Парсим таблицу
    standards = _parse_by_page(html, year)
    
    logger.info(f"✅ STB: всего загружено {len(standards)} стандартов за {year} год")
    return standards


def _parse_by_page(html: str, target_year: int) -> List[dict]:
    """Парсит HTML страницу со стандартами Беларуси."""
    soup = BeautifulSoup(html, "lxml")
    standards = []
    
    # Находим таблицу со стандартами
    table = soup.select_one("table.develop-table")
    if not table:
        logger.warning("STB: таблица develop-table не найдена на странице")
        return []
    
    rows = table.select("tbody tr")
    logger.info(f"STB: найдено {len(rows)} строк в таблице")
    
    for row in rows:
        try:
            cells = row.select("td")
            
            if len(cells) < 7:
                continue
            
            # Ячейка 0: Стадия
            stage = cells[0].get_text(strip=True)
            
            # Ячейка 1: Шифр плана
            plan_code = cells[1].get_text(strip=True)
            
            # Ячейка 2: Вид документа
            doc_type = cells[2].get_text(strip=True)
            
            # Ячейка 3: Обозначение (ссылка)
            designation_cell = cells[3]
            designation_link = designation_cell.select_one("a")
            designation = (
                designation_link.get_text(strip=True)
                if designation_link
                else designation_cell.get_text(strip=True)
            )
            designation_url = (
                designation_link.get("href", "")
                if designation_link
                else ""
            )
            if designation_url and not designation_url.startswith("http"):
                designation_url = f"https://stb.by/{designation_url}"
            
            # Ячейка 4: Наименование
            title_cell = cells[4]
            title_link = title_cell.select_one("a")
            title = (
                title_link.get_text(strip=True)
                if title_link
                else title_cell.get_text(strip=True)
            )
            
            # Ячейка 5: Дата начала
            start_date = cells[5].get_text(strip=True)
            
            # Ячейка 6: Дата окончания
            end_date = cells[6].get_text(strip=True)
            
            # Извлекаем год из шифра плана
            plan_year = None
            if plan_code:
                year_match = re.search(r"(\d{4})", plan_code)
                if year_match:
                    plan_year = int(year_match.group(1))
            
            # Фильтрация по году
            if plan_year and plan_year != target_year:
                continue
            
            # Уникальный ID
            project_id = _extract_by_id(plan_code, designation)
            
            # Маппинг стадии на наш статус
            status = STAGE_TO_STATUS.get(stage, "Вынесен на публичное обсуждение")
            
            # Форматируем даты в DD.MM.YYYY
            start_date_formatted = _format_by_date(start_date)
            end_date_formatted = _format_by_date(end_date)
            
            standards.append({
                "id": project_id,
                "prns_code": plan_code,
                "doc_type": doc_type,
                "project_name": title,
                "technical_committee": "",  # ТК для Беларуси не указан
                "developer": designation,  # Обозначение = разработчик
                "start_date": start_date_formatted,
                "end_date": end_date_formatted,
                "status": status,
                "url": designation_url,
                "country": "BY",
                "fetched_date": datetime.now().strftime("%Y-%m-%d"),
            })
        except Exception as e:
            logger.debug(f"Ошибка парсинга строки STB: {e}")
            continue
    
    return standards


def _extract_by_id(plan_code: str, designation: Optional[str]) -> str:
    """Формирует уникальный ID стандарта Беларуси."""
    # Приоритет: plan_code, затем designation
    if plan_code:
        clean_code = re.sub(r"[^a-zA-Z0-9]", "", plan_code)
        if clean_code:
            return f"BY-{clean_code}"
    
    if designation:
        clean_des = re.sub(r"[^a-zA-Z0-9]", "", designation)
        if clean_des:
            return f"BY-{clean_des}"
    
    import uuid
    return f"BY-{uuid.uuid4().hex[:12]}"


def _format_by_date(date_text: str) -> str:
    """Форматирует дату STB в формат DD.MM.YYYY.
    
    На сайте stb.by даты обычно в формате DD.MM.YYYY.
    """
    if not date_text:
        return ""
    
    date_text = date_text.strip()
    
    # Если уже в формате DD.MM.YYYY
    if re.match(r"\d{2}\.\d{2}\.\d{4}", date_text):
        return date_text
    
    # Если формат YYYY-MM-DD
    match = re.match(r"(\d{4})-(\d{2})-(\d{2})", date_text)
    if match:
        return f"{match.group(3)}.{match.group(2)}.{match.group(1)}"
    
    # Если текстовый формат "январь 2026"
    months = {
        "январь": "01", "февраль": "02", "март": "03", "апрель": "04",
        "май": "05", "июнь": "06", "июль": "07", "август": "08",
        "сентябрь": "09", "октябрь": "10", "ноябрь": "11", "декабрь": "12",
        "января": "01", "февраля": "02", "марта": "03", "апреля": "04",
        "мая": "05", "июня": "06", "июля": "07", "августа": "08",
        "сентября": "09", "октября": "10", "ноября": "11", "декабря": "12",
    }
    
    for month_ru, month_num in months.items():
        if month_ru in date_text.lower():
            day_match = re.search(r"(\d{1,2})", date_text)
            year_match = re.search(r"(\d{4})", date_text)
            if day_match and year_match:
                day = day_match.group(1).zfill(2)
                return f"{day}.{month_num}.{year_match.group(1)}"
    
    return date_text