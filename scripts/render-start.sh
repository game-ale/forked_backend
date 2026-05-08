#!/usr/bin/env bash
set -euo pipefail

# Start both the Python FastAPI app and the Node app, and ensure child processes
# are terminated when the container receives SIGTERM/SIGINT.

export PORT=${PORT:-8000}
PYTHON_PORT=${PYTHON_PORT:-8001}
SHUTDOWN_HANDLED=0

start_python() {
  echo "Starting Python FastAPI on port ${PYTHON_PORT}"
  python3 -m uvicorn analytics.main:app --host 0.0.0.0 --port "${PYTHON_PORT}" &
  PY_PID=$!
}

start_node() {
  echo "Starting Node app"
  npm start &
  NODE_PID=$!
}

term_handler() {
  if [ "${SHUTDOWN_HANDLED}" -eq 1 ]; then
    return
  fi
  SHUTDOWN_HANDLED=1
  echo "Shutting down..."
  if [ -n "${NODE_PID-}" ]; then
    kill -TERM "${NODE_PID}" 2>/dev/null || true
  fi
  if [ -n "${PY_PID-}" ]; then
    kill -TERM "${PY_PID}" 2>/dev/null || true
  fi
  wait || true
}

trap 'term_handler; exit 143' TERM INT

start_python
start_node

# Wait for any process to exit and then terminate the other
set +e
wait -n
EXIT_STATUS=$?
set -e
term_handler
exit ${EXIT_STATUS}
