"""
Custom exceptions for the E2B backend with improved error messages
"""
from typing import Optional, Dict, Any

class E2BException(Exception):
    """Base exception for E2B backend"""
    def __init__(self, message: str, status_code: int = 500, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)

class BuildException(E2BException):
    """Exception raised when template build fails"""
    def __init__(self, message: str, status_code: int = 400, details: Optional[Dict[str, Any]] = None):
        # Provide more context for alias conflicts
        if "already taken" in message and "project" not in message:
            message = message.replace("is already taken", "is already taken in your project")
        
        super().__init__(message, status_code, details)

class TemplateNotFoundException(E2BException):
    """Exception raised when template is not found"""
    def __init__(self, alias: str, project_id: str):
        message = f"Template with alias '{alias}' not found in project '{project_id}'"
        super().__init__(message, status_code=404)

class UnauthorizedException(E2BException):
    """Exception raised for unauthorized access"""
    def __init__(self, message: str = "Unauthorized access"):
        super().__init__(message, status_code=401)

class ValidationException(E2BException):
    """Exception raised for validation errors"""
    def __init__(self, field: str, message: str):
        full_message = f"Validation error for field '{field}': {message}"
        super().__init__(full_message, status_code=400, details={"field": field, "message": message})

# Exception handlers for FastAPI
def create_exception_handlers(app):
    """Create exception handlers for the FastAPI app"""
    
    @app.exception_handler(BuildException)
    async def build_exception_handler(request, exc: BuildException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "BuildError",
                "message": exc.message,
                "details": exc.details
            }
        )
    
    @app.exception_handler(TemplateNotFoundException)
    async def template_not_found_handler(request, exc: TemplateNotFoundException):
        return JSONResponse(
            status_code=404,
            content={
                "error": "TemplateNotFound",
                "message": exc.message
            }
        )
    
    @app.exception_handler(UnauthorizedException)
    async def unauthorized_handler(request, exc: UnauthorizedException):
        return JSONResponse(
            status_code=401,
            content={
                "error": "Unauthorized",
                "message": exc.message
            }
        )