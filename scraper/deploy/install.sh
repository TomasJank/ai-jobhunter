#!/usr/bin/env bash
# Installs two macOS LaunchAgents so Jobhunter is always ready when your laptop is on:
#   1. com.jobhunter.server — keeps the control panel alive at http://localhost:8090
#   2. com.jobhunter.pull   — every ~30 min (and right after you open the lid) pulls the
#      latest scraped data that GitHub Actions committed, so the dashboard is fresh.
# The daily *scraping* runs in the cloud (GitHub Actions) — this side only serves + syncs.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SCRAPER="$REPO/scraper"
NODE="$(command -v node)"; GIT="$(command -v git)"
LA="$HOME/Library/LaunchAgents"
LOGS="$SCRAPER/deploy/logs"
BINPATH="$(dirname "$NODE"):$(dirname "$GIT"):/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin"
mkdir -p "$LA" "$LOGS"

cat > "$LA/com.jobhunter.server.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.jobhunter.server</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$SCRAPER/server.js</string></array>
  <key>WorkingDirectory</key><string>$SCRAPER</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$BINPATH</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOGS/server.log</string>
  <key>StandardErrorPath</key><string>$LOGS/server.log</string>
</dict></plist>
PLIST

cat > "$LA/com.jobhunter.pull.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.jobhunter.pull</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string><string>-c</string>
    <string>cd "$REPO" &amp;&amp; "$GIT" pull --rebase --autostash --quiet >> "$LOGS/pull.log" 2>&amp;1 || true</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>1800</integer>
  <key>StandardOutPath</key><string>$LOGS/pull.log</string>
  <key>StandardErrorPath</key><string>$LOGS/pull.log</string>
</dict></plist>
PLIST

for L in com.jobhunter.server com.jobhunter.pull; do
  launchctl unload "$LA/$L.plist" 2>/dev/null || true
  launchctl load "$LA/$L.plist"
done

echo "✓ Installed. The control panel now starts automatically and stays at:"
echo "    http://localhost:8090   (bookmark it)"
echo "  Fresh cloud-scraped data is pulled every ~30 min and just after you wake the laptop."
echo "  Stop everything:  bash scraper/deploy/uninstall.sh"
