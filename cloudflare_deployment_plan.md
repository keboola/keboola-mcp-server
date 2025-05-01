# Keboola MCP Server Cloudflare Deployment with OAuth

This document outlines the steps needed to deploy the Keboola MCP server to Cloudflare and implement OAuth authentication for Keboola users to leverage the Anthropic Integrations feature.

## Overview

The Keboola MCP server currently supports running locally with either stdio or SSE transport options. To deploy it as a remote MCP server on Cloudflare:

1. We'll need to implement the OAuth authorization flow using Cloudflare's Workers OAuth Provider Library
2. Modify the existing SSE transport implementation to work with Cloudflare Workers
3. Deploy the solution to Cloudflare's edge network

## Implementation Plan

### 1. Create Cloudflare Worker Project

```bash
# Install Wrangler CLI
npm install -g wrangler

# Initialize a new Cloudflare Worker project
wrangler init keboola-mcp-worker
cd keboola-mcp-worker

# Install OAuth provider library
npm install @cloudflare/workers-oauth-provider
```

### 2. Implement OAuth Authorization

We'll implement OAuth using Cloudflare's Workers OAuth Provider. The MCP authorization flow will follow these steps:

1. MCP client makes a request to our server
2. Server returns a 401 Unauthorized response
3. Client opens browser with authorization URL
4. User logs in with Keboola credentials and authorizes access
5. Server issues an authorization code then access token
6. Client uses access token for subsequent MCP requests

This aligns with the [MCP authorization protocol](https://spec.modelcontextprotocol.io/specification/draft/basic/authorization/).

### 3. Create Hybrid Python-Cloudflare Worker Solution

There are two ways we can implement this:

#### Option A: Python MCP Server with Cloudflare Worker Proxy

1. Create a Cloudflare Worker that handles OAuth and proxies MCP requests
2. Deploy the Python Keboola MCP server on a serverless platform like Cloudflare Workers
3. Worker manages authentication, then proxies requests to the MCP server

#### Option B: Full JavaScript Implementation

1. Port the Keboola MCP server to JavaScript for Cloudflare Workers
2. Implement OAuth directly in the Worker
3. Create Keboola API client in JavaScript

For faster deployment, Option A is recommended.

### 4. Implementation Steps for Option A

1. **OAuth Implementation in Worker**
   - Implement Worker with OAuth Provider Library
   - Create authentication routes
   - Set up redirects to/from Keboola for authentication

2. **Proxy Configuration**
   - Set up routes to proxy MCP requests
   - Handle token validation
   - Pass authenticated requests to MCP server

3. **MCP Server Deployment**
   - Modify Python MCP server to accept auth tokens
   - Deploy to Cloudflare Worker for Python
   - Configure server to receive proxied requests

4. **Testing & Integration**
   - Test OAuth flow end-to-end
   - Test MCP protocol functionality
   - Integrate with Anthropic

### 5. Required Files

1. `worker.js` - Main Cloudflare Worker entry point
2. `oauth-handler.js` - OAuth implementation
3. `proxy-handler.js` - Proxy for MCP server
4. Updated `server.py` with token authentication

### 6. Code Structure

```
worker/
├── src/
│   ├── index.js        # Main entry point
│   ├── oauth.js        # OAuth implementation
│   └── proxy.js        # Proxy to MCP server
├── wrangler.toml       # Worker configuration
└── package.json        # Dependencies
```

### 7. Deployment to Cloudflare

```bash
# Authenticate with Cloudflare
wrangler login

# Configure worker settings in wrangler.toml
# Deploy the worker
wrangler publish
```

## Integration with Keboola

The OAuth authentication will require:

1. Registering the application with Keboola
2. Getting OAuth client credentials
3. Setting up redirect URIs
4. Configuring scopes for the APIs the MCP server will access

## Integration with Anthropic

To enable the Anthropic Integrations feature:

1. Deploy the remote MCP server to Cloudflare
2. Register the server with Anthropic's Integrations system
3. Configure authentication and authorization flows
4. Test the integration with Claude models

## Security Considerations

1. Protect OAuth client secrets using Cloudflare's Workers Secrets
2. Implement proper token validation and CSRF protection
3. Use short-lived tokens when possible
4. Ensure proper permission scoping

## Next Steps

1. Set up Cloudflare Worker project
2. Implement OAuth authentication flow
3. Create proxy to MCP server
4. Test and deploy the solution
5. Register with Anthropic Integrations 