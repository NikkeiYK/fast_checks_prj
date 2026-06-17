"""Парсер проектов НПА через API regulation.gov.ru."""
from __future__ import annotations
import logging
import time
from typing import Optional, List
from datetime import datetime

import requests

logger = logging.getLogger(__name__)

API_BASE = "https://regulation.gov.ru/api/public"

API_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://regulation.gov.ru/projects/",
    "Origin": "https://regulation.gov.ru",
    "Content-Type": "application/json",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
}

STAGES_MAP = {
    "Undefined": "Не определен",
    "Notification": "Уведомление",
    "Text": "Текст",
    "Procedure": "Оценка",
    "Finalzation": "Завершение",
    "Complete": "Принятие",
}

STATUSES_MAP = {
    "Undefined": "Разработка",
    "PreDiscussion": "Подготовка к обсуждению",
    "Discussion": "Идет обсуждение",
    "EndDiscussion": "Обсуждение завершено",
    "Complete": "Разработка завершена",
    "Rejected": "Отказ от продолжения разработки",
}


def create_npa_session() -> requests.Session:
    """Создаёт сессию для API-запросов."""
    s = requests.Session()
    s.headers.update(API_HEADERS)
    return s


def _format_iso_date(iso_date: Optional[str]) -> str:
    """Форматирует ISO дату в русский формат '17 июня 2026'."""
    if not iso_date:
        return ""
    try:
        dt = datetime.fromisoformat(iso_date.replace("Z", "+00:00").split(".")[0])
        months = {
            1: "января", 2: "февраля", 3: "марта", 4: "апреля",
            5: "мая", 6: "июня", 7: "июля", 8: "августа",
            9: "сентября", 10: "октября", 11: "ноября", 12: "декабря",
        }
        return f"{dt.day} {months[dt.month]} {dt.year}"
    except Exception as e:
        logger.debug(f"Ошибка парсинга даты {iso_date}: {e}")
        return iso_date


def _parse_project_item(item: dict) -> Optional[dict]:
    """Парсит один проект из JSON ответа API."""
    try:
        project_id = item.get("projectId") or item.get("id") or ""
        if not project_id:
            return None
        
        dept = item.get("developedDepartment") or {}
        developer = dept.get("description", "") if isinstance(dept, dict) else ""
        
        ptype = item.get("projectType") or {}
        doc_type = ptype.get("description", "") if isinstance(ptype, dict) else ""
        
        proc = item.get("procedure") or {}
        procedure = proc.get("description", "") if isinstance(proc, dict) else ""
        
        stage_code = item.get("stage", "")
        stage = STAGES_MAP.get(stage_code, stage_code)
        
        status_code = item.get("status", "")
        status = STATUSES_MAP.get(status_code, status_code)
        
        created_date = _format_iso_date(item.get("creationDate"))
        published_date = _format_iso_date(item.get("publicationDate"))
        
        num_id = item.get("id")
        url = f"https://regulation.gov.ru/projects/{num_id}/" if num_id else ""
        
        title = (item.get("title") or "").strip().replace("\n", " ").replace("  ", " ")
        
        return {
            "id": str(project_id),
            "title": title,
            "developer": developer,
            "doc_type": doc_type,
            "created_date": created_date,
            "published_date": published_date,
            "stage": stage,
            "status": status,
            "procedure": procedure,
            "url": url,
        }
    except Exception as e:
        logger.debug(f"Ошибка парсинга проекта: {e}")
        return None


def fetch_npa_projects(
    session: Optional[requests.Session] = None,
    max_pages: int = 50,
    year: Optional[int] = None,
) -> List[dict]:
    """Загружает проекты НПА через API regulation.gov.ru."""
    if session is None:
        session = create_npa_session()
    if year is None:
        year = datetime.now().year
    
    logger.info(f"🔌 Загружаем НПА через API за {year} год...")
    
    url = f"{API_BASE}/PublicProjects/GetFiltered"
    
    all_projects = []
    page = 1
    page_size = 100  # Увеличили с 20 до 100
    total_count = None
    stopped_by_year = False
    
    ordered_fields = [
        "title", "developedDepartment", "projectId", "projectType",
        "creationDate", "publicationDate", "stage", "status", "procedure"
    ]
    
    while page <= max_pages:
        logger.info(f"НПА: загрузка страницы {page}...")
        
        try:
            body = {
                "listParams": {
                    "filterModel": {
                        "filters": "",
                        "page": page,
                        "pageSize": page_size,
                    }
                },
                "orderedFields": ordered_fields,
            }
            
            resp = session.post(url, json=body, timeout=30)
            
            if resp.status_code != 200:
                logger.error(f"НПА: ошибка API: статус {resp.status_code}")
                logger.debug(f"Response: {resp.text[:500]}")
                break
            
            data = resp.json()
            
            items = data.get("result") or []
            
            if not items:
                logger.info(f"НПА: страница {page} пуста, остановка")
                break
            
            if total_count is None:
                total_count = data.get("count") or data.get("totalCount") or 0
                logger.info(f"📊 Всего записей в API: {total_count}")
            
            # Парсим проекты и фильтруем по году
            page_projects = []
            page_years = set()
            
            for item in items:
                project = _parse_project_item(item)
                if project:
                    pub_year = _extract_year(project.get("published_date"))
                    if pub_year:
                        page_years.add(pub_year)
                    
                    if pub_year == year:
                        page_projects.append(project)
            
            all_projects.extend(page_projects)
            logger.info(
                f"НПА: страница {page}: {len(page_projects)} проектов за {year} "
                f"(из {len(items)} на странице, годы на странице: {sorted(page_years)})"
            )
            
            # Проверяем, есть ли проекты старше нужного года
            has_older = any(y < year for y in page_years)
            
            if has_older:
                logger.info(f"НПА: достигнуты проекты старше {year} года, остановка")
                stopped_by_year = True
                break
            
            # Если загрузили меньше чем pageSize, значит это последняя страница
            if len(items) < page_size:
                break
            
            page += 1
            time.sleep(0.5)
        
        except requests.RequestException as e:
            logger.error(f"НПА: ошибка запроса: {e}")
            break
        except Exception as e:
            logger.error(f"НПА: ошибка: {e}", exc_info=True)
            break
    
    logger.info(f"✅ НПА: всего загружено {len(all_projects)} проектов за {year} год")
    
    if all_projects:
        p = all_projects[0]
        logger.info(f"📋 Пример: ID={p['id']}, дата={p['published_date']}, {p['title'][:60]}...")
    
    return all_projects


def _extract_year(date_str: Optional[str]) -> Optional[int]:
    """Извлекает год из даты в формате '17 июня 2026'."""
    if not date_str:
        return None
    try:
        parts = date_str.strip().split()
        if len(parts) == 3:
            return int(parts[2])
    except:
        pass
    return None