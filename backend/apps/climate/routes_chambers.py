from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from apps.climate.database import get_db
from apps.climate.models import Chamber
from apps.climate.routes import check_auth, has_permission

router = APIRouter(prefix="/api/climate/chambers", tags=["chambers"])

@router.get("")
def list_chambers(
    center: str = Query(None),
    username: str = Query(...),
    db: Session = Depends(get_db)
):
    check_auth(username)
    q = db.query(Chamber).filter(Chamber.is_active == True)
    if center:
        q = q.filter(Chamber.center == center)
    return [{
        "id": c.id,
        "name": c.name,
        "center": c.center,
        "min_temp": c.min_temp,
        "max_temp": c.max_temp,
        "min_humidity": c.min_humidity,
        "max_humidity": c.max_humidity,
        "description": c.description
    } for c in q.all()]

@router.get("/centers")
def list_centers(
    username: str = Query(...),
    db: Session = Depends(get_db)
):
    check_auth(username)
    centers = db.query(Chamber.center).distinct().all()
    return [{"name": c[0]} for c in centers]

@router.post("")
def create_chamber(
    data: dict,
    username: str = Query(...),
    db: Session = Depends(get_db)
):
    user = check_auth(username)
    if not has_permission(user, "climate:cancel"):
        raise HTTPException(403, "Только администратор может создавать камеры")
    
    required = ["name", "center"]
    for f in required:
        if f not in data:
            raise HTTPException(400, detail=f"Отсутствует поле: {f}")
    
    chamber = Chamber(
        name=data["name"],
        center=data["center"],
        min_temp=data.get("min_temp", -70),
        max_temp=data.get("max_temp", 180),
        min_humidity=data.get("min_humidity", 10),
        max_humidity=data.get("max_humidity", 98),
        description=data.get("description")
    )
    db.add(chamber)
    db.commit()
    db.refresh(chamber)
    
    return {"id": chamber.id, "name": chamber.name, "center": chamber.center}