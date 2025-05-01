#!/bin/bash
set -e

# Configuration
WORKER_DIR="cloudflare-worker"
PYTHON_SERVER_URL=${PYTHON_SERVER_URL:-"https://your-python-server-url.example.com"}
KEBOOLA_API_URL=${KEBOOLA_API_URL:-"https://connection.keboola.com"}
KEBOOLA_CLIENT_ID=${KEBOOLA_CLIENT_ID:-""}
KEBOOLA_CLIENT_SECRET=${KEBOOLA_CLIENT_SECRET:-""}
KEBOOLA_REDIRECT_URI=${KEBOOLA_REDIRECT_URI:-""}

# Build and deploy Python MCP server
echo "Building Python MCP server..."
python -m pip install -e .

# Install Wrangler if not already installed
if ! command -v wrangler &> /dev/null; then
    echo "Installing Wrangler..."
    npm install -g wrangler
fi

# Move to the worker directory
cd "$WORKER_DIR"

# Install dependencies
echo "Installing Worker dependencies..."
npm install

# Set environment variables for Wrangler
echo "Configuring Worker environment..."
wrangler secret put MCP_SERVER_URL <<< "$PYTHON_SERVER_URL"
wrangler secret put KEBOOLA_API_URL <<< "$KEBOOLA_API_URL"

if [ -n "$KEBOOLA_CLIENT_ID" ]; then
    wrangler secret put KEBOOLA_CLIENT_ID <<< "$KEBOOLA_CLIENT_ID"
fi

if [ -n "$KEBOOLA_CLIENT_SECRET" ]; then
    wrangler secret put KEBOOLA_CLIENT_SECRET <<< "$KEBOOLA_CLIENT_SECRET"
fi

if [ -n "$KEBOOLA_REDIRECT_URI" ]; then
    wrangler secret put KEBOOLA_REDIRECT_URI <<< "$KEBOOLA_REDIRECT_URI"
fi

# Deploy the worker
echo "Deploying Worker to Cloudflare..."
wrangler publish

# Return to the root directory
cd ..

echo "Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Configure your Python MCP server to run in Cloudflare mode:"
echo "   python -m keboola_mcp_server.cli --transport cloudflare --host 0.0.0.0 --port 8000"
echo ""
echo "2. Register your MCP server with Anthropic Integrations"
echo ""
echo "3. Set up Keboola OAuth credentials if you haven't already:"
echo "   - Client ID: $KEBOOLA_CLIENT_ID"
echo "   - Redirect URI: $KEBOOLA_REDIRECT_URI" 