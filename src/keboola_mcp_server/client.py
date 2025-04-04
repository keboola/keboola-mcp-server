"""Keboola Storage API client wrapper."""

import logging
import os
import tempfile
from typing import Any, Dict, Mapping, Optional, cast

import httpx
from kbcstorage.client import Client

logger = logging.getLogger(__name__)


class KeboolaClient:
    """Helper class to interact with Keboola Storage API."""

    STATE_KEY = "sapi_client"

    @classmethod
    def from_state(cls, state: Mapping[str, Any]) -> "KeboolaClient":
        instance = state[cls.STATE_KEY]
        assert isinstance(instance, KeboolaClient)
        return instance

    def __init__(
        self, storage_api_token: str, storage_api_url: str = "https://connection.keboola.com"
    ) -> None:
        """Initialize the client.

        Args:
            storage_api_token: Keboola Storage API token
            storage_api_url: Keboola Storage API URL
        """
        self.token = storage_api_token
        # Ensure the base URL has a scheme
        if not storage_api_url.startswith(("http://", "https://")):
            storage_api_url = f"https://{storage_api_url}"
        self.base_url = storage_api_url
        self.headers = {
            "X-StorageApi-Token": self.token,
            "Content-Type": "application/json",
            "Accept-encoding": "gzip",
        }
        # Initialize the official client for operations it handles well
        self.storage_client = Client(self.base_url, self.token)

    async def get(self, endpoint: str) -> Dict[str, Any]:
        """Make a GET request to Keboola Storage API.

        Args:
            endpoint: API endpoint to call

        Returns:
            API response as dictionary
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/v2/storage/{endpoint}", headers=self.headers
            )
            response.raise_for_status()
            return cast(Dict[str, Any], response.json())

    async def post(self, endpoint: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Make a POST request to Keboola Storage API.

        Args:
            endpoint: API endpoint to call
            data: Request payload

        Returns:
            API response as dictionary
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v2/storage/{endpoint}",
                headers=self.headers,
                json=data if data is not None else {},
            )
            response.raise_for_status()
            return cast(Dict[str, Any], response.json())

    async def download_table_data_async(self, table_id: str) -> str:
        """Download table data using the export endpoint.

        Args:
            table_id: ID of the table to download

        Returns:
            Table data as string
        """
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                # Get just the table name from the table_id
                table_name = table_id.split(".")[-1]
                # Export the table data
                self.storage_client.tables.export_to_file(table_id, temp_dir)
                # Read the exported file
                actual_file = os.path.join(temp_dir, table_name)
                with open(actual_file, "r") as f:
                    data = f.read()
                return data
        except Exception as e:
            logger.error(f"Error downloading table {table_id}: {str(e)}")
            return f"Error downloading table: {str(e)}"
