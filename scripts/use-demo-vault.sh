#!/usr/bin/env bash
# Swap ~/Documents/KensEditor with the repo demo-vault for screenshots.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEMO="$REPO/demo-vault"
LIVE="$HOME/Documents/KensEditor"
BACKUP="$HOME/Documents/KensEditor.real"
STAGING="$HOME/Documents/KensEditor.demo-active"

usage() {
  echo "Usage: $0 on|off|status" >&2
  exit 1
}

[[ $# -eq 1 ]] || usage

case "$1" in
  status)
    if [[ -d "$BACKUP" ]]; then
      echo "demo vault is ON (real vault parked at $BACKUP)"
    else
      echo "demo vault is OFF (live vault is your real notes)"
    fi
    ;;
  on)
    if [[ -d "$BACKUP" ]]; then
      echo "Already on. Run: $0 off" >&2
      exit 1
    fi
    if [[ ! -d "$DEMO" ]]; then
      echo "Missing demo vault: $DEMO" >&2
      exit 1
    fi
    # Copy demo aside from the repo so .txt edits during screenshots don't dirty git.
    rm -rf "$STAGING"
    mkdir -p "$STAGING"
    rsync -a --exclude README.md --exclude .DS_Store "$DEMO/" "$STAGING/"
    mv "$LIVE" "$BACKUP"
    mv "$STAGING" "$LIVE"
    echo "Demo vault active at $LIVE"
    echo "Real notes parked at $BACKUP"
    echo "Quit and reopen the app, then ⌘P."
    ;;
  off)
    if [[ ! -d "$BACKUP" ]]; then
      echo "Already off." >&2
      exit 1
    fi
    if [[ -d "$LIVE" ]]; then
      rm -rf "$HOME/Documents/KensEditor.demo-was-active"
      mv "$LIVE" "$HOME/Documents/KensEditor.demo-was-active"
    fi
    mv "$BACKUP" "$LIVE"
    echo "Real vault restored at $LIVE"
    echo "Last demo copy kept at $HOME/Documents/KensEditor.demo-was-active (safe to delete)."
    ;;
  *)
    usage
    ;;
esac
