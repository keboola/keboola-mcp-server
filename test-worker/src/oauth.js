/**
 * OAuth handler for Keboola MCP Server
 */

// Google OAuth configuration
const googleOAuthConfig = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  userInfoEndpoint: 'https://www.googleapis.com/oauth2/v3/userinfo',
  scope: 'openid email profile',
};

// Helper function to generate random string for state and PKCE
function generateRandomString(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    result += chars[values[i] % chars.length];
  }
  return result;
}

/**
 * Handle OAuth authorization initiation
 * Redirects the user to Google's authorization endpoint
 */
export async function handleAuthorize(request, env) {
  const url = new URL(request.url);
  
  // Extract OAuth parameters
  const clientId = url.searchParams.get('client_id') || env.GOOGLE_CLIENT_ID;
  const redirectUri = url.searchParams.get('redirect_uri') || env.GOOGLE_REDIRECT_URI;
  const responseType = url.searchParams.get('response_type') || 'code';
  const state = url.searchParams.get('state') || generateRandomString();
  
  // Generate PKCE code challenge
  const codeVerifier = generateRandomString(64);
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Store the state and code verifier in cookies for verification later
  const responseHeaders = new Headers();
  responseHeaders.append('Set-Cookie', `oauth_state=${state}; HttpOnly; Path=/; SameSite=Lax; Max-Age=600`);
  responseHeaders.append('Set-Cookie', `code_verifier=${codeVerifier}; HttpOnly; Path=/; SameSite=Lax; Max-Age=600`);
  
  // Configure Google OAuth URL
  const authUrl = new URL(googleOAuthConfig.authorizationEndpoint);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', responseType);
  authUrl.searchParams.set('scope', googleOAuthConfig.scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('access_type', 'offline');
  
  // Redirect to Google's authorization page
  return Response.redirect(authUrl.toString(), 302);
}

/**
 * Handle callback from Google OAuth
 */
export async function handleAuthorizeCallback(request, env) {
  const url = new URL(request.url);
  
  // Extract parameters from the callback
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  
  // Check for errors
  if (error) {
    return new Response(`Authorization error: ${error}`, { status: 400 });
  }
  
  if (!code || !state) {
    return new Response('Invalid callback parameters', { status: 400 });
  }
  
  // Get the state from cookies to verify
  const cookies = request.headers.get('Cookie') || '';
  const cookieState = cookies.split(';').find(c => c.trim().startsWith('oauth_state='))?.split('=')[1];
  const codeVerifier = cookies.split(';').find(c => c.trim().startsWith('code_verifier='))?.split('=')[1];
  
  if (!cookieState || state !== cookieState) {
    return new Response('State mismatch. Possible CSRF attack.', { status: 400 });
  }
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(googleOAuthConfig.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      return new Response(`Token exchange error: ${error}`, { status: 400 });
    }
    
    const tokens = await tokenResponse.json();
    
    // Get user info with the access token
    const userInfoResponse = await fetch(googleOAuthConfig.userInfoEndpoint, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });
    
    if (!userInfoResponse.ok) {
      return new Response('Failed to get user info', { status: 400 });
    }
    
    const userInfo = await userInfoResponse.json();
    
    // At this point you would typically:
    // 1. Verify the user's email against an allowed list
    // 2. Store the user session
    // 3. Redirect to the application
    
    // For now, let's create a simple session token
    const sessionToken = generateRandomString();
    
    // In a production environment, store this in a database or KV store with the user's information
    // For this example, we'll just set a cookie
    return new Response(`
      <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
            .success { color: green; }
          </style>
        </head>
        <body>
          <h1 class="success">Authentication Successful!</h1>
          <p>You have been authenticated as: ${userInfo.email}</p>
          <p>You can now close this window and return to the application.</p>
          <script>
            // You can add code here to communicate with the parent window if needed
          </script>
        </body>
      </html>
    `, {
      headers: {
        'Content-Type': 'text/html',
        'Set-Cookie': `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600`
      }
    });
  } catch (error) {
    return new Response(`Error during authentication: ${error.message}`, { status: 500 });
  }
}

/**
 * Verify Google ID token 
 */
async function verifyGoogleToken(token) {
  try {
    // For Cloudflare Workers, we need to do basic JWT validation
    // In production, you should use a more robust verification method
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload (second part of JWT)
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }
    
    return payload;
  } catch (e) {
    console.error('Error verifying token:', e);
    return null;
  }
}

/**
 * Extract user claims from a session token or OAuth token
 */
export async function extractUserClaims(request, env) {
  // Check for session cookie first
  const cookies = request.headers.get('Cookie') || '';
  const sessionToken = cookies.split(';').find(c => c.trim().startsWith('session='))?.split('=')[1];
  
  if (sessionToken) {
    // In a production environment, look up the session in a database or KV store
    // For this example, we'll just assume it's valid
    return {
      authenticated: true,
      method: 'session',
      // Add user information here in production
    };
  }
  
  // Check for OAuth token in Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const claims = await verifyGoogleToken(token);
    
    if (claims) {
      return {
        authenticated: true,
        method: 'oauth',
        ...claims
      };
    }
  }
  
  return null;
} 