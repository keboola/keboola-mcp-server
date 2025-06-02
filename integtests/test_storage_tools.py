import csv
import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fastmcp import Context

from integtests.conftest import BucketDef, TableDef
from keboola_mcp_server.client import AsyncStorageClient, RawKeboolaClient, KeboolaClient
from keboola_mcp_server.tools.storage import (
    BucketDetail,
    TableDetail,
    get_bucket_detail,
    get_table_detail,
    retrieve_bucket_tables,
    retrieve_buckets,
)


@pytest.mark.asyncio
async def test_retrieve_buckets(mcp_context: Context, buckets: list[BucketDef]):
    """Tests that `retrieve_buckets` returns a list of `BucketDetail` instances."""
    result = await retrieve_buckets(mcp_context)

    assert isinstance(result, list)
    for item in result:
        assert isinstance(item, BucketDetail)

    assert len(result) == len(buckets)


@pytest.mark.asyncio
async def test_get_bucket_detail(mcp_context: Context, buckets: list[BucketDef]):
    """Tests that for each test bucket, `get_bucket_detail` returns a `BucketDetail` instance."""
    for bucket in buckets:
        result = await get_bucket_detail(bucket.bucket_id, mcp_context)
        assert isinstance(result, BucketDetail)
        assert result.id == bucket.bucket_id


@pytest.mark.asyncio
async def test_get_table_detail(mcp_context: Context, tables: list[TableDef]):
    """Tests that for each test table, `get_table_detail` returns a `TableDetail` instance with correct fields."""

    for table in tables:
        with table.file_path.open('r', encoding='utf-8') as f:
            reader = csv.reader(f)
            columns = frozenset(next(reader))

        result = await get_table_detail(table.table_id, mcp_context)
        assert isinstance(result, TableDetail)
        assert result.id == table.table_id
        assert result.name == table.table_name
        assert result.columns is not None
        assert {col.name for col in result.columns} == columns


@pytest.mark.asyncio
async def test_retrieve_bucket_tables(mcp_context: Context, tables: list[TableDef], buckets: list[BucketDef]):
    """Tests that `retrieve_bucket_tables` returns the correct tables for each bucket."""
    # Group tables by bucket to verify counts
    tables_by_bucket = {}
    for table in tables:
        if table.bucket_id not in tables_by_bucket:
            tables_by_bucket[table.bucket_id] = []
        tables_by_bucket[table.bucket_id].append(table)

    for bucket in buckets:
        result = await retrieve_bucket_tables(bucket.bucket_id, mcp_context)

        assert isinstance(result, list)
        for item in result:
            assert isinstance(item, TableDetail)

        # Verify the count matches expected tables for this bucket
        expected_tables = tables_by_bucket.get(bucket.bucket_id, [])
        assert len(result) == len(expected_tables)

        # Verify table IDs match
        result_table_ids = {table.id for table in result}
        expected_table_ids = {table.table_id for table in expected_tables}
        assert result_table_ids == expected_table_ids


@pytest.mark.asyncio
@patch.object(RawKeboolaClient, "_send_event_after_request", new_callable=AsyncMock)
async def test_storage_modifying_operations_trigger_event_sending(
    mock_send_event: AsyncMock, 
    keboola_client: KeboolaClient,
    unique_id: str
):
    """
    Tests that actual Storage API modifying operations (create, update, delete config)
    trigger the _send_event_after_request method with the correct context.
    We mock _send_event_after_request to avoid actual event sending during tests.
    """
    storage_client: AsyncStorageClient = keboola_client.storage_client
    test_component_id = "keboola.python-transformation"
    config_name = f"mcp-event-integ-test-{unique_id}"
    branch_id = storage_client.branch_id

    created_config_id = None

    try:
        # 1. Create Configuration (POST)
        create_data = {
            "name": config_name,
            "description": "Integration test for MCP event logging - create.",
            "configuration": {"parameters": {"script": "print('created')"}}
        }
        mcp_context_create = {
            "tool_name": "integ_test_create_config",
            "tool_args": {"component_id": test_component_id, "data_summary": "config_create_payload"},
        }
        
        created_config = await storage_client.create_component_root_configuration(
            component_id=test_component_id,
            data=create_data,
            mcp_context=mcp_context_create
        )
        created_config_id = created_config["id"]
        assert created_config_id

        mock_send_event.assert_any_call(
            http_method="POST",
            endpoint=f"branch/{branch_id}/components/{test_component_id}/configs",
            response_json=created_config,
            error_obj=None,
            duration_s=pytest.approx(0, abs=5),
            mcp_context=mcp_context_create
        )
        initial_call_count = mock_send_event.call_count

        # 2. Update Configuration (PUT)
        update_data = {
            "name": config_name,
            "description": "Integration test for MCP event logging - update.",
            "changeDescription": "Integ test update",
            "configuration": {"parameters": {"script": "print('updated')"}}
        }
        mcp_context_update = {
            "tool_name": "integ_test_update_config",
            "tool_args": {"component_id": test_component_id, "config_id": created_config_id, "data_summary": "config_update_payload"},
            "config_id_if_known": created_config_id
        }

        updated_config = await storage_client.update_component_root_configuration(
            component_id=test_component_id,
            config_id=created_config_id,
            data=update_data,
            mcp_context=mcp_context_update
        )
        assert updated_config["description"] == update_data["description"]
        
        # Check that send_event was called again
        assert mock_send_event.call_count > initial_call_count
        mock_send_event.assert_any_call(
            http_method="PUT",
            endpoint=f"branch/{branch_id}/components/{test_component_id}/configs/{created_config_id}",
            response_json=updated_config,
            error_obj=None,
            duration_s=pytest.approx(0, abs=5),
            mcp_context=mcp_context_update
        )
        update_call_count = mock_send_event.call_count

    finally:
        # 3. Delete Configuration (DELETE)
        if created_config_id:
            mcp_context_delete = {
                "tool_name": "integ_test_delete_config",
                "tool_args": {"component_id": test_component_id, "config_id": created_config_id},
                "config_id_if_known": created_config_id
            }
            delete_endpoint = f"branch/{branch_id}/components/{test_component_id}/configs/{created_config_id}"
            
            # The SAPI delete for config returns an empty body on success (204 No Content typically)
            # Our client normalizes this to an empty dict for the event if successful.
            expected_delete_response_for_event = {}

            await storage_client.delete(
                endpoint=delete_endpoint,
                mcp_context=mcp_context_delete
            )
            assert mock_send_event.call_count > update_call_count
            mock_send_event.assert_any_call(
                http_method="DELETE",
                endpoint=delete_endpoint,
                response_json=expected_delete_response_for_event, 
                error_obj=None,
                duration_s=pytest.approx(0, abs=5),
                mcp_context=mcp_context_delete
            )
