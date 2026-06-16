from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
import os

if os.environ.get("AMVERA") == "1":
    DATABASE_URL = "sqlite:////data/climate_db.sqlite"
else:
    DATABASE_URL = "sqlite:///./climate_db.sqlite"

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class ScientificCenter(Base):
    __tablename__ = "scientific_centers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    
    chambers = relationship("ClimaticChamber", back_populates="center", cascade="all, delete-orphan")


class ClimaticChamber(Base):
    __tablename__ = "climatic_chambers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    center_id = Column(Integer, ForeignKey("scientific_centers.id"), nullable=False)
    
    # Методики (JSON массив)
    methodologies = Column(JSON, nullable=True)  # ["ISO 4892-3", "ASTM G154"]
    
    # Лампы с диапазонами интенсивности (JSON массив объектов)
    lamps = Column(JSON, nullable=True)  
    # Пример: [{"name": "UVA-340", "intensity_min": 0.1, "intensity_max": 1.55, "unit": "W/m²"}]
    
    cassette_count = Column(Integer, nullable=True)
    
    # Диапазоны температур (JSON объекты)
    condensation_temp_min = Column(Integer, nullable=True)  # Мин. температура конденсации
    condensation_temp_max = Column(Integer, nullable=True)  # Макс. температура конденсации
    irradiation_temp_min = Column(Integer, nullable=True)   # Мин. температура облучения
    irradiation_temp_max = Column(Integer, nullable=True)   # Макс. температура облучения
    
    center = relationship("ScientificCenter", back_populates="chambers")


