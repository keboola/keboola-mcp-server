"""MCP server implementation for Keboola Connection."""

import logging

from typing import Optional

from mcp.server.fastmcp import FastMCP

from keboola_mcp_server.component_tools import add_component_tools
from keboola_mcp_server.client import KeboolaClient
from keboola_mcp_server.component_tools import add_component_tools
from keboola_mcp_server.config import Config
from keboola_mcp_server.jobs_tools import add_jobs_tools
from keboola_mcp_server.mcp import (
    KeboolaMcpServer,
    SessionParams,
    SessionState,
    SessionStateFactory,
)
from keboola_mcp_server.sql_tools import WorkspaceManager, add_sql_tools, query_table
from keboola_mcp_server.storage_tools import add_storage_tools

logger = logging.getLogger(__name__)


def _create_session_state_factory(config: Optional[Config] = None) -> SessionStateFactory:
    def _(params: SessionParams) -> SessionState:
        logger.info(f"Creating SessionState for params: {params.keys()}.")

        if not config:
            cfg = Config.from_dict(params)
        else:
            cfg = config.replace_by(params)

        logger.info(f"Creating SessionState from config: {cfg}.")

        state: SessionState = {}
        # Create Keboola client instance
        try:
            client = KeboolaClient(cfg.storage_token, cfg.storage_api_url)
            state[KeboolaClient.STATE_KEY] = client
            logger.info("Successfully initialized Storage API client.")
        except Exception as e:
            logger.error(f"Failed to initialize Keboola client: {e}")
            raise

        try:
            workspace_manager = WorkspaceManager(client, cfg.workspace_schema)
            state[WorkspaceManager.STATE_KEY] = workspace_manager
            logger.info("Successfully initialized Storage API Workspace manager.")
        except Exception as e:
            logger.error(f"Failed to initialize Storage API Workspace manager: {e}")
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
    mcp = KeboolaMcpServer(
        "Keboola Explorer", session_state_factory=_create_session_state_factory(config)
    )
    # Add component tools to the server inplace.
    add_component_tools(mcp)
    # Add jobs tools to the server inplace.
    add_jobs_tools(mcp)

    add_storage_tools(mcp)
    add_sql_tools(mcp)

    return mcp
