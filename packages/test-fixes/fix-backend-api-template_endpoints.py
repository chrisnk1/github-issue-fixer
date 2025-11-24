"""
Template API endpoints with project-scoped alias validation
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.db.template_model import Template
from backend.exceptions import BuildException
from typing import Optional
import uuid

router = APIRouter()

def get_project_id_from_api_key(request: Request) -> str:
    """
    Extract project ID from API key in the request header
    This is a placeholder - implement based on your auth system
    """
    # In a real implementation, this would decode the API key
    # and extract the associated project ID
    api_key = request.headers.get("X-API-Key", "")
    # For now, return a default or extract from your auth system
    return "default_project"  # Replace with actual implementation

@router.post("/templates/build")
async def build_template(
    template_data: dict,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Build a template with project-scoped alias validation
    """
    alias = template_data.get("alias")
    project_id = get_project_id_from_api_key(request)
    
    # Check for existing template with same alias in this project
    existing_template = db.query(Template).filter(
        Template.alias == alias,
        Template.project_id == project_id
    ).first()
    
    if existing_template:
        raise BuildException(
            status_code=400,
            message=f"Alias '{alias}' is already taken in project '{project_id}'"
        )
    
    # Create new template
    new_template = Template(
        alias=alias,
        project_id=project_id,
        dockerfile=template_data.get("dockerfile", ""),
        id=str(uuid.uuid4())
    )
    
    db.add(new_template)
    db.commit()
    db.refresh(new_template)
    
    return {
        "template_id": new_template.id,
        "alias": new_template.alias,
        "project_id": new_template.project_id,
        "status": "building"
    }

@router.get("/templates/{alias}")
async def get_template(
    alias: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Get a template by alias within the current project scope
    """
    project_id = get_project_id_from_api_key(request)
    
    template = db.query(Template).filter(
        Template.alias == alias,
        Template.project_id == project_id
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=404,
            message=f"Template with alias '{alias}' not found in project '{project_id}'"
        )
    
    return {
        "id": template.id,
        "alias": template.alias,
        "project_id": template.project_id,
        "created_at": template.created_at,
        "updated_at": template.updated_at
    }