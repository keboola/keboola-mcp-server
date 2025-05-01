#!/usr/bin/env python3
"""User management script for Keboola MCP Server with Google OAuth."""

import argparse
import json
import os
import sys
from urllib.parse import urljoin

import requests
from dotenv import load_dotenv


def main():
    """Main entry point for the script."""
    load_dotenv()

    parser = argparse.ArgumentParser(description="Manage user mappings for Keboola MCP Server")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Add user command
    add_parser = subparsers.add_parser("add", help="Add a user mapping")
    add_parser.add_argument("--email", required=True, help="User's Google email address")
    add_parser.add_argument("--token", required=True, help="Keboola API token for the user")
    add_parser.add_argument("--worker-url", help="Cloudflare Worker URL (overrides env var)")

    # List users command
    list_parser = subparsers.add_parser("list", help="List all user mappings")
    list_parser.add_argument("--worker-url", help="Cloudflare Worker URL (overrides env var)")

    # Delete user command
    delete_parser = subparsers.add_parser("delete", help="Delete a user mapping")
    delete_parser.add_argument("--email", required=True, help="User's Google email address")
    delete_parser.add_argument("--worker-url", help="Cloudflare Worker URL (overrides env var)")

    args = parser.parse_args()

    # Get worker URL from args or environment
    worker_url = args.worker_url if hasattr(args, 'worker_url') and args.worker_url else os.getenv("WORKER_URL")
    if not worker_url:
        print("Error: Worker URL not specified. Use --worker-url or set WORKER_URL environment variable.")
        sys.exit(1)

    # Normalize worker URL
    if not worker_url.startswith(("http://", "https://")):
        worker_url = f"https://{worker_url}"
    if not worker_url.endswith("/"):
        worker_url = f"{worker_url}/"

    # Handle commands
    if args.command == "add":
        add_user(worker_url, args.email, args.token)
    elif args.command == "list":
        list_users(worker_url)
    elif args.command == "delete":
        delete_user(worker_url, args.email)
    else:
        parser.print_help()
        sys.exit(1)


def add_user(worker_url: str, email: str, token: str):
    """Add a user mapping."""
    endpoint = urljoin(worker_url, "admin/user-mapping")
    
    try:
        response = requests.post(
            endpoint,
            json={"email": email, "kebolaToken": token},
            headers={"Content-Type": "application/json"},
        )
        
        if response.status_code == 200:
            print(f"✅ Successfully added mapping for {email}")
        else:
            print(f"❌ Failed to add user mapping: {response.text}")
            sys.exit(1)
    except requests.RequestException as e:
        print(f"❌ Request error: {e}")
        sys.exit(1)


def list_users(worker_url: str):
    """List all user mappings."""
    endpoint = urljoin(worker_url, "admin/user-mapping")
    
    try:
        response = requests.get(endpoint)
        
        if response.status_code == 200:
            users = response.json()
            if not users:
                print("No user mappings found.")
                return
                
            print("\nUser Mappings:")
            print("-" * 60)
            for email, token in users.items():
                masked_token = f"{token[:4]}...{token[-4:]}" if token else "N/A"
                print(f"Email: {email}")
                print(f"Token: {masked_token}")
                print("-" * 60)
        else:
            print(f"❌ Failed to retrieve user mappings: {response.text}")
            sys.exit(1)
    except requests.RequestException as e:
        print(f"❌ Request error: {e}")
        sys.exit(1)


def delete_user(worker_url: str, email: str):
    """Delete a user mapping."""
    endpoint = urljoin(worker_url, f"admin/user-mapping/{email}")
    
    try:
        response = requests.delete(endpoint)
        
        if response.status_code == 200:
            print(f"✅ Successfully deleted mapping for {email}")
        else:
            print(f"❌ Failed to delete user mapping: {response.text}")
            sys.exit(1)
    except requests.RequestException as e:
        print(f"❌ Request error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main() 