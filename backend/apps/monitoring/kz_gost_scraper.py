"""Парсер проектов СТ РК (Казахстан) с сайта КазСтандарт."""
from __future__ import annotations
import re
import logging
import time
from typing import Optional, List, Tuple
from datetime import datetime

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

KZ_BASE_URL = "https://ksm.kz/ru/standardization/discussions/strk/"

SESSION_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
}


def create_kz_session() -> requests.Session:
    """Создаёт сессию для парсинга Казахстанских ГОСТов."""
    s = requests.Session()
    s.headers.update(SESSION_HEADERS)
    return s


def fetch_kz_gost_notifications(
    session: Optional[requests.Session] = None,
    year: int = 2026,
    max_pages: int = 50,
) -> List[dict]:
    """Загружает проекты СТ РК за указанный год."""
    if session is None:
        session = create_kz_session()
    
    logger.info(f"🇰🇿 Начинаем парсинг СТ РК (Казахстан) за {year} год...")
    
    all_projects = []
    seen_ids = set()  # ← НОВОЕ: отслеживаем уже добавленные ID
    page = 1
    total_pages = None
    
    while page <= max_pages:
        logger.info(f"СТ РК: загрузка страницы {page}{f'/{total_pages}' if total_pages else ''}...")
        
        try:
            params = {"page": page, "year": str(year)}
            resp = session.get(KZ_BASE_URL, params=params, timeout=15)
            resp.raise_for_status()
        except requests.RequestException as e:
            logger.error(f"СТ РК: ошибка загрузки страницы {page}: {e}")
            break
        
        projects, page_total_pages = _parse_kz_page(resp.text, year)
        
        if total_pages is None and page_total_pages:
            total_pages = page_total_pages
            logger.info(f"📊 Всего страниц: {total_pages}")
        
        if not projects:
            logger.info(f"СТ РК: страница {page} пуста, остановка")
            break
        
        # ✅ Фильтруем дубликаты
        unique_projects = []
        for p in projects:
            if p["id"] not in seen_ids:
                seen_ids.add(p["id"])
                unique_projects.append(p)
            else:
                logger.debug(f"⚠️ Дубликат на странице {page}: {p['id']}")
        
        all_projects.extend(unique_projects)
        logger.info(f"СТ РК: страница {page}: {len(unique_projects)} уникальных проектов (из {len(projects)})")
        
        if total_pages and page >= total_pages:
            break
        
        page += 1
        time.sleep(2)
    
    logger.info(f"✅ СТ РК: всего загружено {len(all_projects)} уникальных проектов")
    return all_projects


def _parse_kz_page(html: str, target_year: int) -> Tuple[List[dict], Optional[int]]:
    """Парсит HTML страницу со списком проектов СТ РК."""
    soup = BeautifulSoup(html, "lxml")
    projects = []
    
    cards = soup.select("div.discussion-card")
    
    for card in cards:
        try:
            # Название и ссылка
            title_elem = card.select_one("h3.discussion-title a")
            title = title_elem.text.strip() if title_elem else ""
            link = title_elem.get("href", "") if title_elem else ""
            if link and not link.startswith("http"):
                link = f"https://ksm.kz{link}"
            
            # Номер стандарта
            number_elem = card.select_one("div.discussion-number")
            number = number_elem.text.strip() if number_elem else ""
            
            # Дата
            date_elem = card.select_one("div.discussion-year")
            date_text = date_elem.text.strip() if date_elem else ""
            
            # Год
            year_elem = card.select_one("span i.fa-calendar")
            year_text = None
            if year_elem and year_elem.parent:
                year_text = year_elem.parent.text.strip()
            
            # Разработчик
            developer_elem = card.select_one("div.discussion-developer")
            developer = developer_elem.text.strip() if developer_elem else ""
            
            # Статусы файлов
            file_badges = card.select("div.discussion-files span.file-badge")
            files_status = {}
            for badge in file_badges:
                badge_text = badge.text.strip()
                is_available = "available" in badge.get("class", [])
                files_status[badge_text] = is_available
            
            # Определяем статус обсуждения
            status = _determine_kz_status(files_status)
            
            # Форматируем дату
            formatted_date = _format_kz_date(date_text, year_text)
            
            # Проверяем год
            if formatted_date:
                project_year = _extract_year_from_date(formatted_date)
                if project_year != target_year:
                    continue
            
            # Уникальный ID
            project_id = _extract_kz_id(link, number)
            
            projects.append({
                "id": project_id,
                "prns_code": number,
                "project_name": title,
                "developer": developer,
                "start_date": formatted_date,
                "end_date": None,
                "status": status,
                "url": link,
                "technical_committee": "",
                "doc_type": "СТ РК",
                "country": "KZ",
                "fetched_date": datetime.now().strftime("%Y-%m-%d"),
            })
        except Exception as e:
            logger.debug(f"Ошибка парсинга карточки СТ РК: {e}")
            continue
    
    total_pages = _extract_kz_total_pages(soup)
    return projects, total_pages


