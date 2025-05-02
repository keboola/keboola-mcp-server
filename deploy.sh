#!/bin/bash
set -e

# Configuration
WORKER_DIR="cloudflare-worker"
PYTHON_SERVER_URL=${PYTHON_SERVER_URL:-"https://your-python-server-url.example.com"}
KEBOOLA_API_URL=${KEBOOLA_API_URL:-"https://connection.keboola.com"}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-""}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-""}
GOOGLE_REDIRECT_URI=${GOOGLE_REDIRECT_URI:-""}
CLIENT_ID=${CLIENT_ID:-"mcp-client"}

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
wrangler secret put CLIENT_ID <<< "$CLIENT_ID"

if [ -n "$GOOGLE_CLIENT_ID" ]; then
    wrangler secret put GOOGLE_CLIENT_ID <<< "$GOOGLE_CLIENT_ID"
fi

if [ -n "$GOOGLE_CLIENT_SECRET" ]; then
    wrangler secret put GOOGLE_CLIENT_SECRET <<< "$GOOGLE_CLIENT_SECRET"
fi

if [ -n "$GOOGLE_REDIRECT_URI" ]; then
    wrangler secret put GOOGLE_REDIRECT_URI <<< "$GOOGLE_REDIRECT_URI"
fi

# Create KV namespace if it doesn't exist
echo "Setting up KV namespace for user mappings..."
KV_NAMESPACE_ID=$(wrangler kv:namespace list | grep USER_MAPPINGS | awk '{print $2}')

if [ -z "$KV_NAMESPACE_ID" ]; then
    echo "Creating new KV namespace..."
    KV_NAMESPACE_ID=$(wrangler kv:namespace create USER_MAPPINGS | grep -oP 'id = "\K[^"]+')
    
    # Update wrangler.toml with the KV namespace ID
    sed -i.bak "s/YOUR_KV_NAMESPACE_ID/$KV_NAMESPACE_ID/g" wrangler.toml
    rm wrangler.toml.bak
    
    echo "Created KV namespace with ID: $KV_NAMESPACE_ID"
else
    echo "Using existing KV namespace with ID: $KV_NAMESPACE_ID"
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
echo "2. Add user mappings using the admin endpoint:"
echo "   curl -X POST https://your-worker-url.workers.dev/admin/user-mapping \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"user@example.com\",\"kebolaToken\":\"your-keboola-api-token\"}'"
echo ""
echo "3. Register your MCP server with Anthropic Integrations" 