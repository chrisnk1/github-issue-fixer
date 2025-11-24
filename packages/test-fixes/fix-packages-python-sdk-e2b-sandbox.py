from typing import Optional, Dict, Any, List
from datetime import datetime
import asyncio
import logging
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

class AutoPauseConfig(BaseModel):
    """Configuration for auto-pause behavior"""
    kill_on_pause: bool = Field(default=True, description="Kill all processes when auto-pausing")
    graceful_timeout_secs: int = Field(default=30, description="Timeout for graceful shutdown in seconds")

class SandboxConfig(BaseModel):
    """Configuration for sandbox creation"""
    auto_pause: bool = Field(default=False, description="Enable auto-pause functionality")
    auto_pause_config: Optional[AutoPauseConfig] = Field(default=None, description="Auto-pause configuration")
    timeout: Optional[int] = Field(default=None, description="Sandbox timeout in seconds")

class Sandbox:
    def __init__(self, sandbox_id: str, config: SandboxConfig):
        self.sandbox_id = sandbox_id
        self.config = config
        self._auto_pause_manager = None
        
    @classmethod
    def beta_create(cls, 
                   auto_pause: bool = False,
                   auto_paused: bool = False,  # Legacy parameter for backward compatibility
                   timeout: Optional[int] = None,
                   kill_on_pause: bool = True,
                   **kwargs) -> 'Sandbox':
        """
        Create a new sandbox with beta features
        
        Args:
            auto_pause: Enable auto-pause functionality
            auto_paused: Legacy parameter (maps to auto_pause)
            timeout: Sandbox timeout in seconds
            kill_on_pause: Kill processes on auto-pause (default: True)
            **kwargs: Additional configuration options
            
        Returns:
            Sandbox instance
            
        Examples:
            # Kill processes on auto-pause (default behavior)
            sandbox = Sandbox.beta_create(auto_pause=True, kill_on_pause=True)
            
            # Keep processes for resume
            sandbox = Sandbox.beta_create(auto_pause=True, kill_on_pause=False)
        """
        # Handle legacy parameter
        if auto_paused and not auto_pause:
            auto_pause = True
            logger.warning("auto_paused parameter is deprecated, use auto_pause instead")
        
        auto_pause_config = AutoPauseConfig(
            kill_on_pause=kill_on_pause,
            graceful_timeout_secs=kwargs.get('graceful_timeout_secs', 30)
        ) if auto_pause else None
        
        config = SandboxConfig(
            auto_pause=auto_pause,
            auto_pause_config=auto_pause_config,
            timeout=timeout
        )
        
        # Create sandbox via API call
        response = cls._create_sandbox_api(config)
        return cls(response['sandbox_id'], config)
    
    @classmethod
    def connect(cls, sandbox_id: str) -> 'Sandbox':
        """
        Connect to an existing sandbox
        
        Args:
            sandbox_id: The sandbox ID to connect to
            
        Returns:
            Sandbox instance
        """
        # Get sandbox info from API
        info = cls._get_sandbox_info(sandbox_id)
        config = SandboxConfig(
            auto_pause=info.get('auto_pause', False),
            auto_pause_config=info.get('auto_pause_config'),
            timeout=info.get('timeout')
        )
        return cls(sandbox_id, config)
    
    def commands(self) -> 'CommandManager':
        """Get the command manager for this sandbox"""
        return CommandManager(self)
    
    def _create_sandbox_api(cls, config: SandboxConfig) -> Dict[str, Any]:
        """Internal method to create sandbox via API"""
        # Implementation would make HTTP request to sandbox API
        pass
    
    def _get_sandbox_info(cls, sandbox_id: str) -> Dict[str, Any]:
        """Internal method to get sandbox info via API"""
        # Implementation would make HTTP request to sandbox API
        pass

class CommandManager:
    def __init__(self, sandbox: Sandbox):
        self.sandbox = sandbox
        
    async def list(self) -> List[Dict[str, Any]]:
        """
        List all running commands in the sandbox
        
        Returns:
            List of command dictionaries with pid, name, cmd, etc.
            
        Note:
            After auto-resume, this will return the same processes that were
            running before pause if kill_on_pause=False, or an empty list
            if kill_on_pause=True (default).
        """
        # Make API call to list processes
        response = await self._api_list_commands()
        return response.get('processes', [])
    
    async def run(self, cmd: str, timeout: Optional[int] = None) -> Dict[str, Any]:
        """
        Run a command in the sandbox
        
        Args:
            cmd: Command to run
            timeout: Command timeout in seconds
            
        Returns:
            Command result dictionary
        """
        # Make API call to run command
        return await self._api_run_command(cmd, timeout)
    
    async def _api_list_commands(self) -> Dict[str, Any]:
        """Internal method to list commands via API"""
        # Implementation would make HTTP request to command API
        pass
    
    async def _api_run_command(self, cmd: str, timeout: Optional[int]) -> Dict[str, Any]:
        """Internal method to run command via API"""
        # Implementation would make HTTP request to command API
        pass