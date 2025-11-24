"""
Integration tests for template build functionality with per-project alias uniqueness
"""
import pytest
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import Project, Template, APIKey
from backend.api.template_build import request_build
from backend.schemas import BuildRequest
from backend.services.template_service import TemplateService


class TestTemplateBuildPerProjectUniqueness:
    """Test template build functionality with per-project alias uniqueness."""
    
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
        """Create test projects with API keys."""
        project1 = Project(
            id=uuid.uuid4(),
            name="Test Project 1",
            description="First test project"
        )
        project2 = Project(
            id=uuid.uuid4(),
            name="Test Project 2", 
            description="Second test project"
        )
        
        db_session.add_all([project1, project2])
        db_session.commit()
        
        # Create API keys
        api_key1 = APIKey(
            id=uuid.uuid4(),
            key="test_api_key_1",
            project_id=project1.id,
            is_active=True
        )
        api_key2 = APIKey(
            id=uuid.uuid4(),
            key="test_api_key_2", 
            project_id=project2.id,
            is_active=True
        )
        
        db_session.add_all([api_key1, api_key2])
        db_session.commit()
        
        return [project1, project2, api_key1, api_key2]
    
    def test_same_alias_different_projects_success(self, db_session, test_projects):
        """Test that the same alias can be used across different projects."""
        project1, project2, api_key1, api_key2 = test_projects
        
        # Create template in first project
        build_request1 = BuildRequest(
            alias="test-template",
            config={"base_image": "ubuntu:20.04"},
            dockerfile_content="FROM ubuntu:20.04"
        )
        
        response1 = request_build(
            build_request=build_request1,
            db=db_session,
            project=project1
        )
        
        assert response1.status_code == 200
        assert "template_id" in response1.json()
        
        # Create template with same alias in second project - should succeed
        build_request2 = BuildRequest(
            alias="test-template",  # Same alias
            config={"base_image": "alpine:latest"},
            dockerfile_content="FROM alpine:latest"
        )
        
        response2 = request_build(
            build_request=build_request2,
            db=db_session,
            project=project2
        )
        
        assert response2.status_code == 200
        assert "template_id" in response2.json()
        
        # Verify both templates exist with same alias but different projects
        templates = db_session.query(Template).filter_by(alias="test-template").all()
        assert len(templates) == 2
        assert templates[0].project_id != templates[1].project_id
    
    def test_duplicate_alias_same_project_fails(self, db_session, test_projects):
        """Test that duplicate aliases within the same project fail."""
        project1, _, api_key1, _ = test_projects
        
        # Create first template
        build_request1 = BuildRequest(
            alias="duplicate-template",
            config={"base_image": "ubuntu:20.04"},
            dockerfile_content="FROM ubuntu:20.04"
        )
        
        response1 = request_build(
            build_request=build_request1,
            db=db_session,
            project=project1
        )
        
        assert response1.status_code == 200
        
        # Try to create template with same alias in same project - should fail
        build_request2 = BuildRequest(
            alias="duplicate-template",  # Same alias, same project
            config={"base_image": "alpine:latest"},
            dockerfile_content="FROM alpine:latest"
        )
        
        response2 = request_build(
            build_request=build_request2,
            db=db_session,
            project=project1
        )
        
        assert response2.status_code == 400
        assert "already taken" in response2.json()["detail"]
    
    def test_force_rebuild_updates_template(self, db_session, test_projects):
        """Test that force_rebuild option allows updating existing template."""
        project1, _, _, _ = test_projects
        
        # Create initial template
        build_request1 = BuildRequest(
            alias="update-template",
            config={"base_image": "ubuntu:20.04"},
            dockerfile_content="FROM ubuntu:20.04",
            force_rebuild=False
        )
        
        response1 = request_build(
            build_request=build_request1,
            db=db_session,
            project=project1
        )
        
        assert response1.status_code == 200
        template_id = response1.json()["template_id"]
        
        # Try to rebuild without force - should fail
        build_request2 = BuildRequest(
            alias="update-template",
            config={"base_image": "alpine:latest"},
            dockerfile_content="FROM alpine:latest",
            force_rebuild=False
        )
        
        response2 = request_build(
            build_request=build_request2,
            db=db_session,
            project=project1
        )
        
        assert response2.status_code == 400
        
        # Force rebuild - should succeed
        build_request3 = BuildRequest(
            alias="update-template",
            config={"base_image": "alpine:latest"},
            dockerfile_content="FROM alpine:latest",
            force_rebuild=True
        )
        
        response3 = request_build(
            build_request=build_request3,
            db=db_session,
            project=project1
        )
        
        assert response3.status_code == 200
        assert response3.json()["template_id"] != template_id  # New template ID


class TestTemplateServicePerProject:
    """Test TemplateService with per-project scoping."""
    
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
    def test_project(self, db_session):
        """Create a test project."""
        project = Project(
            id=uuid.uuid4(),
            name="Service Test Project",
            description="Test project for service tests"
        )
        db_session.add(project)
        db_session.commit()
        return project
    
    def test_template_service_project_isolation(self, db_session, test_project):
        """Test that TemplateService operations are isolated to the project."""
        service = TemplateService(db_session, test_project)
        
        # Create template
        template = service.create_template(
            alias="service-template",
            config={"test": "config"}
        )
        
        assert template.alias == "service-template"
        assert template.project_id == test_project.id
        
        # Get by alias
        found_template = service.get_by_alias("service-template")
        assert found_template is not None
        assert found_template.id == template.id
        
        # Try to get non-existent alias
        not_found = service.get_by_alias("non-existent")
        assert not_found is None