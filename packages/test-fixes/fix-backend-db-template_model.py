"""
Template model with project-scoped alias uniqueness
"""
from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.db.base import Base
import uuid

class Template(Base):
    """
    Template model that enforces alias uniqueness within a project scope
    """
    __tablename__ = 'templates'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    alias = Column(String, nullable=False)
    project_id = Column(String, nullable=False)  # New field for project scoping
    dockerfile = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Create composite unique constraint for alias + project_id
    __table_args__ = (
        Index('idx_alias_project', 'alias', 'project_id', unique=True),
        Index('idx_project_id', 'project_id'),
    )
    
    def __repr__(self):
        return f"<Template(alias='{self.alias}', project_id='{self.project_id}')>"