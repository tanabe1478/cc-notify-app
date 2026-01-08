#!/bin/bash
# Generate Claude Code hook configuration
# Usage: ./scripts/generate-hook-config.sh [output-file]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

OUTPUT_FILE="${1:-}"

# Generate config with absolute path
CONFIG=$(cat <<EOF
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "$PROJECT_ROOT/scripts/hook-wrapper.sh",
            "timeout": 600
          }
        ]
      }
    ]
  }
}
EOF
)

if [ -n "$OUTPUT_FILE" ]; then
    echo "$CONFIG" > "$OUTPUT_FILE"
    echo "Generated: $OUTPUT_FILE"
else
    echo "$CONFIG"
fi

echo ""
echo "=== Usage ==="
echo ""
echo "1. Global (all projects):"
echo "   Copy to: ~/.claude/settings.json"
echo ""
echo "2. Per-project (shared with team):"
echo "   Copy to: <project>/.claude/settings.json"
echo ""
echo "3. Per-project (personal):"
echo "   Copy to: <project>/.claude/settings.local.json"
