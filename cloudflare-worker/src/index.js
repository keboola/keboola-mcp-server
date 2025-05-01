import { Router } from 'itty-router';
import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { handleProxy } from './proxy';
import { 
  handleAuthorize, 
  handleAuthorizeCallback, 
  handleToken, 
  verifyToken 
} from './oauth';

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

// OAuth provider handles all OAuth-related routes and MCP routes
export default {
  async fetch(request, env, ctx) {
    try {
      // Try to handle with the router first
      const url = new URL(request.url);
      
      // Return health check and basic routes
      if (url.pathname === '/' || 
          url.pathname === '/health' ||
          url.pathname === '/authorize/callback') {
        return router.handle(request, env, ctx);
      }
      
      // Otherwise, use the OAuth provider to handle the request
      return provider.fetch(request, env, ctx);
    } catch (err) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  },
}; 