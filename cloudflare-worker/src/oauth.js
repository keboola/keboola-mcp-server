/**
 * Custom OAuth handler for Keboola MCP Server
 * This file implements the OAuth authentication flow for the MCP server
 */

/**
 * Verify the OAuth token
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment variables
 * @returns {Object} - The claims if valid, null otherwise
 */
export async function verifyToken(request, env) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return null;
    }
    
    // For a real implementation, you would verify the token here
    // This would involve calling the Keboola API to validate the token
    // or verifying a JWT token if that's what Keboola issues
    
    // For now, we'll just create a mock claims object
    const claims = {
      sub: 'user-123',
      email: 'user@example.com',
      token: token,
      permissions: ['read', 'write'],
    };
    
    return claims;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Handle the authorize request
 * This would redirect to Keboola's OAuth authorization endpoint
 */
export async function handleAuthorize(request, env) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id') || 'mcp-client';
  const redirectUri = url.searchParams.get('redirect_uri');
  const responseType = url.searchParams.get('response_type');
  const state = url.searchParams.get('state');
  const codeChallenge = url.searchParams.get('code_challenge');
  const codeChallengeMethod = url.searchParams.get('code_challenge_method');
  
  // Validate required parameters
  if (!redirectUri || responseType !== 'code') {
    return new Response('Invalid parameters', { status: 400 });
  }
  
  // In a real implementation, this would redirect to Keboola's OAuth server
  // For now, we'll create a simple login page
  return new Response(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Keboola MCP Login</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; }
          h1 { color: #3D3E3F; }
          .form-group { margin-bottom: 15px; }
          label { display: block; margin-bottom: 5px; font-weight: bold; }
          input[type="text"], input[type="password"] { width: 100%; padding: 8px; box-sizing: border-box; }
          button { background-color: #1372B0; color: white; border: none; padding: 10px 15px; cursor: pointer; }
        </style>
      </head>
      <body>
        <h1>Login to Keboola</h1>
        <p>Authorize access to your Keboola account</p>
        <form action="/authorize/callback" method="post">
          <input type="hidden" name="redirect_uri" value="${redirectUri}" />
          <input type="hidden" name="state" value="${state || ''}" />
          <input type="hidden" name="code_challenge" value="${codeChallenge || ''}" />
          <input type="hidden" name="code_challenge_method" value="${codeChallengeMethod || ''}" />
          <input type="hidden" name="client_id" value="${clientId}" />
          
          <div class="form-group">
            <label for="username">Email</label>
            <input type="text" id="username" name="username" required />
          </div>
          
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required />
          </div>
          
          <button type="submit">Log in and Authorize</button>
        </form>
      </body>
    </html>
  `, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}

/**
 * Handle the authorize callback
 * This is called after the user logs in
 */
export async function handleAuthorizeCallback(request, env) {
  // In a real implementation, you would validate the credentials with Keboola
  // For now, we'll assume the login is successful
  
  const formData = await request.formData();
  const redirectUri = formData.get('redirect_uri');
  const state = formData.get('state');
  const codeChallenge = formData.get('code_challenge');
  const codeChallengeMethod = formData.get('code_challenge_method');
  const clientId = formData.get('client_id');
  
  // Generate an authorization code
  // In a real implementation, this would be tied to the code challenge
  const authCode = generateAuthCode();
  
  // Store the code and PKCE params for later verification
  // In a real implementation, you would store this in a database or KV store
  // For now, we'll just log it
  console.log('Auth code:', authCode, 'Code challenge:', codeChallenge);
  
  // Redirect to the client's redirect URI with the code and state
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', authCode);
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }
  
  return Response.redirect(redirectUrl.toString(), 302);
}

/**
 * Handle the token exchange
 * This is called by the client to exchange the auth code for a token
 */
export async function handleToken(request, env) {
  try {
    const contentType = request.headers.get('Content-Type');
    
    let grantType, code, clientId, redirectUri, codeVerifier;
    
    if (contentType?.includes('application/json')) {
      const body = await request.json();
      grantType = body.grant_type;
      code = body.code;
      clientId = body.client_id;
      redirectUri = body.redirect_uri;
      codeVerifier = body.code_verifier;
    } else {
      const formData = await request.formData();
      grantType = formData.get('grant_type');
      code = formData.get('code');
      clientId = formData.get('client_id');
      redirectUri = formData.get('redirect_uri');
      codeVerifier = formData.get('code_verifier');
    }
    
    // Validate required parameters
    if (grantType !== 'authorization_code' || !code) {
      return new Response('Invalid parameters', { status: 400 });
    }
    
    // In a real implementation, you would validate the code and code verifier
    // and exchange it for a token with Keboola
    // For now, we'll just generate a token
    
    const accessToken = generateToken();
    const refreshToken = generateToken();
    
    return new Response(JSON.stringify({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
    }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(`Token error: ${error.message}`, { status: 500 });
  }
}

/**
 * Generate a random string for tokens and auth codes
 */
function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a random authorization code
 */
function generateAuthCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
} 