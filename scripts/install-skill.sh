#!/bin/sh
set -eu

TARGET="${1:-}"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
SKILL_NAME="cv-generator"
SKILL_SOURCE="$REPO_ROOT/skills/$SKILL_NAME"

usage() {
  echo "Usage: sh scripts/install-skill.sh <hermes|claude-code>" >&2
  exit 1
}

[ -d "$SKILL_SOURCE" ] || {
  echo "Skill source not found: $SKILL_SOURCE" >&2
  exit 1
}

[ -n "$TARGET" ] || usage

case "$TARGET" in
  hermes)
    SKILLS_DIR="${HERMES_SKILLS_DIR:-$HOME/.hermes/skills}"
    ;;
  claude-code)
    SKILLS_DIR="${CLAUDE_CODE_SKILLS_DIR:-$HOME/.claude/skills}"
    ;;
  *)
    usage
    ;;
esac

DESTINATION="$SKILLS_DIR/$SKILL_NAME"

mkdir -p "$SKILLS_DIR"
rm -rf "$DESTINATION"
cp -R "$SKILL_SOURCE" "$DESTINATION"

echo "Installed $SKILL_NAME to $DESTINATION"
echo
echo "Next step:"
sh "$SCRIPT_DIR/print-mcp-config.sh" "$TARGET"
