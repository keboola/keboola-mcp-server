// Keboola MCP Server Worker

/**
 * Handle health check requests
 */
function handleHealth() {
  return new Response(
    JSON.stringify({
      status: "ok",
      message: "Keboola MCP Server is running"
    }),
    {
      headers: {
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Keboola-Token"
      }
    }
  );
}

/**
 * Handle CORS preflight requests
 */
function handleOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Keboola-Token"
    },
    status: 204
  });
}

/**
 * Handle MCP requests
 */
function handleMcp(request, env) {
  // Get auth token from headers
  const authHeader = request.headers.get("Authorization");
  const keboolaToken = request.headers.get("X-Keboola-Token");
  
  let token = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else if (keboolaToken) {
    token = keboolaToken;
  } else {
    // Try to get token from query params
    const url = new URL(request.url);
    const tokenParam = url.searchParams.get("token");
    if (tokenParam) {
      token = tokenParam;
    }
  }
  
  if (!token) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "No valid authentication token provided"
      }),
      {
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        status: 401
      }
    );
  }
  
  // For demo purposes, we'll return a simple response
  return new Response(
    JSON.stringify({
      status: "authenticated",
      message: "Token validated",
      transport: "mcp",
      token: token.substring(0, 5) + "..." // Return just the first 5 chars for security
    }),
    {
      headers: {
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Keboola-Token"
      }
    }
  );
}

/**
 * Handle SSE (Server-Sent Events) requests
 */
function handleSse(request, env) {
  // Similar to handleMcp but for SSE
  const authHeader = request.headers.get("Authorization");
  const keboolaToken = request.headers.get("X-Keboola-Token");
  
  let token = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else if (keboolaToken) {
    token = keboolaToken;
  } else {
    // Try to get token from query params
    const url = new URL(request.url);
    const tokenParam = url.searchParams.get("token");
    if (tokenParam) {
      token = tokenParam;
    }
  }
  
  if (!token) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "No valid authentication token provided"
      }),
      {
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        status: 401
      }
    );
  }
  
  // For demo purposes
  return new Response(
    JSON.stringify({
      status: "authenticated",
      message: "Token validated",
      transport: "sse",
      token: token.substring(0, 5) + "..." // Return just the first 5 chars for security
    }),
    {
      headers: {
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Keboola-Token"
      }
    }
  );
}

/**
 * Main event handler for Cloudflare Workers
 */
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request, event.env));
});

/**
 * Handle all incoming requests
 */
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    return handleOptions();
  }
  
  // Route requests based on path
  if (path.includes("/health")) {
    return handleHealth();
  } else if (path.includes("/sse")) {
    return handleSse(request, env);
  } else if (path.includes("/mcp")) {
    return handleMcp(request, env);
  } else {
    // Default to returning info about the MCP server
    return new Response(
      JSON.stringify({
        status: "ok",
        message: "Keboola MCP Server",
        endpoints: {
          health: "/health",
          sse: "/sse",
          mcp: "/mcp"
        },
        version: "1.0.0"
      }),
      {
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
} 