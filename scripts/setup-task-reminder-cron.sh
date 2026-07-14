#!/usr/bin/env bash
#
# setup-task-reminder-cron.sh
#
# Installs a crontab entry that hits the new
# POST /api/cron/send-task-reminders endpoint on a schedule, the same
# way the existing /api/cron/process-emails and /api/cron/detect-bounces
# endpoints are (presumably) triggered on this self-hosted box.
#
# Usage:
#   ./scripts/setup-task-reminder-cron.sh
#
# Environment variables (set these before running, or export them in your shell):
#   APP_URL                  Base URL of the deployed app, e.g. https://dashboard.example.edu
#   EMAIL_QUEUE_CRON_SECRET  The same secret configured in .env for the app
#   SCHEDULE                 Optional cron schedule expression. Default: "0 8 * * *" (daily at 08:00)
#
# What this script does:
#   1. Validates required env vars are present.
#   2. Renders a crontab line that POSTs to the reminder endpoint with the
#      x-cron-token header set to EMAIL_QUEUE_CRON_SECRET.
#   3. Installs (or updates, if already present) that single line in the
#      current user's crontab, without touching any other existing cron entries.
#   4. Prints the resulting crontab so you can confirm it.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env}"

# Fall back to reading APP_URL / EMAIL_QUEUE_CRON_SECRET from .env if they
# aren't already set in the environment. This lets the script run fully
# unattended (e.g. from deploy.yml) without anyone exporting vars by hand.
if [[ -f "$ENV_FILE" ]]; then
  if [[ -z "${APP_URL:-}" ]]; then
    APP_URL="$(grep -E '^NEXT_PUBLIC_APP_URL=' "$ENV_FILE" | tail -n1 | cut -d'=' -f2- | tr -d '"'"'"' \r')"
  fi
  if [[ -z "${EMAIL_QUEUE_CRON_SECRET:-}" ]]; then
    EMAIL_QUEUE_CRON_SECRET="$(grep -E '^EMAIL_QUEUE_CRON_SECRET=' "$ENV_FILE" | tail -n1 | cut -d'=' -f2- | tr -d '"'"'"' \r')"
  fi
fi

APP_URL="${APP_URL:-}"
EMAIL_QUEUE_CRON_SECRET="${EMAIL_QUEUE_CRON_SECRET:-}"
SCHEDULE="${SCHEDULE:-0 8 * * *}"
ENDPOINT_PATH="/api/cron/send-task-reminders"
MARKER="# task-reminder-cron (managed by scripts/setup-task-reminder-cron.sh)"

if [[ -z "$APP_URL" ]]; then
  echo "ERROR: APP_URL is not set and NEXT_PUBLIC_APP_URL was not found in $ENV_FILE." >&2
  echo "       Either add NEXT_PUBLIC_APP_URL to .env, or export APP_URL=https://dashboard.example.edu before running." >&2
  exit 1
fi

if [[ -z "$EMAIL_QUEUE_CRON_SECRET" ]]; then
  echo "ERROR: EMAIL_QUEUE_CRON_SECRET is not set and was not found in $ENV_FILE." >&2
  exit 1
fi

# Strip any trailing slash from APP_URL
APP_URL="${APP_URL%/}"
FULL_URL="${APP_URL}${ENDPOINT_PATH}"

CRON_LINE="${SCHEDULE} curl -fsS -X POST -H \"x-cron-token: ${EMAIL_QUEUE_CRON_SECRET}\" \"${FULL_URL}\" >> /var/log/task-reminder-cron.log 2>&1 ${MARKER}"

echo "Preparing to install the following crontab entry:"
echo "  ${CRON_LINE}"
echo

# Grab existing crontab (if any), drop any previous line we installed, append the new one
TMP_CRON="$(mktemp)"
trap 'rm -f "$TMP_CRON"' EXIT

if crontab -l > /dev/null 2>&1; then
  crontab -l | grep -vF "$MARKER" > "$TMP_CRON" || true
else
  : > "$TMP_CRON"
fi

echo "$CRON_LINE" >> "$TMP_CRON"

crontab "$TMP_CRON"

echo "Crontab installed/updated. Current crontab:"
echo "----------------------------------------"
crontab -l
echo "----------------------------------------"
echo
echo "Log output will be written to /var/log/task-reminder-cron.log"
echo "(create it with 'sudo touch /var/log/task-reminder-cron.log && sudo chown \$USER /var/log/task-reminder-cron.log' if it doesn't exist and you lack write permission to /var/log)"
echo
echo "To test the endpoint immediately without waiting for the schedule, run:"
echo "  curl -X POST -H \"x-cron-token: \$EMAIL_QUEUE_CRON_SECRET\" \"${FULL_URL}\""
