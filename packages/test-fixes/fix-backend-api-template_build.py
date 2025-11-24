"""
Template build API endpoint with per-project alias validation
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import logging

from backend.database import get_db
from backend.models import Template, Project, APIKey
from backend.services.template_service import TemplateService
from backend.schemas import BuildRequest, BuildResponse
from backend.auth import get_api_key_project

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/build", response_model=BuildResponse)
async def request_build(
    build_request: BuildRequest,
    db: Session = Depends(get_db),
    project: Project = Depends(get_api_key_project)
):
    """
    Request a new template build.
    
    The alias uniqueness is now scoped to the project level, allowing
    different projects to use the same template aliases.
    """
    try:
        # Check if alias already exists within this project
        existing_template = Template.get_by_project_and_alias(
            db, project.id, build_request.alias
        )
        
        if existing_template:
            # If template exists, check if we should update or reject
            if build_request.force_rebuild:
                # Delete existing template and create new one
                logger.info(f"Force rebuilding template {build_request.alias} in project {project.id}")
                TemplateService.delete_template(db, existing_template.id)
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Alias '{build_request.alias}' is already taken in project '{project.name}'"
                )
        
        # Create new template build
        template_service = TemplateService(db, project)
        template = template_service.create_template(
            alias=build_request.alias,
            config=build_request.config,
            dockerfile_content=build_request.dockerfile_content
        )
        
        return BuildResponse(
            template_id=template.id,
            status="building",
            message="Template build started successfully"
        )
        
    except IntegrityError as e:
        logger.error(f"Database integrity error during template build: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Template build failed due to data integrity constraints"
        )
    except Exception as e:
        logger.error(f"Unexpected error during template build: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during template build"
        )


@router.get("/build/{template_id}/status")
async def get_build_status(
    template_id: str,
    db: Session = Depends(get_db),
    project: Project = Depends(get_api_key_project)
):
    """
    Get the build status of a template.
    Ensures the template belongs to the authenticated project.
    """
    template = db.query(Template).filter(
        Template.id == template_id,
        Template.project_id == project.id
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found in project"
        )
    
    return {
        "template_id": template.id,
        "alias": template.alias,
        "status": template.build_status,
        "created_at": template.created_at,
        "updated_at": template.updated_at
    }


@router.get("/templates")
async def list_templates(
    db: Session = Depends(get_db),
    project: Project = Depends(get_api_key_project),
    skip: int = 0,
    limit: int = 100
):
    """
    List all templates for the authenticated project.
    """
    templates = db.query(Template).filter(
        Template.project_id == project.id
    ).offset(skip).limit(limit).all()
    
    return {
        "templates": [
            {
                "id": t.id,
                "alias": t.alias,
                "created_at": t.created_at,
                "updated_at": t.updated_at
            }
            for t in templates
        ],
        "total": len(templates)
    }