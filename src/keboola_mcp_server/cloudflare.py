"""
Cloudflare integration for Keboola MCP server.
This module extends the Keboola MCP server to work with Cloudflare OAuth authentication.
"""

import logging
import json
from typing import Dict, Optional, Union, Any, Mapping

from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route, Router, Mount
from starlette.applications import Starlette
from starlette.background import BackgroundTask

from mcp.server.sse import SseServerTransport

from keboola_mcp_server.config import Config
from keboola_mcp_server.server import create_server
from keboola_mcp_server.mcp import KeboolaMcpServer

LOG = logging.getLogger(__name__)


async def verify_token(request: Request) -> Optional[Dict[str, Any]]:
    """
    Verify the token from the request headers.
    
    Args:
        request: The incoming HTTP request
        
    Returns:
        Dict containing user claims if token is valid, None otherwise
    """
    # Check for Authorization header
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.replace('Bearer ', '')
    else:
        # Check for X-Keboola-Token header (coming from Cloudflare Worker)
        token = request.headers.get('X-Keboola-Token')
    
    # If no token is found, check if it's in query params (for backward compatibility)
    if not token:
        token = request.query_params.get('storage_token')
    
    if not token:
        return None
    
    # Get user information from headers
    user_id = request.headers.get('X-Keboola-User-Id', 'unknown-user')
    user_email = request.headers.get('X-Keboola-User-Email', '')
    
    # In a real production scenario, we would validate the token with Keboola API
    # For now, we'll just assume it's valid and create claims
    
    # Create claims with user information and token
    claims = {
        'sub': user_id,
        'email': user_email,
        'token': token,
        'permissions': ['read', 'write'],  # This would come from Keboola in production
    }
    
    return claims


class AuthenticatedSseTransport(SseServerTransport):
    """
    Extended SSE transport that supports authentication.
    """
    async def handle_request(self, request: Request) -> Response:
        """
        Handle an SSE request with authentication.
        """
        # Verify token
        claims = await verify_token(request)
        if not claims:
            return JSONResponse(
                {'error': 'Unauthorized', 'message': 'Invalid or missing authentication'},
                status_code=401,
            )
        
        # Get query parameters and add token
        params = dict(request.query_params)
        if claims.get('token'):
            params['storage_token'] = claims['token']
        
        # Continue with normal SSE handling
        return await super().handle_request(request)


async def create_cloudflare_app(config: Optional[Config] = None) -> Starlette:
    """
    Create a Starlette application for use with Cloudflare Workers.
    
    Args:
        config: Server configuration
        
    Returns:
        Starlette application configured for Cloudflare Workers
    """
    # Create the MCP server
    mcp_server = create_server(config)
    
    # Create authenticated SSE transport
    sse = AuthenticatedSseTransport('/mcp/')
    
    # Create handler for SSE connections
    async def handle_sse(request: Request):
        """
        Handle SSE connection with authentication.
        """
        # Verify token
        claims = await verify_token(request)
        if not claims:
            return JSONResponse(
                {'error': 'Unauthorized', 'message': 'Invalid or missing authentication'},
                status_code=401,
            )
        
        # Get query parameters and add token if needed
        query_params = dict(request.query_params)
        if claims.get('token') and 'storage_token' not in query_params:
            query_params['storage_token'] = claims['token']
        
        # Create new request with updated query params
        scope = request.scope.copy()
        
        # Update query params in scope
        query_string = '&'.join(f"{k}={v}" for k, v in query_params.items())
        scope['query_string'] = query_string.encode()
        
        # Handle SSE connection
        async with sse.connect_sse(scope, request.receive, request._send) as streams:
            await mcp_server._mcp_server.run(
                streams[0],
                streams[1],
                initialization_options=mcp_server._mcp_server.create_initialization_options(),
                state=mcp_server._session_state_factory(query_params),
            )
        
        return Response()
    
    # Create routes
    routes = [
        Route('/', lambda request: JSONResponse({
            'name': 'Keboola MCP Server',
            'version': '1.0.0',
            'transport': 'cloudflare',
        })),
        Route('/health', lambda request: JSONResponse({'status': 'ok'})),
        Route('/sse', endpoint=handle_sse),
        Mount('/mcp/', app=sse.handle_post_message),
    ]
    
    # Create the Starlette application
    app = Starlette(debug=True, routes=routes)
    
    return app


def run_cloudflare_server(config: Optional[Config] = None, host: str = '0.0.0.0', port: int = 8000):
    """
    Run the MCP server with Cloudflare integration.
    
    Args:
        config: Server configuration
        host: Host to bind to
        port: Port to bind to
    """
    import uvicorn
    import asyncio
    
    app = asyncio.run(create_cloudflare_app(config))
    
    uvicorn_config = uvicorn.Config(
        app,
        host=host,
        port=port,
        log_level="info",
    )
    
    server = uvicorn.Server(config=uvicorn_config)
    server.run() 