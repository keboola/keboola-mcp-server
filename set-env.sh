#!/bin/bash
# Script to set up environment variables for deployment

# IMPORTANT: Replace 'your-cloudflare-account-id' with your actual Cloudflare account ID
# You can find this in your Cloudflare dashboard URL: https://dash.cloudflare.com/<account-id>
export CLOUDFLARE_ACCOUNT_ID="your-cloudflare-account-id"

# Set your Python server URL
export PYTHON_SERVER_URL="https://your-python-server-url.example.com"

# Set Google OAuth credentials
# These need to be created in the Google Cloud Console as described in docs/google-oauth-setup.md
export GOOGLE_CLIENT_ID="your-google-client-id"
export GOOGLE_CLIENT_SECRET="your-google-client-secret"
export GOOGLE_REDIRECT_URI="https://your-worker-url.workers.dev/authorize/callback"

# Client ID for MCP Authentication
export CLIENT_ID="mcp-client"

echo "Environment variables set successfully!"
echo "IMPORTANT: Make sure you've replaced the placeholder values with your actual credentials"
echo "Run 'source set-env.sh' before running './deploy.sh' to load these variables." 