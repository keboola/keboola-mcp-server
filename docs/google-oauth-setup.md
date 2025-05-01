# Setting Up Google OAuth for Keboola MCP Server

## 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on "Select a project" at the top of the page
3. Click "NEW PROJECT" in the modal window
4. Enter a project name (e.g., "Keboola MCP Integration")
5. Click "CREATE"

## 2. Configure OAuth Consent Screen

1. In your new project, navigate to "APIs & Services" > "OAuth consent screen"
2. Select "External" user type (unless you are restricting to your organization)
3. Click "CREATE"
4. Fill in the required details:
   - App name: "Keboola MCP Integration"
   - User support email: Your email
   - Developer contact information: Your email
5. Click "SAVE AND CONTINUE"
6. On the "Scopes" screen, add these scopes:
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `openid`
7. Click "SAVE AND CONTINUE"
8. Add any test users if you're still in testing mode
9. Click "SAVE AND CONTINUE" to complete setup

## 3. Create OAuth Client ID

1. Navigate to "APIs & Services" > "Credentials"
2. Click "CREATE CREDENTIALS" and select "OAuth client ID"
3. For Application type, select "Web application"
4. Name: "Keboola MCP Web Client"
5. Add Authorized redirect URIs:
   - `https://your-worker-url.workers.dev/authorize/callback`
   - `http://localhost:8787/authorize/callback` (for local development)
6. Click "CREATE"
7. Note your Client ID and Client Secret - you'll need these for configuration

## 4. Enable Google People API

1. Navigate to "APIs & Services" > "Library"
2. Search for "Google People API"
3. Select it and click "ENABLE"
   - This allows your application to access user profile information

## 5. Update Your Environment Variables

Add these variables to your `.env` file:

```
GOOGLE_CLIENT_ID=your_client_id_from_step_3
GOOGLE_CLIENT_SECRET=your_client_secret_from_step_3
GOOGLE_REDIRECT_URI=https://your-worker-url.workers.dev/authorize/callback
```

## 6. Set Up Keboola API Token Mapping

You need to decide how to map Google user identities to Keboola access:

1. **Manual mapping**: Maintain a list of allowed Google emails and their corresponding Keboola API tokens
2. **Domain-based**: Allow anyone with an email from certain domains
3. **User management system**: Implement a more sophisticated system where users register and obtain tokens

For the example implementation, we'll use a simple mapping in Cloudflare KV. 