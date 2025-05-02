/**
 * Custom OAuth handler for Keboola MCP Server
 * This file implements the OAuth authentication flow for the MCP server
 */

import * as oauth from 'oauth4webapi'

// Google OAuth configuration
const googleConfig = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  userInfoEndpoint: 'https://www.googleapis.com/oauth2/v3/userinfo',
  scope: 'openid email profile',
}

// Helper to create URL-safe tokens
function generateRandomString(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const values = new Uint8Array(length)
  crypto.getRandomValues(values)
  for (let i = 0; i < length; i++) {
    result += chars[values[i] % chars.length]
  }
  return result
}

// Verify Google ID token
async function verifyGoogleToken(token) {
  try {
    // For Cloudflare Workers, we need to do manual JWT validation
    // since the Google Auth library doesn't work in this environment
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    // Decode payload (second part of JWT)
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) {
      return null
    }
    
    // In production, you should also verify the signature with JWKS
    // For the example, we'll trust the token structure
    
    return payload
  } catch (e) {
    console.error('Error verifying token:', e)
    return null
  }
}

/**
 * Extract claims from an Authorization header
 * @param {Request} request - The incoming request
 * @returns {Promise<Object|null>} The claims object or null if invalid
 */
export async function verifyToken(request) {
  // Get token from Authorization header
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  
  const token = authHeader.substring(7)
  const claims = await verifyGoogleToken(token)
  
  if (!claims) {
    return null
  }
  
  // Get the Keboola API token for this user from KV storage
  // Note: USER_MAPPINGS must be bound in wrangler.toml
  const kebolaToken = await USER_MAPPINGS.get(claims.email)
  
  if (!kebolaToken) {
    console.error(`No Keboola token found for email: ${claims.email}`)
    return null
  }
  
  // Add the Keboola token to the claims
  return {
    ...claims,
    keboola_token: kebolaToken,
    // Add appropriate permissions based on your requirements
    scope: 'keboola:read keboola:write'
  }
}

/**
 * Handle the OAuth authorization request
 */
export async function handleAuthorize(request, env) {
  const url = new URL(request.url)
  
  // Extract OAuth parameters
  const clientId = url.searchParams.get('client_id')
  const redirectUri = url.searchParams.get('redirect_uri')
  const responseType = url.searchParams.get('response_type')
  const scope = url.searchParams.get('scope')
  const state = url.searchParams.get('state')
  
  // Validate required parameters
  if (!clientId || !redirectUri || responseType !== 'code' || !state) {
    return new Response('Invalid OAuth request parameters', { status: 400 })
  }
  
  // Generate PKCE code challenge (Optional but recommended)
  const codeVerifier = generateRandomString(64)
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  
  // Store the state and code verifier in cookies for verification later
  const responseHeaders = new Headers()
  responseHeaders.append('Set-Cookie', `oauth_state=${state}; HttpOnly; Path=/; SameSite=Lax; Max-Age=600`)
  responseHeaders.append('Set-Cookie', `code_verifier=${codeVerifier}; HttpOnly; Path=/; SameSite=Lax; Max-Age=600`)
  
  // Configure Google OAuth URL
  const authUrl = new URL(googleConfig.authorizationEndpoint)
  authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', googleConfig.scope)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('access_type', 'offline')
  
  // Redirect to Google's authorization page
  return Response.redirect(authUrl.toString(), 302)
}

/**
 * Handle the callback from Google OAuth
 */
