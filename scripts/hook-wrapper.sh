#!/bin/bash
# CC Notify Hook Wrapper
# This script can be called from any directory

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/cc-notify-hook.log"

# Log timestamp and environment
echo "=== $(date) ===" >> "$LOG_FILE"
echo "PWD: $(pwd)" >> "$LOG_FILE"
echo "PROJECT_ROOT: $PROJECT_ROOT" >> "$LOG_FILE"

# Read stdin and tee to log
INPUT=$(cat)
echo "INPUT: $INPUT" >> "$LOG_FILE"

# Change to project root and run the hook
cd "$PROJECT_ROOT"
OUTPUT=$(echo "$INPUT" | node "$PROJECT_ROOT/dist/hook/permission-request.js" 2>> "$LOG_FILE")
EXIT_CODE=$?
echo "OUTPUT: $OUTPUT" >> "$LOG_FILE"
echo "EXIT_CODE: $EXIT_CODE" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "$OUTPUT"
exit $EXIT_CODE