def _determine_kz_status(files_status: dict) -> str:
    """Определяет статус обсуждения на основе доступности файлов."""
    if files_status.get("Завершение", False):
        return "Публичное обсуждение завершено"
    elif files_status.get("Проект", False):
        return "Направлено уведомление о завершении публичного обсуждения"
    elif files_status.get("Начало", False):
        return "Вынесен на публичное обсуждение"
    else:
        return "Вынесен на публичное обсуждение"


def _format_kz_date(date_text: str, year_text: Optional[str]) -> Optional[str]:
    """Форматирует дату в формат DD.MM.YYYY."""
    if not date_text:
        return None
    
    try:
        # Если уже в формате DD.MM.YYYY
        if "." in date_text:
            parts = date_text.split(".")
            if len(parts) == 3:
                return f"{parts[0].strip()}.{parts[1].strip()}.{parts[2].strip()}"
        
        # Текстовый формат
        months = {
            "января": "01", "февраля": "02", "марта": "03", "апреля": "04",
            "мая": "05", "июня": "06", "июля": "07", "августа": "08",
            "сентября": "09", "октября": "10", "ноября": "11", "декабря": "12",
        }
        
        for month_ru, month_num in months.items():
            if month_ru in date_text.lower():
                day_match = re.search(r"(\d{1,2})", date_text)
                if day_match:
                    day = day_match.group(1).zfill(2)
                    year = year_text.strip() if year_text else "2026"
                    return f"{day}.{month_num}.{year}"
        
        return date_text.strip()
    except Exception as e:
        logger.debug(f"Ошибка форматирования даты: {e}")
        return date_text.strip() if date_text else None


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


def _extract_kz_id(link: str, number: Optional[str]) -> str:
    """Извлекает уникальный ID проекта."""
    if link:
        match = re.search(r"/strk/(\d+)/", link)
        if match:
            return f"KZ-{match.group(1)}"
    
    if number:
        clean_number = re.sub(r"[^a-zA-Z0-9]", "", number)
        if clean_number:
            return f"KZ-{clean_number}"
    
    import uuid
    return f"KZ-{uuid.uuid4().hex[:12]}"


def _extract_kz_total_pages(soup: BeautifulSoup) -> Optional[int]:
    """Извлекает общее количество страниц из пагинации."""
    info_blocks = soup.select("p.text-muted")
    for block in info_blocks:
        text = block.get_text()
        if "Страница" in text:
            strongs = block.select("strong")
            if len(strongs) >= 2:
                try:
                    return int(strongs[1].text.strip())
                except:
                    pass
    
    pagination_links = soup.select("ul.pagination li a")
    if pagination_links:
        page_numbers = []
        for link in pagination_links:
            href = link.get("href", "")
            if "page=" in href:
                try:
                    page_num = int(href.split("page=")[1].split("&")[0])
                    page_numbers.append(page_num)
                except:
                    pass
            text = link.text.strip()
            if text.isdigit():
                page_numbers.append(int(text))
        
        if page_numbers:
            return max(page_numbers)
    
    return None