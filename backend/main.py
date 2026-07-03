from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging, os, uvicorn
import atexit
from apps.monitoring.scheduler import start_scheduler, stop_scheduler


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Polylab Platform")

def get_cors_origins():
    # УБРАЛИ "*" из списка, так как он несовместим с allow_credentials=True
    default = [
        "http://localhost:5173", 
        "http://127.0.0.1:5173", 
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://platform-frontend-polylab.amvera.io"
    ]
    env = os.environ.get("AMVERA_CORS_ORIGINS", "")
    return list(set(default + [o.strip() for o in env.split(",") if o.strip()])) if env else default

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {
        "status": "ok", 
        "env": "amvera" if os.environ.get("AMVERA") == "1" else "local", 
        "apps": ["audit", "climate", "monitoring"],
        "cors_origins": get_cors_origins()  # Для отладки
    }

# === AUDIT MODULE ===
from apps.audit.database import init_db as init_audit_db
from apps.audit.routes import router as audit_router
init_audit_db()
app.include_router(audit_router)

# === CLIMATE MODULE ===
from apps.climate_v2.database import init_db as init_climate_db
from apps.climate_v2.routes import router as climate_router
init_climate_db()
app.include_router(climate_router)

# === MONITORING MODULE ===
from apps.monitoring.database import init_db as init_monitoring_db
from apps.monitoring.routes import router as monitoring_router
from apps.monitoring.scheduler import start_scheduler, stop_scheduler
init_monitoring_db()
app.include_router(monitoring_router)

start_scheduler()
atexit.register(stop_scheduler)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    env = "🟢 Amvera" if os.environ.get("AMVERA") == "1" else "🔵 Local"
    logger.info(f"{env} Запуск Polylab Platform на порту {port}")
    logger.info(f"CORS origins: {get_cors_origins()}")
    uvicorn.run(app, host="0.0.0.0", port=port)