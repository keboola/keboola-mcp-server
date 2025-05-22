# Keboola MCP Server: Agent Guide

This guide provides key information for navigating and working with the Keboola MCP Server codebase. The server implements the Model Context Protocol (MCP) for Keboola Connection, enabling AI agents to access and manipulate data and configurations in Keboola projects.

## Repository Structure

```
keboola-mcp-server/
├── src/                     # Source code
│   └── keboola_mcp_server/  # Main package
│       ├── tools/           # MCP tool implementations
│       │   ├── components/  # Component management tools
│       │   ├── storage.py   # Storage API tools
│       │   ├── sql.py       # SQL execution tools
│       │   ├── jobs.py      # Job management tools
│       │   └── doc.py       # Documentation tools
│       ├── client.py        # Storage API client
│       ├── mcp.py           # MCP protocol implementation
│       ├── server.py        # Server implementation
│       ├── config.py        # Configuration handling
│       ├── errors.py        # Error handling
│       ├── cli.py           # Command-line interface
│       └── __main__.py      # Package entry point
├── tests/                   # Unit tests
│   └── tools/               # Tests for MCP tools
├── integtests/              # Integration tests
├── .github/                 # GitHub workflows
├── pyproject.toml           # Project configuration
├── README.md                # Project documentation
└── TOOLS.md                 # Tool documentation
```

## Development Environment Setup

### Prerequisites
- Python 3.10+
- Git

### Setup Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/keboola/keboola-mcp-server.git
   cd keboola-mcp-server
   ```

2. Create and activate a virtual environment:
   ```bash
   python3 -m venv --upgrade-deps .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. Install the package with development dependencies:
   ```bash
   pip3 install -e ".[dev,tests,codestyle]"
   ```

## Testing

### Running Unit Tests
```bash
pytest
# Or with coverage reporting:
pytest tests --cov=keboola_mcp_server --cov-report=term-missing
```

### Running Integration Tests
Integration tests require valid Keboola credentials:

```bash
export INTEGTEST_STORAGE_API_URL=https://connection.YOUR_REGION.keboola.com
export INTEGTEST_STORAGE_TOKEN=your_keboola_storage_token
export INTEGTEST_WORKSPACE_SCHEMA=your_workspace_schema
pytest integtests
```

### Using Tox
Tox automates testing across multiple Python versions:

```bash
tox                # Run all tests and style checks
tox -e flake8      # Run only style checks
tox -e integtests  # Run integration tests
```

## Code Style and Quality

The project follows strict code style guidelines using Black, isort, and Flake8:

```bash
# Format code
black .
isort .

# Check code style
flake8 src/ tests/ integtests/

# Type checking
mypy .
```

## Building and Packaging

```bash
# Build wheel package
python -m build --wheel

# Install the built package
pip install dist/keboola_mcp_server-*.whl
```

## Common Workflows

### Adding a New Tool
1. Identify the appropriate module in `src/keboola_mcp_server/tools/` 
2. Implement the tool function with appropriate type annotations
3. Register the tool in the Server class
4. Add appropriate tests in the `tests/tools/` directory
5. Update the documentation in `TOOLS.md`

### Fixing a Bug
1. Write a failing test that demonstrates the bug
2. Fix the implementation to make the test pass
3. Ensure all other tests continue to pass
4. Submit a PR with the fix

## Running the Server

Start the MCP server from the command line:

```bash
# Using standard I/O transport
python -m keboola_mcp_server.cli --transport stdio --api-url https://connection.YOUR_REGION.keboola.com

# Using SSE transport (server mode)
python -m keboola_mcp_server.cli --transport sse --api-url https://connection.YOUR_REGION.keboola.com
```

Required environment variables:
- `KBC_STORAGE_TOKEN`: Your Keboola Storage API token
- `KBC_WORKSPACE_SCHEMA`: Your Snowflake schema or BigQuery dataset

## Deployment

The CI pipeline (GitHub Actions) automatically:
1. Runs tests on Python 3.10, 3.11, and 3.12
2. Builds the wheel package
3. Deploys to PyPI when a semantic version tag is pushed

To create a release:
1. Update version in `pyproject.toml` 
2. Create and push a tag matching the version (e.g., `v0.16.2`)

## Troubleshooting

If you encounter issues:

1. Check credential configuration:
   - `KBC_STORAGE_TOKEN` - Valid Keboola Storage API token
   - `KBC_WORKSPACE_SCHEMA` - Valid workspace schema/dataset name

2. For BigQuery backends:
   - Ensure `GOOGLE_APPLICATION_CREDENTIALS` points to a valid service account JSON file

3. For connection issues:
   - Verify the API URL is correct for your region
   - Check logs with increased verbosity: `--log-level DEBUG`

## Additional Resources

- [TOOLS.md](TOOLS.md): Documentation of all available MCP tools
- [README.md](README.md): General project documentation
- [Keboola Documentation](https://help.keboola.com): Official Keboola documentation 