import os
import json
import io
import time
import uuid
from typing import Dict, Any, List, Optional

import pandas as pd
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import inspect, text, Column, Integer, String, JSON, LargeBinary, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Session, relationship
from sqlalchemy.exc import OperationalError
from pydantic import BaseModel
from docxtpl import DocxTemplate

from .database import engine, Base, SessionLocal, get_db
from .docx_utils import extract_placeholders_in_order
from .ai_engine import ai_engine

app = FastAPI(
    title="QuantumLeap Synthesis Engine API",
    description="API for the automated resume generation system.",
    version="3.4.0",
)

# --- Database Startup Retry Logic ---
MAX_RETRIES = 10
RETRY_DELAY = 3  # seconds

for i in range(MAX_RETRIES):
    try:
        # Try to create tables to verify connection
        Base.metadata.create_all(bind=engine)
        print("Database connection established and tables created.")
        break
    except OperationalError as e:
        if i < MAX_RETRIES - 1:
            print(f"Database unavailable, retrying in {RETRY_DELAY} seconds... (Attempt {i+1}/{MAX_RETRIES})")
            time.sleep(RETRY_DELAY)
        else:
            print("Could not connect to database after multiple attempts.")
            raise e

# CORS Middleware
origins = [
    "http://localhost",
    "http://localhost:5173",
]

# Load allowed origins from environment variable if present
if os.getenv("BACKEND_CORS_ORIGINS"):
    try:
        env_origins = json.loads(os.getenv("BACKEND_CORS_ORIGINS"))
        if isinstance(env_origins, list):
            origins.extend(env_origins)
    except json.JSONDecodeError:
        print("Warning: Could not parse BACKEND_CORS_ORIGINS")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SQLAlchemy Models ---
class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    filename = Column(String)
    file_content = Column(LargeBinary)
    
    mappings = relationship("FieldMapping", back_populates="template", cascade="all, delete-orphan")

class FieldMapping(Base):
    __tablename__ = "field_mappings"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("templates.id"))
    table_name = Column(String, index=True)
    mapping_data = Column(JSON)
    ai_instructions = Column(JSON, default={})
    
    template = relationship("Template", back_populates="mappings")

    __table_args__ = (
        UniqueConstraint('template_id', 'table_name', name='uq_template_table'),
    )

class APIConfig(Base):
    __tablename__ = "api_configs"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String, index=True)  # deepseek, gemini, qwen
    api_key = Column(String)
    base_url = Column(String)
    model_name = Column(String)
    is_active = Column(Integer, default=1)  # 1: active, 0: inactive

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

# --- Constants ---
STANDARD_RESUME_FIELDS = [
    {"key": "full_name", "label": "姓名", "description": "候选人全名"},
    {"key": "email", "label": "电子邮箱", "description": "联系邮箱"},
    {"key": "phone", "label": "电话号码", "description": "联系电话"},
    {"key": "linkedin", "label": "LinkedIn/个人主页", "description": "个人主页链接"},
    {"key": "summary", "label": "个人简介", "description": "简短的职业概述"},
    {"key": "skills", "label": "技能列表", "description": "技术或专业技能"},
    {"key": "experience_company", "label": "公司名称", "description": "工作过的公司"},
    {"key": "experience_title", "label": "职位名称", "description": "担任的职务"},
    {"key": "experience_dates", "label": "任职时间", "description": "开始和结束时间"},
    {"key": "experience_description", "label": "工作描述", "description": "职责和成就"},
    {"key": "education_school", "label": "学校/大学", "description": "毕业院校"},
    {"key": "education_degree", "label": "学位", "description": "获得的学位"},
    {"key": "education_year", "label": "毕业年份", "description": "毕业时间"},
]

# --- Pydantic Models ---
class RowData(BaseModel):
    data: Dict[str, Any]

class MappingCreate(BaseModel):
    template_id: int
    table_name: str
    mapping_data: Dict[str, str]
    ai_instructions: Optional[Dict[str, Any]] = {}

class TemplateResponse(BaseModel):
    id: int
    name: str
    filename: str

    class Config:
        orm_mode = True

class APIConfigCreate(BaseModel):
    provider: str
    api_key: str
    base_url: str
    model_name: str

class APIConfigResponse(APIConfigCreate):
    id: int
    is_active: int

    class Config:
        orm_mode = True

