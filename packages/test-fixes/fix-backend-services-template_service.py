"""
Template service with project-scoped operations
"""
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from backend.models import Template, Project
from backend.build_system import BuildSystem

logger = logging.getLogger(__name__)


class TemplateService:
    """
    Service for managing template operations with project-level isolation.
    """
    
    def __init__(self, db: Session, project: Project):
        self.db = db
        self.project = project
    
    def create_template(
        self,
        alias: str,
        config: Dict[str, Any],
        dockerfile_content: Optional[str] = None
    ) -> Template:
        """
        Create a new template within the project.
        
        Args:
            alias: Template alias (unique within project)
            config: Template configuration
            dockerfile_content: Optional Dockerfile content
            
        Returns:
            Created Template object
            
        Raises:
            ValueError: If alias already exists in project
        """
        # Double-check alias uniqueness within project
        if Template.alias_exists_in_project(self.db, self.project.id, alias):
            raise ValueError(f"Alias '{alias}' already exists in project '{self.project.name}'")
        
        try:
            template = Template(
                alias=alias,
                project_id=self.project.id,
                config=config,
                dockerfile_content=dockerfile_content
            )
            
            self.db.add(template)
            self.db.flush()  # Get ID without committing
            
            # Start build process
            build_system = BuildSystem()
            build_system.start_build(template)
            
            self.db.commit()
            logger.info(f"Created template {alias} in project {self.project.name}")
            
            return template
            
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Integrity error creating template {alias}: {e}")
            raise ValueError(f"Alias '{alias}' already exists in project") from e
    
    def update_template(
        self,
        template_id: str,
        alias: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None
    ) -> Template:
        """
        Update an existing template.
        
        Args:
            template_id: UUID of the template
            alias: New alias (must be unique within project)
            config: Updated configuration
            
        Returns:
            Updated Template object
        """
        template = self.db.query(Template).filter(
            Template.id == template_id,
            Template.project_id == self.project.id
        ).first()
        
        if not template:
            raise ValueError("Template not found in project")
        
        if alias and alias != template.alias:
            # Check if new alias is available in project
            if Template.alias_exists_in_project(
                self.db, self.project.id, alias, exclude_id=template.id
            ):
                raise ValueError(f"Alias '{alias}' already exists in project")
            template.alias = alias
        
        if config:
            template.config = config
        
        self.db.commit()
        logger.info(f"Updated template {template_id} in project {self.project.name}")
        
        return template
    
    def delete_template(self, template_id: str) -> bool:
        """
        Delete a template from the project.
        
        Args:
            template_id: UUID of the template to delete
            
        Returns:
            True if deleted, False if not found
        """
        template = self.db.query(Template).filter(
            Template.id == template_id,
            Template.project_id == self.project.id
        ).first()
        
        if not template:
            return False
        
        self.db.delete(template)
        self.db.commit()
        logger.info(f"Deleted template {template_id} from project {self.project.name}")
        
        return True
    
    def get_template(self, template_id: str) -> Optional[Template]:
        """
        Get a template by ID, ensuring it belongs to the project.
        
        Args:
            template_id: UUID of the template
            
        Returns:
            Template object or None if not found
        """
        return self.db.query(Template).filter(
            Template.id == template_id,
            Template.project_id == self.project.id
        ).first()
    
    def get_by_alias(self, alias: str) -> Optional[Template]:
        """
        Get a template by alias within the project.
        
        Args:
            alias: Template alias
            
        Returns:
            Template object or None if not found
        """
        return Template.get_by_project_and_alias(
            self.db, self.project.id, alias
        )