class Booking(Base):
    __tablename__ = "bookings"
    
    id = Column(Integer, primary_key=True, index=True)
    
    center_id = Column(Integer, ForeignKey("scientific_centers.id"), nullable=False)
    chamber_id = Column(Integer, ForeignKey("climatic_chambers.id"), nullable=False)
    cassette_number = Column(Integer, nullable=False)
    
    department = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    sample_cipher = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    project = Column(String, nullable=True)
    lims_request_id = Column(String, nullable=True)
    
    duration_hours = Column(Integer, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    
    status = Column(String, default="active", nullable=False, index=True)
    cancellation_reason = Column(Text, nullable=True)

    center = relationship("ScientificCenter")
    chamber = relationship("ClimaticChamber")


def init_db():
    """Создание таблиц и инициализация тестовых данных"""
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        if db.query(ScientificCenter).count() == 0:
            # Центр 1: ПолиЛаб Москва (Сколково)
            center2 = ScientificCenter(name="ПолиЛаб Москва (Сколково)")
            db.add(center2)
            db.flush()
            
            chamber3 = ClimaticChamber(
                name="Q-LAB QUV/Spray",
                description="Везерометр для ускоренных климатических испытаний",
                center_id=center2.id,
                methodologies=["ISO 4892-3", "ISO 4892-1", "ASTM G151", "ASTM G154", "ASTM D4329"],
                lamps=[
                    {"name": "UVA-340", "intensity_min": 0.70, "intensity_max": 1.70, "unit": "W/m²/nm"},
                    {"name": "UVA-313", "intensity_min": 0.70, "intensity_max": 1.70, "unit": "W/m²/nm"},
                    {"name": "UVB-313", "intensity_min": 0.20, "intensity_max": 1.70, "unit": "W/m²/nm"}
                ],
                cassette_count=24,
                condensation_temp_min=40,
                condensation_temp_max=60,
                irradiation_temp_min=45,
                irradiation_temp_max=80
            )
            db.add(chamber3)
            
            chamber4 = ClimaticChamber(
                name="Xenon Arc Test Chamber XL-S-750",
                description="Везерометр с водоохлаждаемой ксеноновой лампой",
                center_id=center2.id,
                methodologies=["ASTM G155", "ASTM D2565", "ASTM D4329", "ISO 4892", "ISO 16474", "ГОСТ 9.401", "ГОСТ 32317"],
                lamps=[
                    {"name": "Xenon Arc 4500W", "intensity_min": 0.51, "intensity_max": 0.51, "unit": "W/m²/nm при 340 нм"},
                    {"name": "Xenon Arc 4500W", "intensity_min": 1.1, "intensity_max": 1.1, "unit": "W/m²/nm при 420 нм"}
                ],
                cassette_count=42,
                condensation_temp_min=35,
                condensation_temp_max=85,
                irradiation_temp_min=20,
                irradiation_temp_max=100
            )
            db.add(chamber4)
            
            # Центр 2: ПолиЛаб Воронеж
            center3 = ScientificCenter(name="ПолиЛаб Воронеж (Воронежсинтезкаучук)")
            db.add(center3)
            db.flush()
            
            chamber5 = ClimaticChamber(
                name="SunTest CPS+",
                description="Везерометр для ускоренных климатических испытаний",
                center_id=center3.id,
                methodologies=["ГОСТ 32317", "Внутренняя методика"],
                lamps=[
                    {"name": "XENON lamp NXE 1500 B", "intensity_min": 30, "intensity_max": 65, "unit": "W/m² (300-400 нм)"},
                    {"name": "XENON lamp NXE 1500 B", "intensity_min": 250, "intensity_max": 765, "unit": "W/m² (300-800 нм)"}
                ],
                cassette_count=33,
                condensation_temp_min=35,
                condensation_temp_max=100,
                irradiation_temp_min=35,
                irradiation_temp_max=100
            )
            db.add(chamber5)
            
            # Центр 3: ПолиЛаб Нижний Новгород
            center4 = ScientificCenter(name="ПолиЛаб Нижний Новгород")
            db.add(center4)
            db.flush()
            
            chamber6 = ClimaticChamber(
                name="Ci3000+ Weather-Ometer",
                description="Везерометр с ксеноновой лампой и водяным охлаждением",
                center_id=center4.id,
                methodologies=["ГОСТ 9.708-83"],
                lamps=[
                    {"name": "Xenon lamp 4500W", "intensity_min": 39.8, "intensity_max": 150.6, "unit": "W/m² (300-400 нм)"}
                ],
                cassette_count=33,
                condensation_temp_min=20,
                condensation_temp_max=65,
                irradiation_temp_min=20,
                irradiation_temp_max=65
            )
            db.add(chamber6)
            
            # ✅ НОВАЯ КАМЕРА: Xenotest 440
            chamber7 = ClimaticChamber(
                name="Xenotest 440",
                description="Везерометр для ускоренных климатических испытаний с воздушным охлаждением",
                center_id=center4.id,
                methodologies=["ГОСТ 9.708-83"],
                lamps=[
                    {"name": "Xenon lamp (воздушное охлаждение) x2", "intensity_min": 30, "intensity_max": 120, "unit": "W/m² (300-400 нм)"}
                ],
                cassette_count=24,
                condensation_temp_min=20,
                condensation_temp_max=65,
                irradiation_temp_min=20,
                irradiation_temp_max=65
            )
            db.add(chamber7)
            
            # ✅ НОВЫЙ ЦЕНТР: ПолиЛаб Казань
            center5 = ScientificCenter(name="ПолиЛаб Казань")
            db.add(center5)
            db.flush()
            
            # ✅ НОВАЯ КАМЕРА: Q-SUN Xe-2-HE
            chamber8 = ClimaticChamber(
                name="Q-SUN Xe-2-HE",
                description="Везерометр для ускоренных климатических испытаний с ксеноновой лампой",
                center_id=center5.id,
                methodologies=["ISO 4892-2", "ASTM G155", "ГОСТ 32317"],
                lamps=[
                    {"name": "Ксеноновая лампа", "intensity_min": 0.5, "intensity_max": 0.5, "unit": "W/m²/nm при 340 нм"}
                ],
                cassette_count=33,
                condensation_temp_min=38,
                condensation_temp_max=65,
                irradiation_temp_min=38,
                irradiation_temp_max=65
            )
            db.add(chamber8)
            
            # ✅ НОВАЯ КАМЕРА: Q-SUN Xe-3-HSE (из скриншота)
            chamber9 = ClimaticChamber(
                name="Q-SUN Xe-3-HSE",
                description="Везерометр для ускоренных климатических испытаний с ксеноновой лампой и фильтром DAYLIGHT-Q",
                center_id=center5.id,
                methodologies=["ISO 4892-2", "ASTM G155", "ГОСТ 32317"],
                lamps=[
                    {"name": "Ксеноновая лампа", "intensity_min": 0.51, "intensity_max": 0.51, "unit": "W/m²/nm при 340 нм"}
                ],
                cassette_count=33,
                condensation_temp_min=38,
                condensation_temp_max=65,
                irradiation_temp_min=38,
                irradiation_temp_max=65
            )
            db.add(chamber9)
            
            db.commit()
    finally:
        db.close()