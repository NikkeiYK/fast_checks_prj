# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging, os, uvicorn

# 🔹 Логгер
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Polylab Platform")

# 🔹 CORS — как у тебя
def get_cors_origins():
    default = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "https://platform-frontend-polylab.amvera.io", "*"]
    env = os.environ.get("AMVERA_CORS_ORIGINS", "")
    return list(set(default + [o.strip() for o in env.split(",") if o.strip()])) if env else default

app.add_middleware(CORSMiddleware, allow_origins=get_cors_origins(), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# 🔹 Health check
@app.get("/api/health")
def health():
    return {"status": "ok", "env": "amvera" if os.environ.get("AMVERA") == "1" else "local", "apps": ["audit", "climate"]}

# =============================================================================
# 🔌 ПОДКЛЮЧЕНИЕ МОДУЛЕЙ
# =============================================================================

# 1. Аудит
from apps.audit.database import init_db as init_audit_db
from apps.audit.routes import router as audit_router
init_audit_db()  # Инициализация БД аудита
app.include_router(audit_router)  # Эндпоинты: /api/login, /api/history...

# 2. Климатическая камера
from apps.climate.database import init_db as init_climate_db
from apps.climate.routes import router as climate_router
init_climate_db()  # Инициализация БД климата
app.include_router(climate_router)  # Эндпоинты: /api/climate/slots, /api/climate/book...

# =============================================================================
# ЗАПУСК
# =============================================================================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    env = "🟢 Amvera" if os.environ.get("AMVERA") == "1" else "🔵 Local"
    logger.info(f"{env} Запуск Polylab Platform на порту {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)