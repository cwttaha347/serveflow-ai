# ServeFlow AI - Koyeb Deployment Guide

This guide describes how to deploy the ServeFlow AI project on Koyeb free hosting.

## Prerequisites
1.  **Koyeb Account**: Sign up at [koyeb.com](https://www.koyeb.com/)
2.  **GitHub Repository**: Ensure your project is pushed to GitHub.
3.  **PostgreSQL Database**: Koyeb provides a managed PostgreSQL. You'll need the connection string.
4.  **Redis (Optional but Recommended)**: For WebSocket support, use [Upstash Redis](https://upstash.com/) (Free Tier).

## Deployment Steps

### 1. Create a New Web Service on Koyeb
Connect your GitHub repository and follow these settings for each service:

#### **Backend (Django)**
- **Service Name**: `serveflow-backend`
- **Build Command**: `sh build.sh`
- **Run Command**: `daphne -b 0.0.0.0 -p $PORT serveflow.asgi:application`
- **Environment Variables**:
  - `DEBUG`: `False`
  - `SECRET_KEY`: (Generate a random string)
  - `ALLOWED_HOSTS`: `serveflow-backend.koyeb.app,localhost`
  - `DATABASE_URL`: (Your PostgreSQL connection string)
  - `REDIS_URL`: (Your Redis connection string, or leave empty for in-memory)
  - `CORS_ALLOWED_ORIGINS`: `https://serveflow-frontend.koyeb.app`

#### **Frontend (React)**
- **Service Name**: `serveflow-frontend`
- **Build Command**: `npm install && npm run build`
- **Run Command**: (Koyeb handles static serving from `dist/` if configured as a Static Site)
- **Environment Variables**:
  - `VITE_API_URL`: `https://serveflow-backend.koyeb.app/api/`
  - `VITE_WS_URL`: `wss://serveflow-backend.koyeb.app/ws/notifications/`

#### **AI Service (FastAPI)**
- **Service Name**: `serveflow-ai`
- **Run Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Environment Variables**:
  - `GEMINI_API_KEY`: (Your Google Gemini API Key)

#### **Matching Service (FastAPI)**
- **Service Name**: `serveflow-matching`
- **Run Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 2. Database Migrations
Once the backend is healthy, you need to run migrations:
1.  Go to the **Backend Service** in Koyeb console.
2.  Open the **Console** tab.
3.  Run: `python manage.py migrate`
4.  (Optional) Run: `python manage.py createsuperuser`
5.  (Optional) Run: `python manage.py create_sample_data`

### 3. Static Files
Static files are handled by **WhiteNoise** in the backend and compiled into `dist/` in the frontend.

## Troubleshooting
- **WebSocket Connection Failed**: Ensure `VITE_WS_URL` starts with `wss://` and `REDIS_URL` is correctly set in the backend.
- **CSRF Errors**: Double check `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS`.
- **Database Connection Error**: Ensure `DATABASE_URL` is correct and the PostgreSQL service is active.

## Useful Commands
- `python manage.py check --deploy`: Run Django deployment checklist.
- `python manage.py collectstatic --noinput`: Manually collect static files.
