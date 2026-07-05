#!/usr/bin/env bash
# Stops and removes the Jobhunter LaunchAgents (server + pull).
set -euo pipefail
LA="$HOME/Library/LaunchAgents"
for L in com.jobhunter.server com.jobhunter.pull; do
  launchctl unload "$LA/$L.plist" 2>/dev/null || true
  rm -f "$LA/$L.plist"
done
echo "✓ Removed. The local control panel and auto-pull are stopped."
echo "  (GitHub Actions cloud scraping is unaffected — pause it in the repo's Actions tab if you want.)"
