import sqlalchemy
from sqlalchemy import create_engine, text
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/resume_creator")
engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        with conn.begin():
            conn.execute(text("DROP TABLE IF EXISTS field_mappings"))
        print("Dropped field_mappings table.")
except Exception as e:
    print(f"Error: {e}")
