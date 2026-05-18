# ServeFlow AI

**ServeFlow AI** is an AI-powered home and professional services marketplace. Customers post jobs with photos or a guided chatbot flow; verified providers bid; the platform handles matching, invoicing, Stripe payments, and reviews—with real-time notifications over WebSockets.

## Problem & solution

| Problem | ServeFlow approach |
|--------|---------------------|
| Finding trusted local providers is slow and opaque | Verified provider onboarding, ratings, and admin oversight |
| Quotes and scope are unclear | AI-assisted request analysis (category, severity, budget hints) |
| Coordination after booking is fragmented | Jobs, bids, invoices, messaging, and status updates in one place |
| Payments lack transparency | Invoices, Stripe Checkout, commission splits, provider ledger |

## Architecture (Docker)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  frontend   │────▶│   backend    │────▶│     db      │
│  :80 (web)  │     │  :8000 API   │     │  PostgreSQL │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   ┌───────────┐   ┌─────────────┐   ┌────────────────┐
   │   redis   │   │ ai_service  │   │matching_service│
   │  :6379    │   │   :8001     │   │     :8002      │
   └───────────┘   └─────────────┘   └────────────────┘
                           │
                    ┌──────▼──────┐
                    │celery_worker│
                    └─────────────┘
```

| Service | Role | Host port |
|---------|------|-----------|
| `frontend` | React SPA (nginx) | **80** → http://localhost |
| `backend` | Django REST + Daphne (HTTP + WebSocket) | **8000** |
| `db` | PostgreSQL 15 | 5432 |
| `redis` | Channels / Celery broker | 6379 |
| `ai_service` | Gemini workflows (analysis, verification) | 8001 |
| `matching_service` | Provider scoring / proximity | 8002 |
| `celery_worker` | Async email and background tasks | — |

API and admin: `http://localhost:8000` · Health: `http://localhost:8000/health/`

## Prerequisites

- **Windows 10/11** (primary dev path)
- **Docker Desktop** installed and running (WSL2 backend recommended)
- Optional: `credentials.txt` at repo root for SMTP, Stripe, and Gemini keys (see below)

## Quick start (Windows)

**One-click (recommended on a new machine):**

1. Clone the repo.
2. (Optional) Copy and fill `credentials.txt` at the repo root.
3. Double-click **`setup-and-run.bat`** or from PowerShell:

```bat
.\setup-and-run.bat
```

Skip demo seed data:

```bat
.\setup-and-run.bat --no-seed
```

**Manual equivalent:**

```bat
docker compose down
docker compose build
docker compose up -d
docker compose exec backend python manage.py migrate --noinput
docker compose exec backend python manage.py sync_credentials_file --force
docker compose exec backend python manage.py seed_serveflow_v2
```

First startup can take 1–3 minutes while Postgres, migrations, and health checks complete.

## Default URLs & test accounts

| URL | Purpose |
|-----|---------|
| http://localhost | Main app (customer / provider UI) |
| http://localhost:8000/admin/ | Django admin |
| http://localhost:8000/api/ | REST API root |
| http://localhost:8000/health/ | Backend health |

After **`seed_serveflow_v2`** (default in `setup-and-run.bat`):

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Admin (alt) | `Taha` | `Taha#@12345` |
| Providers | `pro_plumber`, `pro_electric`, `pro_clean`, `pro_hvac`, `pro_painter`, `pro_carpenter` | `user12345` |
| Customers | `customer1` … `customer5` | `user12345` |

Seeded users have `is_email_verified=True` so you can log in without OTP in local demos.

## `credentials.txt` setup

Place **`credentials.txt`** at the **repository root** (mounted read-only into backend/celery containers). Use bracketed values and labeled sections—see **`docs/ServeFlow-Documentation.md`** (Operations → credentials format) for the full template.

**Do not commit real secrets.** Add `credentials.txt` to `.gitignore` if it is not already ignored.

Sync into the database (`SystemSettings` singleton):

```bat
docker compose exec backend python manage.py sync_credentials_file --force
```

`--force` overwrites SMTP/Stripe/Gemini fields from the file; without it, only empty DB fields are filled.

## Common troubleshooting

### 502 Bad Gateway right after `docker compose up`

The **frontend** nginx proxy waits for **backend** health. On a cold start this can take **90+ seconds**. Wait, then refresh http://localhost. Check status:

```bat
docker compose ps
curl http://localhost:8000/health/
```

If backend stays unhealthy: `docker compose logs backend --tail 80`

### Category or profile images missing

Media files live under `backend/media/` and are served by Django in DEBUG. Ensure the backend volume mount exists and you ran migrations. After seeding, category icons use Lucide names; uploaded images use paths under `/media/`.

### OTP / verification email not received

1. Configure SMTP in `credentials.txt` and run `sync_credentials_file --force`.
2. OTP is sent only for **existing** accounts (unknown emails get a generic response).
3. In Docker dev, `CELERY_TASK_ALWAYS_EAGER=true` runs sends in-process—check **Django admin → Email logs** for failures.
4. For Gmail, use an **app password**, not your normal login password.

### AI analysis fails

Ensure at least one `API_KEY_1` … `API_KEY_5` is set in `credentials.txt` and synced, or set `GEMINI_API_KEY` in `ai_service` environment. Check `docker compose logs ai_service`.

## Full documentation

| Document | Description |
|----------|-------------|
| **[docs/ServeFlow-Documentation.md](docs/ServeFlow-Documentation.md)** | Master guide (user + technical + operations) |
| **[docs/ServeFlow-Documentation.docx](docs/ServeFlow-Documentation.docx)** | Word export (generate with script below) |
| [docs/TECHNICAL.md](docs/TECHNICAL.md) | Additional architecture notes |
| [docs/API_DOCS.md](docs/API_DOCS.md) | Endpoint reference |
| [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) | Deployment and env details |

**Generate Word document from markdown:**

```bat
pip install python-docx
python docs/generate_docx.py
```

Or with Pandoc:

```bat
pandoc docs/ServeFlow-Documentation.md -o docs/ServeFlow-Documentation.docx
```

## Tech stack (summary)

- **Frontend:** React 19, Vite, Tailwind
- **Backend:** Django 5, DRF, Channels, Daphne, Celery
- **Data:** PostgreSQL, Redis
- **AI:** Google Gemini (`ai_service`), custom matching (`matching_service`)
- **Payments:** Stripe

## License

MIT — see repository license file.
