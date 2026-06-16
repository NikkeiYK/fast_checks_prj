"""Конфигурация модуля мониторинга Росстандарта."""
import os

_PROJECT_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _resolve_data_dir() -> str:
    raw = os.environ.get("DATA_DIR", "").strip()
    if raw:
        return os.path.normpath(raw)
    if os.environ.get("AMVERA") == "1" and os.path.isdir("/data"):
        return "/data"
    return os.path.normpath(os.path.join(_PROJECT_ROOT, "data"))


DATA_DIR = _resolve_data_dir()

# ── СП (rst.gov.ru) ──────────────────────────────────────────
SP_BASE_URL = (
    "https://www.rst.gov.ru/portal/gost/home/activity/"
    "standardization/notification/notificationssetrules"
)
SP_COMPONENT_ID = "5bb1aa96-ad4f-4e66-afe1-a7d403577940"

# ── ГОСТ (fgis.gost.ru) ──────────────────────────────────────
GOST_API_URL = "https://fgis.gost.ru/share/proxy/alfresco-noauth/rsprs/public/nds"
GOST_API_IPS = ["212.164.138.14", "212.164.138.19"]
GOST_DETAIL_URL = "https://fgis.gost.ru/share/page/rsprs/nds-details?uuid={uuid}"
GOST_STATUS_FILTER = "Вынесен на публичное обсуждение"
GOST_PAGES_FROM_END = 20

ALL_GOST_STATUSES = [
    "Вынесен на публичное обсуждение",
    "Направлено уведомление о завершении публичного обсуждения",
    "Продлен срок публичного обсуждения",
    "На доработке",
    "Публичное обсуждение завершено",
]

# ── НАШИ ТЕХНИЧЕСКИЕ КОМИТЕТЫ ───────────────────────────────
OUR_TECHNICAL_COMMITTEES = [
    "ТК 023", "ТК 031", "ТК 052", "ТК 060", "ТК 113", "ТК 115", "ТК 144",
    "ТК 151", "ТК 160", "ТК 171", "ТК 182", "ТК 195", "ТК 214", "ТК 223",
    "ТК 230", "ТК 231", "ТК 239", "ТК 241", "ТК 269", "ТК 274", "ТК 295",
    "ТК 339", "ТК 424"
]
