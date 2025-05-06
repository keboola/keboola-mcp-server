/**
 * Keboola MCP Server Worker with OAuth support
 */
import { handleAuthorize, handleAuthorizeCallback, extractUserClaims } from './oauth';

// Constants
const MCP_SERVER_URL = "https://mcp.canary-orion.keboola.dev";

// Extract token from request (check Authorization header, X-Keboola-Token header, or query param)
function extractToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  const kebolaHeader = request.headers.get('X-Keboola-Token');
  if (kebolaHeader) {
    return kebolaHeader;
  }
  
  const url = new URL(request.url);
  return url.searchParams.get('token');
}

// Proxy a request to the MCP server
async function proxyToMcpServer(request, token, corsHeaders) {
  try {
    // Create a new URL object from the MCP server URL
    const mcpUrl = new URL(MCP_SERVER_URL);
    
    // Get the path from the incoming request
    const url = new URL(request.url);
    const path = url.pathname.startsWith('/mcp') ? url.pathname.substring(4) : url.pathname;
    
    // Construct the full target URL
    mcpUrl.pathname = path;
    mcpUrl.search = url.search;
    
    // Clone the request headers
    const headers = new Headers(request.headers);
    
    // Add the token as a header
    if (token) {
      headers.set('X-Keboola-Token', token);
    }
    
    // Create the new request to forward
    const proxyRequest = new Request(mcpUrl.toString(), {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'follow',
    });
    
    // Forward the request to the MCP server
    const response = await fetch(proxyRequest);
    
    // Clone the response with CORS headers
    const responseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(`Proxy error: ${error.message}`, {
      status: 502,
      headers: corsHeaders,
    });
  }
}

// Define event handler for all incoming requests
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Add CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Keboola-Token',
    };
    
    // Handle OPTIONS requests for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // Home route
      if (url.pathname === '/' || url.pathname === '') {
        return new Response('Keboola MCP Server Worker with OAuth Support', {
          headers: { 'Content-Type': 'text/plain', ...corsHeaders }
        });
      }
      
      // Health check
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      // OAuth authorize endpoint
      if (url.pathname === '/authorize') {
        return await handleAuthorize(request, env);
      }
      
      // OAuth callback endpoint
      if (url.pathname === '/authorize/callback') {
        return await handleAuthorizeCallback(request, env);
      }
      
      // OAuth token info endpoint
      if (url.pathname === '/auth/whoami') {
        const claims = await extractUserClaims(request, env);
        
        if (!claims) {
          // Try with the Keboola token
          const token = extractToken(request);
          if (token) {
            return new Response(JSON.stringify({
              authenticated: true,
              method: 'token',
              token_prefix: token.substring(0, 5) + '...'
            }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          
          return new Response(JSON.stringify({
            authenticated: false,
            message: 'Not authenticated'
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        
        return new Response(JSON.stringify(claims), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      // MCP info route - returns info about the worker instead of proxying
      if (url.pathname === '/mcp/info') {
        // Check authentication (either OAuth or token)
        const claims = await extractUserClaims(request, env);
        const token = extractToken(request);
        
        if (!claims && !token) {
          return new Response('Unauthorized: Missing authentication', { 
            status: 401,
            headers: { 'WWW-Authenticate': 'Bearer', ...corsHeaders }
          });
        }
        
        // Return a simple success response
        return new Response(JSON.stringify({
          status: 'success',
          message: 'Worker is functioning correctly with OAuth support',
          mcp_server_url: MCP_SERVER_URL,
          auth_method: claims ? 'oauth' : 'token',
          user: claims ? claims.email : null,
          token_prefix: token ? token.substring(0, 5) + '...' : null
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      // MCP proxy route - proxy to the real MCP server
      if (url.pathname.startsWith('/mcp')) {
        // Check authentication (either OAuth or token)
        const claims = await extractUserClaims(request, env);
        const token = extractToken(request);
        
        if (!claims && !token) {
          return new Response('Unauthorized: Missing authentication', { 
            status: 401,
            headers: { 'WWW-Authenticate': 'Bearer', ...corsHeaders }
          });
        }
        
        // Proxy the request to the MCP server
        return await proxyToMcpServer(request, token, corsHeaders);
      }
      
      // 404 for everything else
      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders
      });
    } catch (error) {
      // Handle any errors
      return new Response(`Error: ${error.message}`, {
        status: 500,
        headers: corsHeaders
      });
    }
  }
}; 