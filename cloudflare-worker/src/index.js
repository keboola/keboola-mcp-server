import { Router } from 'itty-router';
import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { handleProxy } from './proxy';
import { 
  handleAuthorize, 
  handleAuthorizeCallback, 
  handleToken, 
  verifyToken 
} from './oauth';
import { proxyRequest } from './proxy';

// Create router
const router = Router();

/**
 * Create a custom auth handler that integrates with Keboola OAuth
 */
const customAuthHandler = {
  /**
   * Handle authorization endpoint
   */
  handleAuthorize: async (request, context) => {
    return handleAuthorize(request, context.env);
  },

  /**
   * Handle the token endpoint
   */
  handleToken: async (request, context) => {
    return handleToken(request, context.env);
  },

  /**
   * Extract claims from a request
   */
  extractClaims: async (request, context) => {
    const claims = await verifyToken(request, context.env);
    return claims;
  },

  /**
   * Handle registration
   */
  handleRegister: async (request, context) => {
    // In a production implementation, this would handle client registration
    // For now, we'll return a mock client
    return new Response(JSON.stringify({
      client_id: 'mcp-client-id',
      client_secret: 'mcp-client-secret',
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Create OAuth provider 
 * - apiRoute: Route for the MCP server
 * - apiHandler: Proxy handler for MCP requests
 * - defaultHandler: Default handler for non-OAuth routes
 * - authorizeEndpoint: OAuth authorization endpoint
 * - tokenEndpoint: OAuth token endpoint
 * - clientRegistrationEndpoint: OAuth client registration endpoint
 */
const provider = new OAuthProvider({
  apiRoute: '/mcp',
  apiHandler: handleProxy,
  defaultHandler: async (request) => {
    return new Response('Keboola MCP Server: OAuth Authentication Enabled', {
      headers: { 'content-type': 'text/plain' },
    });
  },
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/token',
  clientRegistrationEndpoint: '/register',
  authHandler: customAuthHandler,
});

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

// Custom authorize callback route
router.post('/authorize/callback', async (request, env, ctx) => {
  return handleAuthorizeCallback(request, env);
});

// Admin route to add user mappings
router.post('/admin/user-mapping', async (request, env) => {
  // In a real implementation, you would validate admin credentials
  try {
    const { email, kebolaToken } = await request.json();
    
    if (!email || !kebolaToken) {
      return new Response('Missing required fields', { status: 400 });
    }
    
    // Store in KV
    await USER_MAPPINGS.put(email, kebolaToken);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response('Invalid request', { status: 400 });
  }
});

// OAuth provider handles all OAuth-related routes and MCP routes
export default {
  async fetch(request, env, ctx) {
    // Add CORS headers to all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGINS || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders
      });
    }
    
    // Try to match routes first
    const url = new URL(request.url);
    
    // Health check and basic routes
    if (url.pathname === '/health' || url.pathname === '/' || url.pathname === '/authorize/callback' || url.pathname.startsWith('/admin/')) {
      const response = await router.handle(request, env);
      // Add CORS headers to the response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }
    
    // Let the OAuth provider handle OAuth-related requests
    if (url.pathname === '/authorize' || url.pathname === '/token' || url.pathname === '/register') {
      const response = await provider.handleRequest(request, env);
      // Add CORS headers to the response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }
    
    // If /mcp path, try to handle as MCP request
    if (url.pathname.startsWith('/mcp')) {
      // Let the OAuth provider handle it, which will delegate to our handler if authenticated
      const response = await provider.handleRequest(request, env);
      
      // Add CORS headers
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
    }
    
    // If we get here, it means no routes matched
    // Proxy the request to the Python MCP server
    try {
      const claims = await verifyToken(request);
      
      if (!claims) {
        return new Response('Unauthorized', { 
          status: 401,
          headers: {
            ...corsHeaders,
            'WWW-Authenticate': 'Bearer'
          }
        });
      }
      
      // Add Keboola-specific headers to the request
      const mcpRequest = new Request(request);
      mcpRequest.headers.set('X-Keboola-User-Email', claims.email);
      mcpRequest.headers.set('X-Keboola-Token', claims.keboola_token);
      
      // Proxy the request to the Python MCP server
      return await proxyRequest(mcpRequest, env.MCP_SERVER_URL, corsHeaders);
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: corsHeaders
      });
    }
  },
}; 