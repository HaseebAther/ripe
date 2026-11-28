#!/usr/bin/env bash
# Build dist/ripe_<version>_all.deb. Usage: ./build-deb.sh 1.0.0
set -euo pipefail
umask 022

VERSION="${1:?usage: ./build-deb.sh VERSION}"
cd "$(dirname "${BASH_SOURCE[0]}")"
PKG="$(mktemp -d)"
trap 'rm -rf "$PKG"' EXIT
chmod 755 "$PKG"

APP="$PKG/usr/share/ripe"
DOC="$PKG/usr/share/doc/ripe"
DESKTOP="$PKG/usr/share/applications/ripe.desktop"
ICON="$PKG/usr/share/icons/hicolor/scalable/apps/ripe.svg"
mkdir -p "$PKG/DEBIAN" "$PKG/usr/bin" "$APP" "$DOC" "${DESKTOP%/*}" "${ICON%/*}"

install -m 644 app.py index.html mini.html ripe-tomato.js "$APP/"
install -m 644 LICENSE "$DOC/copyright"

printf '#!/bin/sh\nexec /usr/bin/python3 /usr/share/ripe/app.py "$@"\n' > "$PKG/usr/bin/ripe"
chmod 755 "$PKG/usr/bin/ripe"

# The desktop entry and icon have one source: the heredocs in install.sh
sed -n '/^\[Desktop Entry\]/,/^EOF/{/^EOF/!p}' install.sh | sed 's|^Exec=.*|Exec=ripe|' > "$DESKTOP"
sed -n '/^<svg/,/^<\/svg>/p' install.sh > "$ICON"
grep -qx 'Exec=ripe' "$DESKTOP"
grep -qx '</svg>' "$ICON"

cat > "$PKG/DEBIAN/control" << EOF
Package: ripe
Version: $VERSION
Architecture: all
Maintainer: Haseeb Ather <HaseebAther@users.noreply.github.com>
Section: utils
Priority: optional
Depends: python3, python3-gi, python3-gi-cairo, python3-cairo, gir1.2-gtk-3.0, gir1.2-webkit2-4.1
Homepage: https://github.com/HaseebAther/ripe
Description: Pomodoro timer that ripens as you work
 A GTK3 focus timer with a 3D tomato and a floating widget mode.
EOF

mkdir -p dist
dpkg-deb --root-owner-group --build "$PKG" "dist/ripe_${VERSION}_all.deb"
