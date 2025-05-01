/**
 * Proxy handler for forwarding authenticated requests to the MCP server
 * This handler is called by the OAuth provider with authenticated requests
 */
export async function handleProxy(request, context) {
  try {
    const { env, claims } = context;
    const { MCP_SERVER_URL } = env;
    
    if (!MCP_SERVER_URL) {
      throw new Error('MCP_SERVER_URL not configured in environment');
    }
    
    // Get the URL and create a new request to proxy
    const url = new URL(request.url);
    const mcpUrl = new URL(MCP_SERVER_URL);
    
    // Preserve the path and search params
    mcpUrl.pathname = url.pathname.replace(/^\/mcp/, '');
    mcpUrl.search = url.search;
    
    // Create a new Headers object
    const headers = new Headers(request.headers);
    
    // Add Keboola authentication info from claims if available
    if (claims) {
      // Add user info to headers to pass to MCP server
      headers.set('X-Keboola-User-Id', claims.sub || claims.user_id || '');
      headers.set('X-Keboola-User-Email', claims.email || '');
      
      // If the request contains a token, pass it along as the Storage API token
      if (claims.token) {
        headers.set('X-Keboola-Token', claims.token);
      }
    }
    
    // Clone the request with the new URL and headers
    const proxiedRequest = new Request(mcpUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'follow',
    });
    
    // Forward the request to the MCP server
    return fetch(proxiedRequest);
  } catch (error) {
    return new Response(`Proxy error: ${error.message}`, { status: 500 });
  }
}

/**
 * Authentication handler for the OAuth provider
 * This is used to authenticate users with Keboola
 */
export async function authHandler(request, context) {
  const { searchParams } = new URL(request.url);
  const { env } = context;
  
  // Redirect to Keboola login page
  const keboolaApiUrl = env.KEBOOLA_API_URL || 'https://connection.keboola.com';
  const redirectUrl = `${keboolaApiUrl}/oauth/authorize?client_id=${env.KEBOOLA_CLIENT_ID}&redirect_uri=${encodeURIComponent(env.KEBOOLA_REDIRECT_URI)}&response_type=code`;
  
  return Response.redirect(redirectUrl, 302);
}

/**
 * Callback handler for Keboola OAuth
 * This is called by Keboola after the user authenticates
 */
export async function callbackHandler(request, context) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const { env } = context;
  
  if (!code) {
    return new Response('Authorization code not provided', { status: 400 });
  }
  
  try {
    // Exchange the code for a token
    const keboolaApiUrl = env.KEBOOLA_API_URL || 'https://connection.keboola.com';
    const tokenResponse = await fetch(`${keboolaApiUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: env.KEBOOLA_CLIENT_ID,
        client_secret: env.KEBOOLA_CLIENT_SECRET,
        redirect_uri: env.KEBOOLA_REDIRECT_URI,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Failed to exchange code for token: ${errorText}`);
    }
    
    const tokenData = await tokenResponse.json();
    
    // Create session with the token
    // This would typically involve creating a session in your system
    // and returning a session cookie or token to the client
    
    return new Response('Authentication successful', {
      headers: {
        'Content-Type': 'text/html',
        'Set-Cookie': `keboola_token=${tokenData.access_token}; HttpOnly; Secure; SameSite=Strict; Path=/`,
      },
    });
  } catch (error) {
    return new Response(`Authentication error: ${error.message}`, { status: 500 });
  }
} 