class AICompletionRequest(BaseModel):
    table_name: str
    record_id: str
    target_fields: List[str]
    user_prompt: Optional[str] = ""
    config_id: Optional[int] = None

class ContextAssembleRequest(BaseModel):
    template_id: int
    person_table: str
    person_id: str
    project_table: Optional[str] = None
    project_ids: Optional[List[str]] = None

class ContextFillRequest(BaseModel):
    context: Dict[str, Any]
    target_fields: List[str]
    user_prompt: Optional[str] = None
    field_instructions: Optional[Dict[str, Any]] = {}
    config_id: Optional[int] = None

class TemplateCopyRequest(BaseModel):
    new_name: str

class TemplateRenameRequest(BaseModel):
    new_name: str

# --- Helper Functions ---
def _get_primary_key(inspector, table_name: str, schema: str = "public") -> Optional[str]:
    """Gets the primary key column name for a table. Returns None if not found."""
    pk_constraint = inspector.get_pk_constraint(table_name, schema)
    if not pk_constraint or not pk_constraint['constrained_columns']:
        return None
    return pk_constraint['constrained_columns'][0]

def _build_resume_context(
    db: Session,
    template_id: int,
    person_table: str,
    person_id: str,
    project_table: Optional[str] = None,
    project_ids: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Helper function to assemble the resume context from database records.
    """
    # 1. Fetch Template & Mappings
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    person_map_record = db.query(FieldMapping).filter(
        FieldMapping.template_id == template_id,
        FieldMapping.table_name == person_table
    ).first()
    person_mapping = person_map_record.mapping_data if person_map_record else {}

    # Extract placeholders from template for auto-mapping
    try:
        placeholders = extract_placeholders_in_order(template.file_content)
    except Exception as e:
        print(f"Warning: Could not parse template for placeholders: {e}")
        placeholders = []

    # 2. Fetch Data from DB
    inspector = inspect(engine)
    
    # 2.1 Fetch Person Data
    person_pk = _get_primary_key(inspector, person_table)
    if not person_pk:
            raise HTTPException(status_code=400, detail=f"Person table '{person_table}' has no primary key.")
            
    p_stmt = text(f'SELECT * FROM public."{person_table}" WHERE "{person_pk}" = :pid')
    
    with engine.connect() as conn:
        # Person Row
        person_result = conn.execute(p_stmt, {"pid": person_id}).mappings().first()
        if not person_result:
            raise HTTPException(status_code=404, detail="Person not found")
        person_row = dict(person_result)
        
    # 2.2 Fetch Project Data
    project_rows = []
    if project_table and project_ids:
        project_map_record = db.query(FieldMapping).filter(
            FieldMapping.template_id == template_id,
            FieldMapping.table_name == project_table
        ).first()
        project_mapping = project_map_record.mapping_data if project_map_record else {}

        project_pk = _get_primary_key(inspector, project_table)
        if not project_pk:
            raise HTTPException(status_code=400, detail=f"Project table '{project_table}' has no primary key.")
        
        p_stmt_projects = text(f'SELECT * FROM public."{project_table}" WHERE "{project_pk}" IN :pids')
        
        with engine.connect() as conn:
            project_results = conn.execute(p_stmt_projects, {"pids": tuple(project_ids)}).mappings().all()
            for res in project_results:
                project_row_data = dict(res)
                project_context_row = {}
                
                # Identify loop placeholders (starting with p.)
                loop_placeholders = [p for p in placeholders if p.strip().startswith('p.')]
                
                for lp in loop_placeholders:
                    clean_key = lp.strip()[2:] # remove 'p.'
                    
                    # 1. Try Explicit Mapping
                    mapped_col = project_mapping.get(lp)
                    if mapped_col and mapped_col in project_row_data:
                        project_context_row[clean_key] = project_row_data[mapped_col]
                    # 2. Try Auto-Mapping (exact match)
                    elif clean_key in project_row_data:
                        project_context_row[clean_key] = project_row_data[clean_key]
                    # 3. Try Auto-Mapping (fuzzy: ignore case, _)
                    else:
                        found = False
                        for col in project_row_data.keys():
                            if col.lower().replace("_", "") == clean_key.lower().replace("_", ""):
                                project_context_row[clean_key] = project_row_data[col]
                                found = True
                                break
                        if not found:
                            project_context_row[clean_key] = ""

                if project_context_row:
                    project_rows.append(project_context_row)

    # --- Auto-Sort Projects (Reverse Chronological) ---
    # Heuristic: Look for fields resembling a date and sort descending.
    if project_rows:
        def get_sort_key(row):
            # 1. Try to find a specific 'start_date' or 'end_date' field first
            priority_keys = ['end_date', 'start_date', 'date', 'time', '结束时间', '开始时间', '日期', '时间']
            
            # 2. Search for exact or partial matches
            for key in row.keys():
                key_lower = key.lower()
                for pk in priority_keys:
                    if pk in key_lower:
                        val = row[key]
                        # Handle 'Present' or '至今' as the far future
                        if isinstance(val, str) and any(s in val for s in ['至今', 'Present', 'Now', 'Current']):
                            return "9999-12-31" 
                        return str(val) if val else "0000-00-00"
            return "0000-00-00"

        try:
            # Sort in place: Newest dates first (Descending)
            project_rows.sort(key=get_sort_key, reverse=True)
            print("DEBUG: Auto-sorted project rows by detected date field.")
        except Exception as e:
            print(f"Warning: Failed to auto-sort projects: {e}")

    # 3. Build Context
    context = {}
    
    # Add projects list to context
    context['projects'] = project_rows
    
    print(f"DEBUG: Person Table: {person_table}, ID: {person_id}")
    print(f"DEBUG: Explicit Mapping: {person_mapping}")
    
    # 3.1 Apply Person Mapping (Explicit + Auto)
    for p in placeholders:
        clean_p = p.strip()
        if clean_p.startswith('p.'): 
            continue # Skip project loop fields
            
        # 1. Try Explicit Mapping
        if clean_p in person_mapping and person_mapping[clean_p] in person_row:
             context[clean_p] = person_row[person_mapping[clean_p]]
        # 2. Try Auto-Mapping (exact match)
        elif clean_p in person_row:
             context[clean_p] = person_row[clean_p]
        # 3. Try Auto-Mapping (fuzzy)
        else:
             found = False
             for col in person_row.keys():
                 # Match "full_name" with "fullname" or "Full Name"
                 if col.lower().replace("_", "") == clean_p.lower().replace("_", ""):
                     context[clean_p] = person_row[col]
                     found = True
                     break
             if not found:
                 print(f"DEBUG: Auto-map failed for {clean_p}")
                 context[clean_p] = "" # Default to empty

    
    # Serialize datetime objects and Handle None
    def clean_data(obj):
        if isinstance(obj, dict):
            return {k: clean_data(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [clean_data(v) for v in obj]
        elif hasattr(obj, 'isoformat'):
            return obj.isoformat()
        elif obj is None:
            return ""
        return obj

    print(f"DEBUG: Final Context Keys: {list(context.keys())}")
    return clean_data(context)

# --- API Endpoints ---
@app.get("/")
def read_root():
    return {"message": "Welcome to the QuantumLeap Synthesis Engine API!"}

# --- Configuration Endpoints ---
@app.get("/api/v1/configs", response_model=List[APIConfigResponse])
def get_configs(db: Session = Depends(get_db)):
    return db.query(APIConfig).all()

@app.post("/api/v1/configs", response_model=APIConfigResponse)
def create_or_update_config(config: APIConfigCreate, db: Session = Depends(get_db)):
    # Check if provider config exists
    db_config = db.query(APIConfig).filter(APIConfig.provider == config.provider).first()
    if db_config:
        db_config.api_key = config.api_key
        db_config.base_url = config.base_url
        db_config.model_name = config.model_name
        db_config.is_active = 1
    else:
        db_config = APIConfig(**config.dict())
        db.add(db_config)
    
    db.commit()
    db.refresh(db_config)
    return db_config

@app.delete("/api/v1/configs/{config_id}")
def delete_config(config_id: int, db: Session = Depends(get_db)):
    config = db.query(APIConfig).filter(APIConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    db.delete(config)
    db.commit()
    return {"message": "Config deleted"}

@app.post("/api/v1/configs/test")
async def test_connection(config: APIConfigCreate):
    try:
        # Temporary test using a simple prompt
        test_result = await ai_engine.generate_completion(
            record_data={"test": "ping"},
            target_fields=["response"],
            user_prompt="Reply with 'pong' if you receive this.",
            api_config=config.dict()
        )
        if "error" in test_result:
             raise HTTPException(status_code=400, detail=test_result["error"])
        return {"status": "success", "message": "Connection successful", "response": test_result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- AI Generation Endpoints ---
@app.post("/api/v1/ai/generate")
async def generate_ai_content(request: AICompletionRequest, db: Session = Depends(get_db)):
    try:
        # 1. Fetch Config if provided
        api_config = None
        if request.config_id:
            db_config = db.query(APIConfig).filter(APIConfig.id == request.config_id).first()
            if db_config:
                api_config = {
                    "api_key": db_config.api_key,
                    "base_url": db_config.base_url,
                    "model_name": db_config.model_name
                }

        # 2. Fetch the record
        inspector = inspect(engine)
        pk_column = _get_primary_key(inspector, request.table_name)
        if not pk_column:
             raise HTTPException(status_code=400, detail=f"Table '{request.table_name}' has no primary key.")
             
        stmt = text(f'SELECT * FROM public."{request.table_name}" WHERE "{pk_column}" = :pid')
        
        with engine.connect() as conn:
            result = conn.execute(stmt, {"pid": request.record_id}).mappings().first()
            if not result:
                raise HTTPException(status_code=404, detail="Record not found")
            record_data = dict(result)
            
        # 3. Call AI Engine
        generated_data = await ai_engine.generate_completion(
            record_data=record_data,
            target_fields=request.target_fields,
            user_prompt=request.user_prompt,
            api_config=api_config
        )
        
        return generated_data

    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# --- Wizard Workflow Endpoints (New) ---

@app.post("/api/v1/context/assemble")
def assemble_context_endpoint(req: ContextAssembleRequest, db: Session = Depends(get_db)):
    """
    Step 1 & 2: Assemble data from Person and Projects into a mapped JSON context.
    """
    try:
        context = _build_resume_context(
            db,
            req.template_id,
            req.person_table, 
            req.person_id, 
            req.project_table, 
            req.project_ids
        )
        return context
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ai/fill_context")
async def fill_context_endpoint(req: ContextFillRequest, db: Session = Depends(get_db)):
    """
    Step 3: AI Enrichment. Takes the assembled context and fills missing fields.
    """
    try:
        # Fetch Config if provided
        api_config = None
        if req.config_id:
            db_config = db.query(APIConfig).filter(APIConfig.id == req.config_id).first()
            if db_config:
                api_config = {
                    "api_key": db_config.api_key,
                    "base_url": db_config.base_url,
                    "model_name": db_config.model_name
                }
        
        generated_data = await ai_engine.generate_completion(
            record_data=req.context,
            target_fields=req.target_fields,
            user_prompt=req.user_prompt,
            field_instructions=req.field_instructions,
            api_config=api_config
        )
        return generated_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/generate/render_from_context")
async def render_resume_from_context(
    template_id: int = Form(...),
    context_str: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Step 4: Render the final docx using the provided JSON context (as string) and template ID.
    """
    try:
        # Fetch Template
        template = db.query(Template).filter(Template.id == template_id).first()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        # Parse JSON context
        try:
            context = json.loads(context_str)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON format for context_str")

        # Render Template
        buffer = io.BytesIO(template.file_content)
        tpl = DocxTemplate(buffer)
        
        # docxtpl needs a dict
        tpl.render(context)
        
        output_buffer = io.BytesIO()
        tpl.save(output_buffer)
        output_buffer.seek(0)
        
        return StreamingResponse(
            output_buffer,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={template.filename}_generated.docx"}
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# --- Template Management Endpoints ---

@app.get("/api/v1/templates", response_model=List[TemplateResponse])
def list_templates(db: Session = Depends(get_db)):
    return db.query(Template).all()

@app.post("/api/v1/templates", response_model=TemplateResponse)
async def upload_template(file: UploadFile = File(...), name: str = Form(None), db: Session = Depends(get_db)):
    if not file.filename.endswith('.docx'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file type. Please upload a .docx file.")
    
    try:
        content = await file.read()
        template_name = name if name else file.filename
        
        # Create Template Record
        new_template = Template(name=template_name, filename=file.filename, file_content=content)
        db.add(new_template)
        db.commit()
        db.refresh(new_template)
        
        return new_template
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/templates/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    db.delete(template)
    db.commit()
    return {"message": "Template deleted successfully"}

@app.get("/api/v1/templates/{template_id}/parse")
def parse_saved_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
        
    try:
        placeholders = extract_placeholders_in_order(template.file_content)
        
        singleton_placeholders = [p for p in placeholders if not p.strip().startswith('p.')]
        loop_placeholders = [p for p in placeholders if p.strip().startswith('p.')]
        
        return {
            "template_id": template.id,
            "filename": template.filename,
            "singleton_placeholders": singleton_placeholders,
            "loop_placeholders": loop_placeholders
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/templates/{template_id}/mappings")
def get_template_mappings(template_id: int, db: Session = Depends(get_db)):
    mappings = db.query(FieldMapping).filter(FieldMapping.template_id == template_id).all()
    return [
        {
            "table_name": m.table_name,
            "mapping_data": m.mapping_data,
            "ai_instructions": m.ai_instructions or {}
        }
        for m in mappings
    ]

@app.post("/api/v1/templates/{template_id}/copy", response_model=TemplateResponse)
def copy_template(template_id: int, req: TemplateCopyRequest, db: Session = Depends(get_db)):
    original_template = db.query(Template).filter(Template.id == template_id).first()
    if not original_template:
        raise HTTPException(status_code=404, detail="Original template not found")

    # Check for duplicate name
    if db.query(Template).filter(Template.name == req.new_name).first():
        raise HTTPException(status_code=400, detail=f"Template with name '{req.new_name}' already exists.")

    try:
        # Create a new template record
        new_template = Template(
            name=req.new_name,
            filename=original_template.filename,
            file_content=original_template.file_content
        )
        db.add(new_template)
        db.flush() # Flush to get the new_template.id

        # Copy associated field mappings
        original_mappings = db.query(FieldMapping).filter(FieldMapping.template_id == template_id).all()
        for original_map in original_mappings:
            new_map = FieldMapping(
                template_id=new_template.id,
                table_name=original_map.table_name,
                mapping_data=original_map.mapping_data,
                ai_instructions=original_map.ai_instructions
            )
            db.add(new_map)
        
        db.commit()
        db.refresh(new_template)
        return new_template
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to copy template: {str(e)}")

@app.put("/api/v1/templates/{template_id}/rename", response_model=TemplateResponse)
def rename_template(template_id: int, req: TemplateRenameRequest, db: Session = Depends(get_db)):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Check for duplicate name (if trying to rename to an existing name)
    if db.query(Template).filter(Template.name == req.new_name, Template.id != template_id).first():
        raise HTTPException(status_code=400, detail=f"Template with name '{req.new_name}' already exists.")

    try:
        template.name = req.new_name
        db.commit()
        db.refresh(template)
        return template
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to rename template: {str(e)}")

# --- Field Mapping Endpoints ---
@app.get("/api/v1/mappings/fields")
def get_standard_fields():
    return {"fields": STANDARD_RESUME_FIELDS}

@app.get("/api/v1/mappings/{template_id}/{table_name}")
def get_mapping(template_id: int, table_name: str, db: Session = Depends(get_db)):
    mapping = db.query(FieldMapping).filter(
        FieldMapping.template_id == template_id,
        FieldMapping.table_name == table_name
    ).first()
    if not mapping:
        return {"table_name": table_name, "template_id": template_id, "mapping_data": {}, "ai_instructions": {}}
    return {"table_name": table_name, "template_id": template_id, "mapping_data": mapping.mapping_data, "ai_instructions": mapping.ai_instructions or {}}

@app.post("/api/v1/mappings")
def save_mapping(mapping: MappingCreate, db: Session = Depends(get_db)):
    # Check if template exists
    template = db.query(Template).filter(Template.id == mapping.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    db_mapping = db.query(FieldMapping).filter(
        FieldMapping.template_id == mapping.template_id,
        FieldMapping.table_name == mapping.table_name
    ).first()
    
    if db_mapping:
        db_mapping.mapping_data = mapping.mapping_data
        db_mapping.ai_instructions = mapping.ai_instructions
    else:
        db_mapping = FieldMapping(
            template_id=mapping.template_id,
            table_name=mapping.table_name,
            mapping_data=mapping.mapping_data,
            ai_instructions=mapping.ai_instructions
        )
        db.add(db_mapping)
    
    try:
        db.commit()
        db.refresh(db_mapping)
        return {"message": "映射保存成功", "data": db_mapping.mapping_data}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# --- Data Import Endpoints ---
@app.post("/api/v1/data/upload/excel")
async def upload_excel_to_table(table_name: str = Form(...), file: UploadFile = File(...)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file type.")
    try:
        contents = await file.read()
        buffer = io.BytesIO(contents)
        df = pd.read_excel(buffer)

        # Handle 'id' column conflict
        if 'id' in df.columns:
            df.rename(columns={'id': 'uploaded_id'}, inplace=True)

        # Generate UUID for 'id' column
        df['id'] = [str(uuid.uuid4()) for _ in range(len(df))]

        with engine.connect() as connection:
            # Use transaction to ensure atomicity
            with connection.begin():
                df.to_sql(table_name, connection, if_exists='replace', index=False)
                
                # Set 'id' column as PRIMARY KEY
                add_pk_stmt = text(f'ALTER TABLE public."{table_name}" ADD PRIMARY KEY (id);')
                connection.execute(add_pk_stmt)

        return {"message": f"Successfully uploaded and imported to table '{table_name}'.", "rows_imported": len(df)}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# --- Data Management Endpoints ---
@app.get("/api/v1/data/tables")
def get_table_names():
    try:
        inspector = inspect(engine)
        all_tables = inspector.get_table_names(schema="public")
        # Filter out system tables
        visible_tables = [t for t in all_tables if t not in ['field_mappings', 'templates']]
        return {"tables": visible_tables}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get("/api/v1/data/tables/{table_name}")
def get_table_data(table_name: str):
    try:
        if table_name in ['field_mappings', 'templates']:
             raise HTTPException(status_code=403, detail="Access denied to system tables.")

        inspector = inspect(engine)
        if not inspector.has_table(table_name, schema="public"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Table '{table_name}' not found.")
        
        pk_column = _get_primary_key(inspector, table_name)
        
        with engine.connect() as connection:
            df = pd.read_sql_table(table_name, connection, schema="public")
        
        # Convert to object to ensure we can store None instead of NaN/Inf
        df = df.astype(object)
        
        # Replace Infinity and NaN with None for JSON compliance
        df.replace([float('inf'), float('-inf')], None, inplace=True)
        df = df.where(pd.notnull(df), None)
        
        columns = df.columns.tolist()
        data = df.to_dict(orient="records")
        return {"table_name": table_name, "pk_column": pk_column, "columns": columns, "data": data}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.delete("/api/v1/data/tables/{table_name}")
def delete_table(table_name: str):
    try:
        if table_name in ['field_mappings', 'templates']:
             raise HTTPException(status_code=403, detail="Access denied to system tables.")
             
        inspector = inspect(engine)
        if not inspector.has_table(table_name, schema="public"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Table '{table_name}' not found.")

        # Drop the table
        with engine.connect() as connection:
            with connection.begin():
                connection.execute(text(f'DROP TABLE public."{table_name}"'))

        return {"message": f"Table '{table_name}' deleted successfully."}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.put("/api/v1/data/tables/{table_name}/row")
def update_table_row(table_name: str, row: RowData):
    try:
        inspector = inspect(engine)
        pk_column = _get_primary_key(inspector, table_name)
        if pk_column is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Table has no primary key, update operation is not supported.")

        row_data = row.data
        pk_value = row_data.pop(pk_column, None)

        if pk_value is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Primary key value is missing.")

        set_clauses = ", ".join([f'"{col}" = :{col}' for col in row_data.keys()])
        
        stmt = text(f'UPDATE public."{table_name}" SET {set_clauses} WHERE "{pk_column}" = :pk_value')
        
        with engine.connect() as connection:
            with connection.begin():
                connection.execute(stmt, {**row_data, "pk_value": pk_value})

        return {"message": f"Row with {pk_column}={pk_value} in table '{table_name}' updated successfully."}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.delete("/api/v1/data/tables/{table_name}/row")
def delete_table_row(table_name: str, row: RowData):
    try:
        inspector = inspect(engine)
        pk_column = _get_primary_key(inspector, table_name)
        if pk_column is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Table has no primary key, delete operation is not supported.")
        
        pk_value = row.data.get(pk_column)
        if pk_value is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Primary key '{pk_column}' missing in request.")

        stmt = text(f'DELETE FROM public."{table_name}" WHERE "{pk_column}" = :pk_value')
        
        with engine.connect() as connection:
            with connection.begin():
                result = connection.execute(stmt, {"pk_value": pk_value})
                if result.rowcount == 0:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Row not found.")

        return {"message": f"Row with {pk_column}={pk_value} from table '{table_name}' deleted successfully."}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

