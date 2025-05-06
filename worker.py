"""
Python MCP Server for Cloudflare Workers.

This module provides a Cloudflare Worker implementation of the Keboola MCP server
that supports both the Streamable HTTP and SSE transport methods.
"""

from keboola_mcp_server.config import Config
from keboola_mcp_server.mcp import KeboolaMcpServer
import asyncio
from starlette.applications import Starlette
from starlette.routing import Route, Mount
from starlette.responses import JSONResponse

# Create a config instance
config = Config.from_dict({
    'storage_api_url': 'https://connection.keboola.com',
    'log_level': 'INFO',
})

# Create the MCP server
mcp = KeboolaMcpServer(name='Keboola MCP Server', instructions='MCP server for interacting with Keboola Connection')

# Helper function to create session state from request parameters
def create_session_state(params):
    """Create a session state from request parameters."""
    state = dict(params)
    # Add any additional state initialization here
    return state

# Configure MCP server
mcp._session_state_factory = create_session_state

# Register MCP tools
@mcp.tool()
def list_buckets(ctx):
    """List all buckets in the project."""
    # Note: In a real implementation, you'd use the Keboola Storage API
    # client = ctx.session.state.get('client')
    # return client.buckets.list()
    
    # For testing, return a mock response
    return [
        {"id": "in.c-test", "name": "test", "stage": "in", "description": "Test bucket"},
        {"id": "out.c-results", "name": "results", "stage": "out", "description": "Results bucket"}
    ]

@mcp.tool()
def execute_query(ctx, query, db_name=None):
    """Execute a SQL query."""
    # Note: In a real implementation, you'd execute the query using the Storage API
    # client = ctx.session.state.get('client')
    # return client.query(query, db_name)
    
    # For testing, return a mock response
    return {
        "status": "success",
        "rows_affected": 10,
        "result": [
            {"id": 1, "name": "Test Row 1"},
            {"id": 2, "name": "Test Row 2"}
        ]
    }

# Create Starlette application that supports both Streamable HTTP and SSE transports
async def create_app():
    """Create the Starlette application for the Cloudflare Worker."""
    # Create SSE transport
    sse_transport = mcp._create_sse_transport('/sse-messages/')
    
    # Create route handlers
    async def health_check(request):
        """Health check endpoint."""
        return JSONResponse({"status": "ok"})
    
    async def info(request):
        """Information endpoint."""
        return JSONResponse({
            "name": "Keboola MCP Server",
            "version": "1.0.0",
            "transport": ["sse", "streamable_http"],
            "provider": "cloudflare"
        })
    
    async def handle_sse(request):
        """Handle SSE connections."""
        async with sse_transport.connect_sse(request.scope, request.receive, request._send) as streams:
            await mcp._mcp_server.run(
                streams[0],
                streams[1],
                initialization_options=mcp._mcp_server.create_initialization_options(),
                state=create_session_state(dict(request.query_params))
            )
    
    # Define routes for both transport methods
    routes = [
        Route("/", endpoint=info),
        Route("/health", endpoint=health_check),
        
        # SSE transport (legacy)
        Route("/sse", endpoint=handle_sse),
        Mount("/sse-messages/", app=sse_transport.handle_post_message),
        
        # Streamable HTTP transport (new)
        Route("/mcp", endpoint=lambda request: mcp.serve("/mcp").fetch(request)),
    ]
    
    # Create the application
    app = Starlette(debug=True, routes=routes)
    return app

# Cloudflare Worker entry point
async def fetch(request):
    """Cloudflare Worker fetch event handler."""
    app = await create_app()
    return await app(request) 