export async function handleAuthorizeCallback(request, env) {
  const url = new URL(request.url)
  
  // Extract parameters from the callback
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  
  // Check for errors
  if (error) {
    return new Response(`Authorization error: ${error}`, { status: 400 })
  }
  
  if (!code || !state) {
    return new Response('Invalid callback parameters', { status: 400 })
  }
  
  // Get the state from cookies to verify
  const cookies = request.headers.get('Cookie') || ''
  const cookieState = cookies.split(';').find(c => c.trim().startsWith('oauth_state='))?.split('=')[1]
  const codeVerifier = cookies.split(';').find(c => c.trim().startsWith('code_verifier='))?.split('=')[1]
  
  if (!cookieState || state !== cookieState) {
    return new Response('State mismatch. Possible CSRF attack.', { status: 400 })
  }
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(googleConfig.tokenEndpoint, {
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
    })
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error('Token exchange error:', error)
      return new Response('Failed to exchange code for tokens', { status: 400 })
    }
    
    const tokens = await tokenResponse.json()
    
    // Get user info with the access token
    const userInfoResponse = await fetch(googleConfig.userInfoEndpoint, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    })
    
    if (!userInfoResponse.ok) {
      return new Response('Failed to get user info', { status: 400 })
    }
    
    const userInfo = await userInfoResponse.json()
    
    // Check if this user is authorized to use the Keboola MCP server
    const kebolaToken = await USER_MAPPINGS.get(userInfo.email)
    
    if (!kebolaToken) {
      // User not authorized
      return new Response(`User ${userInfo.email} is not authorized to use this application`, { 
        status: 403,
        headers: {
          'Content-Type': 'text/html'
        }
      })
    }
    
    // Generate authorization code for the client
    const authCode = generateRandomString(32)
    
    // Store the tokens and user info for later token exchange
    // In a real implementation, you'd use a more secure storage
    await USER_MAPPINGS.put(`auth_code:${authCode}`, JSON.stringify({
      tokens,
      userInfo,
      kebolaToken,
      // Set expiration for the auth code (10 minutes)
      expires: Date.now() + 600000
    }), { expirationTtl: 600 })
    
    // Parse the original redirect_uri from cookies
    const redirectUri = cookies.split(';').find(c => c.trim().startsWith('original_redirect_uri='))?.split('=')[1]
    
    if (!redirectUri) {
      return new Response('Missing redirect URI', { status: 400 })
    }
    
    // Redirect back to the client with the authorization code
    const clientRedirectUrl = new URL(decodeURIComponent(redirectUri))
    clientRedirectUrl.searchParams.set('code', authCode)
    clientRedirectUrl.searchParams.set('state', state)
    
    return Response.redirect(clientRedirectUrl.toString(), 302)
  } catch (error) {
    console.error('Error in authorization callback:', error)
    return new Response('Server error during authorization', { status: 500 })
  }
}

/**
 * Handle token exchange
 */
export async function handleToken(request, env) {
  // Parse form data from request
  const formData = await request.formData()
  
  const grantType = formData.get('grant_type')
  const code = formData.get('code')
  const redirectUri = formData.get('redirect_uri')
  const clientId = formData.get('client_id')
  
  // Validate client_id
  if (clientId !== env.CLIENT_ID) {
    return new Response(JSON.stringify({ error: 'invalid_client' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  if (grantType === 'authorization_code' && code) {
    // Get the saved data for this auth code
    const savedDataStr = await USER_MAPPINGS.get(`auth_code:${code}`)
    
    if (!savedDataStr) {
      return new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const savedData = JSON.parse(savedDataStr)
    
    // Check if the code has expired
    if (savedData.expires < Date.now()) {
      await USER_MAPPINGS.delete(`auth_code:${code}`)
      return new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Authorization code expired' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Generate our own access/refresh tokens
    const accessToken = generateRandomString(64)
    const refreshToken = generateRandomString(64)
    const idToken = savedData.tokens.id_token
    
    // Store the tokens with user info
    const tokenData = {
      userInfo: savedData.userInfo,
      kebolaToken: savedData.kebolaToken,
      expires: Date.now() + 3600000 // 1 hour expiry
    }
    
    await USER_MAPPINGS.put(`access_token:${accessToken}`, JSON.stringify(tokenData), { expirationTtl: 3600 })
    
    // Delete the used auth code
    await USER_MAPPINGS.delete(`auth_code:${code}`)
    
    // Return the tokens
    return new Response(JSON.stringify({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      id_token: idToken
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } else if (grantType === 'refresh_token') {
    const refreshToken = formData.get('refresh_token')
    
    if (!refreshToken) {
      return new Response(JSON.stringify({ error: 'invalid_request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // In a real implementation, validate the refresh token and generate new tokens
    
    return new Response(JSON.stringify({ error: 'not_implemented' }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    })
  } else {
    return new Response(JSON.stringify({ error: 'unsupported_grant_type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
} 