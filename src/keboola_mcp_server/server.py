"""MCP server implementation for Keboola Connection."""

import logging
from typing import Optional

from mcp.server.fastmcp import FastMCP

from keboola_mcp_server.client import KeboolaClient
from keboola_mcp_server.config import Config
from keboola_mcp_server.mcp import KeboolaMcpServer, SessionParams, SessionState, SessionStateFactory
from keboola_mcp_server.tools.components import add_component_tools
from keboola_mcp_server.tools.doc import add_doc_tools
from keboola_mcp_server.tools.jobs import add_job_tools
from keboola_mcp_server.tools.sql import WorkspaceManager, add_sql_tools
from keboola_mcp_server.tools.storage import add_storage_tools

LOG = logging.getLogger(__name__)


def _create_session_state_factory(config: Optional[Config] = None) -> SessionStateFactory:
    def _(params: SessionParams) -> SessionState:
        LOG.info(f'Creating SessionState for params: {params.keys()}.')

        if not config:
            cfg = Config.from_dict(params)
        else:
            cfg = config.replace_by(params)

        LOG.info(f'Creating SessionState from config: {cfg}.')

        state: SessionState = {}
        # Create Keboola client instance
        try:
            # Prioritize jwt_token, fallback to storage_token, then error if neither is present
            token_to_use = cfg.jwt_token if cfg.jwt_token else cfg.storage_token
            LOG.info(f"token_to_use: {token_to_use}")
            if not token_to_use:
                # Log and raise an error if no token is available
                LOG.error('Failed to initialize Keboola client: Missing jwt_token or storage_token.')
                raise ValueError('Authentication token (jwt_token or storage_token) is required.')

            client = KeboolaClient(token_to_use, cfg.storage_api_url)
            state[KeboolaClient.STATE_KEY] = client
            LOG.info('Successfully initialized Storage API client.')
        except Exception as e:
            LOG.error(f'Failed to initialize Keboola client: {e}')
            raise

        try:
            workspace_manager = WorkspaceManager(client, cfg.workspace_schema)
            state[WorkspaceManager.STATE_KEY] = workspace_manager
            LOG.info('Successfully initialized Storage API Workspace manager.')
        except Exception as e:
            LOG.error(f'Failed to initialize Storage API Workspace manager: {e}')
            raise

        return state

    return _


def create_server(config: Optional[Config] = None) -> FastMCP:
    """Create and configure the MCP server.

    Args:
        config: Server configuration. If None, loads from environment.

    Returns:
        Configured FastMCP server instance
    """
    # Initialize FastMCP server with system instructions
    mcp = KeboolaMcpServer('Keboola Explorer', session_state_factory=_create_session_state_factory(config))

    add_component_tools(mcp)
    add_doc_tools(mcp)
    add_job_tools(mcp)
    add_storage_tools(mcp)
    add_sql_tools(mcp)

    return mcp
