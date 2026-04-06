#!/bin/bash
# Injects the Icon Composer .icon file into the Tauri app bundle.
# macOS Sequoia reads .icon files directly from Resources/ for dark/tinted variants.
# Also keeps .icns as fallback for pre-Sequoia systems.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TAURI_DIR="$(dirname "$SCRIPT_DIR")"
ICON_SOURCE="$TAURI_DIR/icons/AppIcon.icon"
APP_BUNDLE="$TAURI_DIR/target/release/bundle/macos/Reportly.app"

if [ ! -d "$APP_BUNDLE" ]; then
  echo "Error: App bundle not found at $APP_BUNDLE"
  echo "Run 'pnpm tauri build' first."
  exit 1
fi

if [ ! -d "$ICON_SOURCE" ]; then
  echo "Error: Icon Composer file not found at $ICON_SOURCE"
  exit 1
fi

RESOURCES="$APP_BUNDLE/Contents/Resources"
PLIST="$APP_BUNDLE/Contents/Info.plist"

# Copy .icon file into Resources (Sequoia+ reads this directly)
cp -R "$ICON_SOURCE" "$RESOURCES/AppIcon.icon"

# Rename existing icon.icns to AppIcon.icns for consistency
if [ -f "$RESOURCES/icon.icns" ]; then
  cp "$RESOURCES/icon.icns" "$RESOURCES/AppIcon.icns"
fi

# Update Info.plist to point to AppIcon
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile AppIcon" "$PLIST" 2>/dev/null || \
  /usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string AppIcon" "$PLIST"
/usr/libexec/PlistBuddy -c "Delete :CFBundleIconName" "$PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleIconName string AppIcon" "$PLIST"

echo "Icon injected into $APP_BUNDLE"
echo "  AppIcon.icon  → Sequoia+ (dark/tinted variants)"
echo "  AppIcon.icns  → Pre-Sequoia fallback"
