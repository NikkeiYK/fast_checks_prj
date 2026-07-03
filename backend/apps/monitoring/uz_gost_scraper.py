"""Парсер стандартов Узбекистана с API uzsti.uz."""
from __future__ import annotations
import re
import logging
import time
from typing import Optional, List
from datetime import datetime

import requests

logger = logging.getLogger(__name__)

UZ_API_URL = "https://admin.uzsti.uz/api/v1/discuss-standarts"

SESSION_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "Origin": "https://uzsti.uz",
    "Referer": "https://uzsti.uz/",
}

# Маппинг типов статусов на наши
TYPE_TO_STATUS = {
    "in_progress": "Вынесен на публичное обсуждение",
    "finished": "Публичное обсуждение завершено",
}


def create_uz_session() -> requests.Session:
    """Создаёт сессию для парсинга Узбекских стандартов."""
    s = requests.Session()
    s.headers.update(SESSION_HEADERS)
    return s


def fetch_uz_gost_notifications(
    session: Optional[requests.Session] = None,
    year: int = 2026,
) -> List[dict]:
    """Загружает стандарты Узбекистана за указанный год."""
    if session is None:
        session = create_uz_session()
    
    logger.info(f"🇺🇿 Начинаем парсинг UZSTI (Узбекистан) за {year} год...")
    
    all_standards = []
    seen_ids = set()
    
    # Парсим все три типа: in_progress, finished, all
    for type_filter in ["in_progress", "finished", None]:
        type_label = type_filter or "all"
        logger.info(f"UZSTI: загрузка типа '{type_label}'...")
        
        try:
            params = {}
            if type_filter:
                params["type"] = type_filter
            
            resp = session.get(UZ_API_URL, params=params, timeout=30)
            resp.raise_for_status()
            
            data = resp.json()
            if not isinstance(data, list):
                logger.warning(f"UZSTI: неожиданный формат ответа для '{type_label}'")
                continue
            
            logger.info(f"UZSTI: получено {len(data)} записей типа '{type_label}'")
            
            status = TYPE_TO_STATUS.get(type_filter, "Вынесен на публичное обсуждение")
            
            for item in data:
                try:
                    standard = _parse_uz_item(item, year, status)
                    if standard and standard["id"] not in seen_ids:
                        seen_ids.add(standard["id"])
                        all_standards.append(standard)
                except Exception as e:
                    logger.debug(f"Ошибка парсинга элемента UZ: {e}")
                    continue
            
            time.sleep(1)  # Вежливая пауза между запросами
            
        except requests.RequestException as e:
            logger.error(f"UZSTI: ошибка запроса для '{type_label}': {e}")
            continue
    
    logger.info(f"✅ UZSTI: всего загружено {len(all_standards)} уникальных стандартов")
    return all_standards


def _parse_uz_item(item: dict, target_year: int, status: str) -> Optional[dict]:
    """Парсит один элемент стандарта Узбекистана."""
    try:
        item_id = item.get("id")
        if not item_id:
            return None
        
        # Извлекаем комитет
        committee = item.get("committee", {}) or {}
        committee_name = (
            committee.get("title_ru")
            or committee.get("title_uz")
            or committee.get("title_en")
            or ""
        )
        
        # Название на русском (предпочтительно)
        title = (
            item.get("title_ru")
            or item.get("title_uz")
            or item.get("title_en")
            or ""
        )
        
        # Парсим дату создания
        created_at = item.get("created_at", "")
        created_year = None
        formatted_date = ""
        
        if created_at:
            try:
                # Формат ISO: 2026-06-17T10:57:40.863
                dt = datetime.fromisoformat(created_at.replace("Z", "+00:00").split(".")[0])
                created_year = dt.year
                months = {
                    1: "января", 2: "февраля", 3: "марта", 4: "апреля",
                    5: "мая", 6: "июня", 7: "июля", 8: "августа",
                    9: "сентября", 10: "октября", 11: "ноября", 12: "декабря",
                }
                formatted_date = f"{dt.day} {months[dt.month]} {dt.year}"
            except Exception as e:
                logger.debug(f"Ошибка парсинга даты {created_at}: {e}")
        
        # Фильтрация по году
        if created_year and created_year != target_year:
            return None
        
        # Формируем URL для файлов
        file_project = item.get("file_standart_project")
        file_explain = item.get("file_explain")
        
        file_project_url = (
            f"https://admin.uzsti.uz/storage/{file_project}"
            if file_project else ""
        )
        file_explain_url = (
            f"https://admin.uzsti.uz/storage/{file_explain}"
            if file_explain else ""
        )
        
        # URL на страницу обсуждения
        url = "https://uzsti.uz/feedback"
        
        # Уникальный ID
        project_id = f"UZ-{item_id}"
        
        # Обозначение стандарта (если есть в title)
        designation = _extract_uz_designation(title)
        
        return {
            "id": project_id,
            "prns_code": designation,
            "doc_type": "O'zDSt (СТ УЗ)",
            "project_name": title,
            "technical_committee": committee_name,
            "developer": committee_name,
            "start_date": formatted_date,
            "end_date": None,
            "status": status,
            "url": url,
            "country": "UZ",
            "fetched_date": datetime.now().strftime("%Y-%m-%d"),
            "_file_project_url": file_project_url,
            "_file_explain_url": file_explain_url,
        }
    except Exception as e:
        logger.debug(f"Ошибка парсинга UZ item: {e}")
        return None


def _extract_uz_designation(title: str) -> str:
    """Пытается извлечь обозначение стандарта из названия."""
    if not title:
        return ""
    
    # Ищем паттерны типа "O'zDSt 1234:2026" или "O'z DSt 1234-2026"
    match = re.search(r"(O['']?zDSt\s+[\w\d\.\-:]+)", title, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    
    return ""