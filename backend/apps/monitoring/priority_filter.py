"""Фильтрация НПА по приоритетным разработчикам."""
from typing import List
from .config import PRIORITY_DEVELOPERS


def is_priority_developer(developer: str) -> bool:
    """Проверяет, является ли разработчик приоритетным."""
    if not developer:
        return False
    dev_lower = developer.lower()
    return any(kw.lower() in dev_lower for kw in PRIORITY_DEVELOPERS)


def get_matched_priority(developer: str) -> str:
    """Возвращает найденное ключевое слово приоритета."""
    if not developer:
        return ""
    dev_lower = developer.lower()
    for kw in PRIORITY_DEVELOPERS:
        if kw.lower() in dev_lower:
            return kw
    return ""