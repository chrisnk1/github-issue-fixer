"""
Template build API client with project context
"""
import os
import requests
from typing import Optional, Dict, Any
from e2b.exceptions import BuildException
from e2b.api_key import get_api_key

def request_build(
    template_alias: str,
    dockerfile: str,
    api_key: Optional[str] = None,
    project_id: Optional[str] = None,
    base_url: str = "https://api.e2b.dev"
) -> Dict[str, Any]:
    """
    Request a template build with project context
    
    Args:
        template_alias: The alias for the template
        dockerfile: The Dockerfile content
        api_key: Optional API key (will use E2B_API_KEY env var if not provided)
        project_id: Optional project ID (will be extracted from API key if not provided)
        base_url: The base URL for the API
        
    Returns:
        Build response data
        
    Raises:
        BuildException: If the build request fails
    """
    api_key = api_key or get_api_key()
    if not api_key:
        raise BuildException(
            status_code=401,
            message="API key is required. Set E2B_API_KEY environment variable or pass api_key parameter."
        )
    
    headers = {
        "X-API-Key": api_key,
        "Content-Type": "application/json"
    }
    
    # Build request payload with project context
    payload = {
        "alias": template_alias,
        "dockerfile": dockerfile,
        "project_context": {
            "source": "python-sdk",
            "version": "1.0.0"  # Replace with actual SDK version
        }
    }
    
    # Only include project_id if explicitly provided
    # The backend will extract it from the API key if not provided
    if project_id:
        payload["project_id"] = project_id
    
    try:
        response = requests.post(
            f"{base_url}/templates/build",
            json=payload,
            headers=headers,
            timeout=300  # 5 minute timeout for build operations
        )
        
        if response.status_code == 400:
            error_data = response.json()
            error_message = error_data.get("message", "Unknown build error")
            
            # Check for alias conflict and provide helpful error message
            if "already taken" in error_message:
                raise BuildException(
                    status_code=400,
                    message=f"Template alias '{template_alias}' is already taken in your project. Please choose a different alias."
                )
            
            raise BuildException(
                status_code=400,
                message=error_message
            )
        
        response.raise_for_status()
        return response.json()
        
    except requests.exceptions.Timeout:
        raise BuildException(
            status_code=408,
            message="Build request timed out. Please try again."
        )
    except requests.exceptions.RequestException as e:
        raise BuildException(
            status_code=500,
            message=f"Failed to request build: {str(e)}"
        )