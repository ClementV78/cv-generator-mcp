#!/bin/sh
set -eu

PACKAGE_NAME="${CV_GENERATOR_PACKAGE_NAME:-@xclem/cv-generator-mcp}"
TARGET="${1:-}"

usage() {
  echo "Usage: sh scripts/print-mcp-config.sh <hermes|claude-code>" >&2
  exit 1
}

[ -n "$TARGET" ] || usage

case "$TARGET" in
  hermes)
    cat <<EOF
mcp_servers:
  cv_generator:
    command: "npx"
    args:
      - "-y"
      - "$PACKAGE_NAME"
    timeout: 180
    connect_timeout: 60
EOF
    ;;
  claude-code)
    cat <<EOF
claude mcp add cv-generator -- npx -y $PACKAGE_NAME
EOF
    ;;
  *)
    usage
    ;;
esac
