# 7seconds

This repository contains a simple full-stack app: a Flask backend and a React frontend. The app awards a point every 7 seconds when the timer runs and persists the score to SQLite.

Services
- Backend: Python Flask, exposes /api/health and /api/score
- Frontend: React app served by nginx

Ports
- Frontend: http://localhost:7777
- Backend: http://localhost:3001

Run with Docker Compose

1. Build and start the services:

```powershell
docker compose up --build
```

2. Open the frontend in your browser at http://localhost:7777

Notes
- The SQLite database is stored in a Docker volume named `db_data` and mounted at `/data/score.db` in the backend container.
