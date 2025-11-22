import type { SandboxManager } from './sandbox-manager.js';
import type { MCPServerConfig } from './types.js';

/**
 * Helper utilities for MCP integration
 */

/**
 * Creates a standard MCP configuration for common use cases
 */
export function createMCPConfig(options: {
    exaApiKey?: string;
    githubApiKey?: string;
    enableFilesystem?: boolean;
}): MCPServerConfig {
    const config: MCPServerConfig = {};

    if (options.exaApiKey) {
        config.exa = { apiKey: options.exaApiKey };
    }

    if (options.githubApiKey) {
        config.github = { apiKey: options.githubApiKey };
    }

    if (options.enableFilesystem) {
        config.filesystem = true;
    }

    return config;
}

/**
 * Gets MCP gateway credentials from a sandbox manager
 */
export async function getMCPCredentials(sandboxManager: SandboxManager): Promise<{
    mcpUrl: string;
    mcpToken: string;
}> {
    return {
        mcpUrl: sandboxManager.getMcpUrl(),
        mcpToken: await sandboxManager.getMcpToken(),
    };
}

/**
 * Checks if MCP gateway is accessible
 */
export async function checkMCPHealth(mcpUrl: string, mcpToken: string): Promise<boolean> {
    try {
        const response = await fetch(mcpUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${mcpToken}`,
            },
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}
