#!/bin/sh
set -e

echo "Checking environment for building Tauri app..."

command -v node >/dev/null 2>&1 && echo "node: $(node --version)" || echo "node: MISSING"
command -v npm >/dev/null 2>&1 && echo "npm: $(npm --version)" || echo "npm: MISSING"
command -v cargo >/dev/null 2>&1 && echo "cargo: $(cargo --version)" || echo "cargo: MISSING"
command -v rustc >/dev/null 2>&1 && echo "rustc: $(rustc --version)" || echo "rustc: MISSING"

# check tauri CLI
npx tauri info 2>/dev/null || echo "tauri CLI: not configured (run 'npm install' and 'npx tauri --version')"

echo "\nCheck src-tauri presence:"
[ -d src-tauri ] && echo "src-tauri: OK" || echo "src-tauri: MISSING"

exit 0
