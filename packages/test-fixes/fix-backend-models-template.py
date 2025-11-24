"""
Template model with per-project alias uniqueness
"""
from sqlalchemy import Column, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from backend.database import Base


class Template(Base):
    """
    Template model representing a build template.
    Aliases are now unique per project, not globally.
    """
    __tablename__ = 'templates'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alias = Column(String(255), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)
    
    # Define composite unique constraint
    __table_args__ = (
        UniqueConstraint('project_id', 'alias', name='templates_project_alias_unique'),
        # Index for efficient project-based queries
        {'extend_existing': True}
    )
    
    # Relationships
    project = relationship("Project", back_populates="templates")
    
    def __repr__(self):
        return f"<Template(alias='{self.alias}', project_id='{self.project_id}')>"
    
    @classmethod
    def get_by_project_and_alias(cls, session, project_id, alias):
        """
        Get a template by project_id and alias combination.
        
        Args:
            session: Database session
            project_id: UUID of the project
            alias: Template alias string
            
        Returns:
            Template object or None
        """
        return session.query(cls).filter(
            cls.project_id == project_id,
            cls.alias == alias
        ).first()
    
    @classmethod
    def alias_exists_in_project(cls, session, project_id, alias, exclude_id=None):
        """
        Check if an alias exists within a specific project.
        
        Args:
            session: Database session
            project_id: UUID of the project
            alias: Template alias to check
            exclude_id: Optional template ID to exclude from check (for updates)
            
        Returns:
            Boolean indicating if alias exists
        """
        query = session.query(cls).filter(
            cls.project_id == project_id,
            cls.alias == alias
        )
        
        if exclude_id:
            query = query.filter(cls.id != exclude_id)
            
        return query.first() is not None