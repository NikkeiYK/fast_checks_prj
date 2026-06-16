"""Фильтрация уведомлений по «полимерным» ключевым словам."""
from typing import List

POLYMER_KEYWORDS = [
    "полимер", "пластмасс", "пластик", "резин", "каучук",
    "полиэтилен", "полипропилен", "пвх", "полиуретан", "эпоксид",
    "композит", "стеклопластик", "полиамид", "силикон", "фторопласт",
    "термопласт", "эластомер", "латекс", "полистирол", "полиэфир",
    "поликарбонат",
]


def _get_search_text(notification: dict) -> str:
    fields = [
        notification.get("project_name", ""),
        notification.get("title", ""),
        notification.get("technical_committee", ""),
        notification.get("developer", ""),
        notification.get("doc_type", ""),
    ]
    return " ".join(fields).lower()


def is_polymer_related(notification: dict) -> bool:
    text = _get_search_text(notification)
    return any(kw in text for kw in POLYMER_KEYWORDS)


def get_matched_keywords(notification: dict) -> List[str]:
    text = _get_search_text(notification)
    return [kw for kw in POLYMER_KEYWORDS if kw in text]