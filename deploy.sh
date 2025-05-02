#!/bin/bash
set -e

# Load environment variables from .env file
if [ -f .env ]; then
    echo "Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
else
    echo "ERROR: .env file not found."
    echo "Please create a .env file based on .env.example and set the required variables."
    exit 1
fi

# Configuration
WORKER_DIR="cloudflare-worker"
PYTHON_SERVER_URL=${PYTHON_SERVER_URL:-"https://your-python-server-url.example.com"}
KEBOOLA_API_URL=${KEBOOLA_API_URL:-"https://connection.keboola.com"}
CLIENT_ID=${CLIENT_ID:-"mcp-client"}
CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID:-""}

# Check if Cloudflare account ID is set
if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    echo "ERROR: CLOUDFLARE_ACCOUNT_ID is not set in .env file"
    echo "Please set it to your Cloudflare account ID"
    echo "You can find your account ID in the Cloudflare dashboard URL:"
    echo "https://dash.cloudflare.com/<account-id>"
    exit 1
fi

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

# Update account ID in wrangler.toml
echo "Updating Cloudflare account ID in wrangler.toml..."
sed -i.bak "s/account_id = \".*\"/account_id = \"$CLOUDFLARE_ACCOUNT_ID\"/g" wrangler.toml && rm wrangler.toml.bak

# Set environment variables for Wrangler
echo "Configuring Worker environment..."
wrangler secret put MCP_SERVER_URL <<< "$PYTHON_SERVER_URL"
wrangler secret put KEBOOLA_API_URL <<< "$KEBOOLA_API_URL"
wrangler secret put CLIENT_ID <<< "$CLIENT_ID"

# Deploy the worker
echo "Deploying Worker to Cloudflare..."
wrangler deploy

# Return to the root directory
cd ..

echo "Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Configure your Python MCP server to run in Cloudflare mode:"
echo "   python -m keboola_mcp_server.cli --transport cloudflare --host 0.0.0.0 --port 8000"
echo ""
echo "2. Test the MCP server with your Keboola token:"
echo "   curl -H 'X-Keboola-Token: your-keboola-api-token' https://your-worker-url.workers.dev/mcp/sse"
echo ""
echo "3. Register your MCP server with Anthropic Integrations" 