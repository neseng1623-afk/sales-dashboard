# React Vite + FastAPI + PostgreSQL

This project is split into:

- `frontend/`: React + Vite UI
- `backend/`: FastAPI API server
- `postgres`: PostgreSQL service managed by Docker Compose

## Run with Docker

```bash
docker compose up --build
```

Open:

- Frontend: http://localhost:5173
- Backend API docs: http://localhost:8000/docs

## API

`GET /sales-row` returns rows from PostgreSQL table `sales_row`.

Query params:

- `limit`: default `100`, max `1000`
- `offset`: default `0`

## Local Development

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

