#!/bin/bash
# CC Notify Hook Wrapper
# This script can be called from any directory

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root and run the hook
cd "$PROJECT_ROOT"
exec node "$PROJECT_ROOT/dist/hook/permission-request.js"
