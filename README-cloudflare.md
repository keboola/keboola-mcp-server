# Deploying Keboola MCP Server to Cloudflare

This guide will help you deploy the Keboola MCP Server to Cloudflare, enabling it to work with Anthropic Claude Integrations.

## Prerequisites

- A Cloudflare account with Workers enabled
- Node.js and npm installed
- Python 3.9+ installed
- A publicly accessible URL for your Python MCP server
- Keboola OAuth credentials (optional but recommended)

## Setup Overview

The deployment consists of two components:

1. **Python MCP Server**: Handles the agent logic and communicates with Keboola APIs
2. **Cloudflare Worker**: Provides OAuth authentication and proxies requests to the Python server

## Step 1: Configure the Environment

Create a `.env` file in the project root with the following variables:

```
PYTHON_SERVER_URL=https://your-python-server-url.example.com
KEBOOLA_API_URL=https://connection.keboola.com
KEBOOLA_CLIENT_ID=your_client_id
KEBOOLA_CLIENT_SECRET=your_client_secret
KEBOOLA_REDIRECT_URI=https://your-worker-url.workers.dev/authorize/callback
```

## Step 2: Deploy the Python MCP Server

Deploy the Python MCP server to a publicly accessible URL:

```bash
# Install the package
pip3 install -e .

# Run the server in Cloudflare mode
python -m keboola_mcp_server.cli --transport cloudflare --host 0.0.0.0 --port 8000
```

Make sure your server is accessible via HTTPS at the URL you specified in `PYTHON_SERVER_URL`.

## Step 3: Deploy the Cloudflare Worker

Use the provided deployment script:

```bash
# Make the script executable
chmod +x deploy.sh

# Run the deployment script
./deploy.sh
```

This will:
1. Install the Python package locally
2. Install Wrangler CLI if needed
3. Install Worker dependencies
4. Configure Worker secrets from your environment variables
5. Deploy the Worker to Cloudflare

## Step 4: Register with Anthropic Integrations

Once deployed, register your MCP server with Anthropic Integrations:

1. Visit the Anthropic Developer Console
2. Create a new integration
3. Configure the integration with your Cloudflare Worker URL as the MCP server endpoint
4. Complete the verification process

## Troubleshooting

- **Worker Authorization Issues**: Verify your Keboola OAuth credentials are correctly set in the Worker secrets
- **Connection Problems**: Ensure your Python MCP server is publicly accessible and the URL is correctly configured
- **Logs**: Check both Cloudflare Worker logs and your Python server logs for error messages

## Security Considerations

- The OAuth flow uses a simple implementation for demonstration purposes
- For production, consider enhancing the token handling with proper encryption
- Use environment variables for all sensitive information
- Configure proper CORS settings in your production environment

## Manual Configuration

If you prefer to configure the Worker manually:

```bash
cd cloudflare-worker
npm install
wrangler secret put MCP_SERVER_URL
wrangler secret put KEBOOLA_API_URL
wrangler secret put KEBOOLA_CLIENT_ID
wrangler secret put KEBOOLA_CLIENT_SECRET
wrangler secret put KEBOOLA_REDIRECT_URI
wrangler publish
```

## License

This project is licensed under the terms specified in the LICENSE file. 