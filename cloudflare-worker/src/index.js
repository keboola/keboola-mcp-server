import { Router } from 'itty-router';
import { proxyRequest } from './proxy';

// Create router
const router = Router();

/**
 * Extract Keboola token from request
 * @param {Request} request - The incoming request
 * @returns {string|null} The token or null if not found
 */
function extractToken(request) {
  // First try from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Then try from X-Keboola-Token header
  const kebolaHeader = request.headers.get('X-Keboola-Token');
  if (kebolaHeader) {
    return kebolaHeader;
  }
  
  // Finally try from query string
  const url = new URL(request.url);
  return url.searchParams.get('token');
}

// Basic routes
router.get('/', async () => {
  return new Response('Keboola MCP Server on Cloudflare Workers', {
    headers: { 'content-type': 'text/plain' },
  });
});

// Health check endpoint
router.get('/health', async () => {
  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { 'content-type': 'application/json' },
  });
});

// MCP proxy route
router.all('/mcp*', async (request, env) => {
  // Extract token
  const token = extractToken(request);
  
  if (!token) {
    return new Response('Unauthorized: Missing token', { 
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' }
    });
  }
  
  // Create a new request with the token added as a header
  const mcpRequest = new Request(request);
  mcpRequest.headers.set('X-Keboola-Token', token);
  
  // Proxy the request to the Python MCP server
  return await proxyRequest(mcpRequest, env.MCP_SERVER_URL);
});

// Export default handler
export default {
  async fetch(request, env, ctx) {
    // Add CORS headers to all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGINS || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Keboola-Token',
    };
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders
      });
    }
    
    // Try to match routes
    let response;
    try {
      response = await router.handle(request, env, ctx);
    } catch (error) {
      console.error('Error handling request:', error);
      response = new Response('Internal Server Error', { status: 500 });
    }
    
    // Add CORS headers to the response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  },
}; 