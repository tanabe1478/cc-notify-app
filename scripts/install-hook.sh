#!/bin/bash

# Claude Code Discord Approval Hook Installer
# This script helps configure the hook in Claude Code settings

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
HOOK_SCRIPT="$PROJECT_DIR/dist/hook/permission-request.js"

# Check if project is built
if [ ! -f "$HOOK_SCRIPT" ]; then
    echo "Error: Hook script not found at $HOOK_SCRIPT"
    echo "Please run 'pnpm build' first."
    exit 1
fi

# Detect settings file location
SETTINGS_DIR="$HOME/.claude"
SETTINGS_FILE="$SETTINGS_DIR/settings.json"

echo "=== Claude Code Discord Approval Hook Installer ==="
echo ""
echo "Hook script: $HOOK_SCRIPT"
echo "Settings file: $SETTINGS_FILE"
echo ""

# Create settings directory if needed
mkdir -p "$SETTINGS_DIR"

# Generate the hook configuration
HOOK_CONFIG=$(cat <<EOF
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node $HOOK_SCRIPT",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
EOF
)

echo "Hook configuration to add:"
echo "$HOOK_CONFIG"
echo ""

if [ -f "$SETTINGS_FILE" ]; then
    echo "Existing settings.json found."
    echo "Please manually merge the above configuration into your settings.json"
    echo ""
    echo "Current settings.json:"
    cat "$SETTINGS_FILE"
else
    echo "No existing settings.json found."
    read -p "Create new settings.json with hook configuration? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "$HOOK_CONFIG" > "$SETTINGS_FILE"
        echo "Created $SETTINGS_FILE"
    else
        echo "Skipped. You can manually create the file later."
    fi
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Start the server: pnpm dev:server (or pnpm start:server for production)"
echo "2. Restart Claude Code to pick up the new hook configuration"
echo "3. Any permission request will now be sent to Discord for approval"
