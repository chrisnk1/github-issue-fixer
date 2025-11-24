"""
Unit tests for Template model with per-project alias uniqueness
"""
import pytest
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import Template, Project


class TestTemplateModel:
    """Test Template model functionality."""
    
    @pytest.fixture
    def db_session(self):
        """Create a test database session."""
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        SessionLocal = sessionmaker(bind=engine)
        session = SessionLocal()
        yield session
        session.close()
    
    @pytest.fixture
    def test_projects(self, db_session):
        """Create test projects."""
        project1 = Project(
            id=uuid.uuid4(),
            name="Project 1",
            description="First project"
        )
        project2 = Project(
            id=uuid.uuid4(),
            name="Project 2",
            description="Second project"
        )
        
        db_session.add_all([project1, project2])
        db_session.commit()
        
        return [project1, project2]
    
    def test_composite_uniqueness_constraint(self, db_session, test_projects):
        """Test that (project_id, alias) combination is unique."""
        project1, project2 = test_projects
        
        # Create template in first project
        template1 = Template(
            alias="test-template",
            project_id=project1.id,
            config={"test": "config1"}
        )
        db_session.add(template1)
        db_session.commit()
        
        # Create template with same alias in second project - should succeed
        template2 = Template(
            alias="test-template",  # Same alias
            project_id=project2.id,  # Different project
            config={"test": "config2"}
        )
        db_session.add(template2)
        db_session.commit()
        
        # Try to create duplicate in same project - should fail
        template3 = Template(
            alias="test-template",  # Same alias
            project_id=project1.id,  # Same project as template1
            config={"test": "config3"}
        )
        db_session.add(template3)
        
        with pytest.raises(Exception):  # IntegrityError
            db_session.commit()
        
        # Rollback to clear the failed transaction
        db_session.rollback()
    
    def test_get_by_project_and_alias(self, db_session, test_projects):
        """Test get_by_project_and_alias method."""
        project1, project2 = test_projects
        
        # Create templates
        template1 = Template(
            alias="find-me",
            project_id=project1.id,
            config={"test": "config1"}
        )
        template2 = Template(
            alias="find-me",  # Same alias
            project_id=project2.id,  # Different project
            config={"test": "config2"}
        )
        
        db_session.add_all([template1, template2])
        db_session.commit()
        
        # Find template in project1
        found1 = Template.get_by_project_and_alias(
            db_session, project1.id, "find-me"
        )
        assert found1 is not None
        assert found1.id == template1.id
        
        # Find template in project2
        found2 = Template.get_by_project_and_alias(
            db_session, project2.id, "find-me"
        )
        assert found2 is not None
        assert found2.id == template2.id
        
        # Try to find non-existent combination
        not_found = Template.get_by_project_and_alias(
            db_session, project1.id, "not-exists"
        )
        assert not_found is None
    
    def test_alias_exists_in_project(self, db_session, test_projects):
        """Test alias_exists_in_project method."""
        project1, project2 = test_projects
        
        # Create template
        template = Template(
            alias="exists-template",
            project_id=project1.id,
            config={"test": "config"}
        )
        db_session.add(template)
        db_session.commit()
        
        # Check exists in project1
        exists = Template.alias_exists_in_project(
            db_session, project1.id, "exists-template"
        )
        assert exists is True
        
        # Check does not exist in project2
        not_exists = Template.alias_exists_in_project(
            db_session, project2.id, "exists-template"
        )
        assert not_exists is False
        
        # Check with exclude_id (for updates)
        exists_with_exclude = Template.alias_exists_in_project(
            db_session, project1.id, "exists-template",
            exclude_id=template.id
        )
        assert exists_with_exclude is False