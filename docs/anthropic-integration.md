# Integrating with Anthropic Claude

This guide explains how to register your Keboola MCP Server as an integration with Anthropic Claude.

## Prerequisites

- Your Keboola MCP Server deployed to Cloudflare (see README-cloudflare.md)
- An Anthropic API key
- Access to the Anthropic Developer Console

## Registration Process

1. **Sign in to the Anthropic Developer Console**
   - Visit https://console.anthropic.com/
   - Sign in with your Anthropic account

2. **Create a New Integration**
   - Navigate to the "Integrations" section
   - Click "Create New Integration"

3. **Configure Basic Information**
   - Name: "Keboola Data Integration"
   - Description: "Connect Claude to your Keboola data pipeline and analytics"
   - Icon: Upload the Keboola logo (optional)

4. **Configure MCP Server Settings**
   - MCP Server URL: Your Cloudflare Worker URL (e.g., https://keboola-mcp-server.your-account.workers.dev)
   - Authentication Type: OAuth 2.0
   - OAuth Client ID: Your registered client ID with Anthropic
   - OAuth Scopes: Request appropriate scopes for your integration

5. **Configure Integration Permissions**
   - Data Access: Select appropriate data access permissions
   - User Information: Select user information your integration requires

6. **Configure Integration Visibility**
   - Public: Available to all Claude users
   - Private: Available only to specific users or organizations
   - For testing, start with "Private"

7. **Submit for Review**
   - If making your integration public, Anthropic will review it
   - Private integrations typically don't require review

## Testing the Integration

1. **Use with Claude Opus/Sonnet/Haiku**
   - In a conversation with Claude, type "@Keboola" to activate the integration
   - Claude will prompt the user to authenticate with Keboola
   - After authentication, Claude can access Keboola data and functionality

2. **Debug Common Issues**
   - Authentication Failures: Check your OAuth implementation and credentials
   - Connection Issues: Verify your Cloudflare Worker and Python server are running
   - Permission Issues: Verify scopes and permissions are correctly configured

## Integration Capabilities

Your Keboola integration can provide Claude with:

1. **Data Access**
   - Query tables in Keboola Storage
   - Access transformation results
   - View data extraction logs

2. **Data Manipulation**
   - Run SQL transformations
   - Create data extracts
   - Schedule data loads

3. **Insights**
   - Generate reports and visualizations
   - Perform advanced analytics on data
   - Create data snapshots

## Security Considerations

1. **Data Privacy**
   - Only expose necessary data to Claude
   - Use proper scoping for OAuth tokens
   - Implement proper logging for all data access

2. **Authentication**
   - Regularly rotate OAuth secrets
   - Set appropriate token expiration times
   - Implement proper error handling for auth failures

3. **Compliance**
   - Ensure your integration meets Anthropic's guidelines
   - Consider data residency requirements
   - Document user data handling practices

## Resources

- [Anthropic Documentation](https://docs.anthropic.com/claude/integrations)
- [Keboola API Documentation](https://developers.keboola.com)
- [MCP Server GitHub Repository](https://github.com/your-org/keboola-mcp-server) 