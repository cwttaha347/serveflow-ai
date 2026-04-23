# Infrastructure & Deployment Guide: ServeFlow AI

## 1. Environment Configuration
ServeFlow AI requires several sensitive keys to operate. These should be placed in a `.env` file in the `backend/` directory.

### 1.1 Core Backend Settings
| Variable | Description | Default |
| :--- | :--- | :--- |
| `DEBUG` | Enable/Disable Django debug mode | `True` |
| `SECRET_KEY` | Django security secret | `CHANGEME` |
| `ALLOWED_HOSTS` | Domains for API access | `localhost,127.0.0.1` |

### 1.2 Data Persistence
| Variable | Description | Usage |
| :--- | :--- | :--- |
| `DATABASE_URL` | Connection string for PostgreSQL | Production |
| `REDIS_URL` | Connection for Channels/Cache | `redis://localhost:6379/1` |

### 1.3 AI Intelligence (Gemini)
Gemini keys are managed via the **Admin Dashboard** for dynamic rotation, but can be seeded via environment:
*   `GEMINI_API_KEY`: Primary key for AI Service microservice.

---

## 2. External Dependencies
The platform relies on the following services being active:

1.  **Redis (v6+)**: Used as the `CHANNEL_LAYERS` broker for WebSockets.
2.  **PostgreSQL (v14+)**: Required for production geospatial queries via PostGIS.
3.  **Google AI Studio**: Source for Gemini Pro and Gemini Flash API keys.

---

## 3. Installation Protocol

### 3.1 Backend Setup
```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Run Migrations
python manage.py migrate

# Create Admin User
python manage.py createsuperuser

# Start Server
python manage.py runserver
```

### 3.2 Frontend Setup
```bash
# Navigate to frontend
cd frontend

# Install packages
npm install

# Start development server
npm run dev
```

### 3.3 AI Microservice Setup
The auxiliary AI and Matching services can be run independently for testing:
```bash
# Run AI Service (FastAPI)
cd ai_service
uvicorn main:app --port 8001 --reload

# Run Matching Service (FastAPI)
cd matching_service
uvicorn main:app --port 8002 --reload
```

---

## 4. Production Hardening
Before deploying to a live environment (e.g., AWS, Heroku, or DigitalOcean):
1.  **Collect Static**: `python manage.py collectstatic`
2.  **HTTPS**: Ensure `SECURE_SSL_REDIRECT = True` is set in `settings.py`.
3.  **Gunicorn/Uvicorn**: Use Gunicorn with Uvicorn workers for ASGI support.
4.  **Media Path**: Configure AWS S3 or similar for `MEDIA_ROOT`.

---

## 5. Security Protocols
*   **API Key Rotation**: Keys are stored in the `SystemSettings` table. If a key is leaked or rate-limited, it can be updated in real-time through the Admin UI without a server restart.
*   **WebSocket Privacy**: Connections are authenticated using the same Token mechanisms as the REST API.
