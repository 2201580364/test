import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:pass@localhost/db",
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
