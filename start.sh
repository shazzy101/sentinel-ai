#!/bin/bash
# Sentinel — start backend + frontend (survives terminal close)
# Usage: bash start.sh        → start
#        bash start.sh stop   → stop both

ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV="$ROOT/venv/bin"
PID_FILE="$ROOT/.sentinel-pids"
BE_LOG="$ROOT/.sentinel-backend.log"
FE_LOG="$ROOT/.sentinel-frontend.log"

stop_sentinel() {
  if [ -f "$PID_FILE" ]; then
    while IFS= read -r pid; do
      kill "$pid" 2>/dev/null && echo "Stopped PID $pid"
    done < "$PID_FILE"
    rm -f "$PID_FILE"
    echo "Sentinel stopped."
  else
    echo "No PID file found — nothing to stop."
  fi
  exit 0
}

if [ "$1" = "stop" ]; then stop_sentinel; fi

# Kill any existing Sentinel processes
if [ -f "$PID_FILE" ]; then
  echo "Stopping previous Sentinel processes..."
  while IFS= read -r pid; do kill "$pid" 2>/dev/null; done < "$PID_FILE"
  rm -f "$PID_FILE"
  sleep 1
fi

# Start backend
echo "Starting backend on :8000..."
cd "$ROOT/backend"
nohup "$VENV/uvicorn" main:app --host 127.0.0.1 --port 8000 > "$BE_LOG" 2>&1 &
BACKEND_PID=$!
disown $BACKEND_PID
echo $BACKEND_PID >> "$PID_FILE"

sleep 3

# Verify backend came up
if ! kill -0 $BACKEND_PID 2>/dev/null; then
  echo "ERROR: Backend failed to start. Check $BE_LOG"
  cat "$BE_LOG" | tail -20
  exit 1
fi
echo "Backend UP (PID $BACKEND_PID)"

# Start frontend
echo "Starting frontend on :5173..."
cd "$ROOT/frontend"
nohup node_modules/.bin/vite > "$FE_LOG" 2>&1 &
FRONTEND_PID=$!
disown $FRONTEND_PID
echo $FRONTEND_PID >> "$PID_FILE"

sleep 3

# Verify frontend came up
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
  echo "ERROR: Frontend failed to start. Check $FE_LOG"
  cat "$FE_LOG" | tail -20
  exit 1
fi
echo "Frontend UP (PID $FRONTEND_PID)"

echo ""
echo "==================================="
echo "  Backend  → http://localhost:8000"
echo "  Frontend → http://localhost:5173"
echo "==================================="
echo "Both processes are running in background."
echo "To stop: bash $ROOT/start.sh stop"
echo "Backend log:  $BE_LOG"
echo "Frontend log: $FE_LOG"
