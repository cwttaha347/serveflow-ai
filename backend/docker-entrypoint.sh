#!/bin/sh
set -e

echo "[entrypoint] Running migrations..."
python manage.py migrate --noinput

echo "[entrypoint] Syncing credentials.txt into SystemSettings..."
python manage.py sync_credentials_file --force || echo "[entrypoint] WARN: sync_credentials_file failed (continuing)"

# Do not block Daphne on collectstatic (can take 30s+ with volume-mounted staticfiles).
# Image build runs collectstatic; this refreshes assets when ./backend is mounted in dev.
if [ "${COLLECTSTATIC_ON_START:-1}" = "1" ]; then
  echo "[entrypoint] Collecting static files in background..."
  python manage.py collectstatic --noinput &
fi

echo "[entrypoint] Starting Daphne on :8000..."
exec daphne -b 0.0.0.0 -p 8000 serveflow.asgi:application
