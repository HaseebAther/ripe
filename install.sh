#!/usr/bin/env bash
# Ripe — one-line installer for Debian / Ubuntu / Fedora / Arch
set -e

INSTALL_DIR="$HOME/.local/share/ripe"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing Ripe Pomodoro Timer..."

# ── Install system dependencies ──────────────────────────────────────────────
if command -v apt &>/dev/null; then
  sudo apt install -y python3-gi python3-gi-cairo gir1.2-gtk-3.0 gir1.2-webkit2-4.1 python3-cairo
elif command -v dnf &>/dev/null; then
  sudo dnf install -y python3-gobject gtk3 webkit2gtk4.1 python3-cairo
elif command -v pacman &>/dev/null; then
  sudo pacman -S --noconfirm python-gobject gtk3 webkit2gtk python-cairo
else
  echo "Could not detect package manager. Install python3-gi and webkit2gtk 4.1 manually."
fi

# ── Copy app files ────────────────────────────────────────────────────────────
mkdir -p "$INSTALL_DIR"
cp "$APP_DIR/app.py" "$APP_DIR/index.html" "$APP_DIR/mini.html" "$APP_DIR/ripe-tomato.js" "$INSTALL_DIR/"

# ── Desktop entry ─────────────────────────────────────────────────────────────
mkdir -p "$HOME/.local/share/applications"
cat > "$HOME/.local/share/applications/ripe.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Ripe
GenericName=Pomodoro Timer
Comment=A focus timer that ripens as you work
Exec=python3 $INSTALL_DIR/app.py
Icon=ripe
Terminal=false
Categories=Utility;GTK;
Keywords=pomodoro;timer;focus;tomato;productivity;
StartupNotify=true
StartupWMClass=Ripe
EOF

# ── App icon ──────────────────────────────────────────────────────────────────
mkdir -p "$HOME/.local/share/icons/hicolor/scalable/apps"
cat > "$HOME/.local/share/icons/hicolor/scalable/apps/ripe.svg" << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect width="200" height="200" rx="46" fill="#9EC1CF"/>
  <ellipse cx="100" cy="114" rx="66" ry="60" fill="#79A93A"/>
  <path d="M100 116V78A38 38 0 0 1 138 116Z" fill="#FBFAF6"/>
  <circle cx="100" cy="116" r="8" fill="#C9A24B"/>
  <g fill="#3E7B35" transform="translate(100 60)">
    <ellipse cx="16" rx="18" ry="8" transform="rotate(12)"/>
    <ellipse cx="16" rx="18" ry="8" transform="rotate(168)"/>
  </g>
</svg>
EOF

# Update icon cache
gtk-update-icon-cache "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

echo ""
echo "✓ Ripe installed to $INSTALL_DIR"
echo "✓ App launcher registered (search 'Ripe' in Activities)"
echo ""
echo "Run now:  python3 $INSTALL_DIR/app.py"
