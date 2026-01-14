# ServeFlow AI - AI-Powered Service Marketplace

## 🚀 Overview
**ServeFlow AI** is an intelligent service aggregator platform powered by Google Gemini AI that connects customers with verified service providers through smart matching, real-time notifications, and a comprehensive bidding system.

## ✨ Key Features

### 🔐 Authentication & User Management
- Multi-role system: **Customer**, **Provider**, **Admin**
- Login with email **or** username
- Unified login/registration interface with split-screen design
- Token-based authentication (DRF)
- Role-based dashboards and permissions

### 🤖 AI-Powered Matching (Google Gemini)
- **Category Detection**: Auto-categorize service requests
- **Provider Matching**: Smart scoring based on:
  - Service category alignment
  - Geographic proximity (Haversine distance)
  - Provider ratings & completed jobs
  - Real-time availability
- **Image Analysis**: Analyze uploaded service images
- **Confidence Scoring**: AI-powered match quality metrics

### 💼 Service Request Management
- Create detailed service requests with:
  - Title, description, location, budget
  - Preferred date/time
  - Image uploads (optional)
- **Broadcasting**: Requests sent to all available providers in category
- **AI Analysis**: Automatic categorization and urgency detection
- **Request Tracking**: Real-time status updates

### 🏆 Bidding System
- **Browse Requests**: Providers view open job opportunities
- **Submit Bids**: Providers propose pricing & timeline
- **Bid Management**: Customers review, accept/reject bids
- **Automatic Assignment**: Winning bid creates active job
- **Email Notifications**: Alerts for new bids and acceptances

### 📋 Job Lifecycle Management
- **Status Tracking**: Pending → Accepted → Started → Completed
- **Race Condition Protection**: Jobs auto-cancel when provider accepts
- **Provider Actions**: Accept, Start, Complete jobs
- **Real-time Updates**: WebSocket notifications for all parties
- **Earnings Calculation**: Automatic commission & provider earnings

### 💰 Invoicing & Payments
- Auto-generated invoices on job completion
- Commission-based revenue model (admin-configurable)
- Payment tracking (paid/unpaid status)
- Revenue analytics for admins

### ⭐ Reviews & Ratings
- Customers leave reviews after job completion
- 5-star rating system
- **Dynamic Provider Ratings**: Auto-updated from reviews
- Review visibility on provider profiles

### 🔔 Real-time Notifications (WebSocket)
- **Django Channels + Daphne** for WebSocket support
- Live toast notifications for:
  - New job assignments (Providers)
  - Job status changes (Customers)
  - Bid submissions & acceptances
- **Token Authentication**: Secure WebSocket connections
- **Auto-reconnection**: Resilient connection management

### 📧 Email Notification System
- Automated emails for:
  - New service requests (Providers)
  - New bid submissions (Customers)
  - Bid acceptances (Providers)
  - Job status updates
  - Invoice generation
- Console backend for development, SMTP ready for production

### 🔍 Audit Logging
- Comprehensive activity tracking
- Admin-only access
- Filterable by user, action, model, date range
- CSV export for compliance
- Read-only interface

### 🛡️ Admin Dashboard
- **System Overview**: Users, providers, jobs, revenue stats
- **Provider Verification**: Approve/reject provider applications
- **Request Monitoring**: View all service requests
- **Job Management**: Track all jobs across platform
- **Commission Settings**: Configure platform commission rates
- **Category Management**: Add/edit service categories
- **Audit Logs**: Full activity tracking
- **AI Performance Metrics**: Matching accuracy stats

## 🏗️ Architecture

```
┌─────────────────┐      ┌───────────────────┐      ┌──────────────┐
│  React Frontend │─────▶│  Django Backend   │─────▶│   SQLite DB  │
│   (Port 5173)   │      │   (Port 8000)     │      │              │
└─────────────────┘      └───────────────────┘      └──────────────┘
         │                        │
         │                        │
         │                        ▼
         │               ┌───────────────────┐
         └──────────────▶│  WebSocket (WS)   │
                         │  Django Channels  │
                         └───────────────────┘
```

## 📚 Detailed Documentation
Comprehensive documentation for developers and stakeholders:
*   **[Project Report](file:///e:/ServeFlow-ai/docs/REPORT.md)**: Problem statement, research questions, and technology deep-dive.
*   **[Technical Architecture](file:///e:/ServeFlow-ai/docs/TECHNICAL.md)**: System diagrams, sequence maps, and database ERD.
*   **[API Reference](file:///e:/ServeFlow-ai/docs/API_DOCS.md)**: Exhaustive list of endpoints with request/response examples.
*   **[Deployment & Infrastructure](file:///e:/ServeFlow-ai/docs/INFRASTRUCTURE.md)**: Environment variables, setup guides, and production hardening.

## 🚀 Setup Instructions

### Prerequisites
- Python 3.13+
- Node.js 18+
- npm or yarn

### 1. Backend Setup (Django)
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

**Backend runs on**: `http://localhost:8000`

### 2. Frontend Setup (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

**Frontend runs on**: `http://localhost:5173`

## 📡 API Reference

### Authentication
- `POST /api/auth/login/` - Login (username/email + password)
- `POST /api/users/` - Register new user

### Users & Providers
- `GET /api/users/` - List all users (admin)
- `GET /api/users/me/` - Get current user profile
- `GET /api/providers/` - List providers
- `PATCH /api/providers/{id}/` - Update provider (verify, etc.)

### Service Requests
- `GET /api/requests/` - List requests
- `POST /api/requests/` - Create request
- `GET /api/requests/{id}/` - Get request details (returns: `{request, job, hasReview}`)
- `POST /api/requests/{id}/ai_match/` - AI-powered provider matching

### Jobs
- `GET /api/jobs/` - List jobs (filtered by role)
- `POST /api/jobs/{id}/accept/` - Accept job (provider)
- `POST /api/jobs/{id}/start/` - Start job
- `POST /api/jobs/{id}/complete/` - Complete job

### Bidding
- `GET /api/bids/` - List bids (filtered by role)
- `POST /api/bids/` - Submit bid (provider)
- `POST /api/bids/{id}/accept/` - Accept bid (customer)
- `POST /api/bids/{id}/reject/` - Reject bid

### Reviews & Invoices
- `POST /api/reviews/` - Create review (payload: `{job_id, rating, comment}`)
- `GET /api/invoices/` - List invoices
- `POST /api/invoices/{id}/mark_paid/` - Mark invoice as paid

### Categories
- `GET /api/categories/` - List service categories

### Audit Logs (Admin Only)
- `GET /api/audit-logs/` - List audit logs (filterable)

### WebSocket
- `ws://localhost:8000/ws/notifications/?token=<AUTH_TOKEN>` - Real-time notifications

## 💾 Database Schema

### Key Models
- **User**: Authentication, roles (user/provider/admin)
- **Provider**: Profile, ratings, categories, verification status
- **Category**: Service types (Plumbing, Electrical, etc.)
- **Request**: Service requests from customers
- **Job**: Work assignments linking requests to providers
- **Bid**: Provider proposals on open requests
- **Invoice**: Payment documents for completed jobs
- **Review**: Customer feedback on completed jobs
- **AuditLog**: System activity tracking

**Database**: SQLite (development), PostgreSQL ready (production)

## 🔧 Environment Variables

Create `.env` in backend directory:

```env
# Django
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (optional - defaults to SQLite)
# DATABASE_URL=postgresql://user:pass@localhost/serveflow

# Email (production)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=ServeFlow AI <noreply@serveflow.ai>

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Google Gemini (Optional - if using external AI service)
GEMINI_API_KEY=your-gemini-api-key
```

## 🧪 Testing

### Test Accounts
After running `create_sample_data.py`, you'll have:

- **Admin**: `admin` / `admin123`
- **Provider**: `john` / `john123` (Electrician)
- **Customer**: `alice` / `alice123`

### Manual Testing Flow
1. **Register** as customer or provider
2. **Customer Flow**:
   - Create service request
   - Receive bids from providers
   - Accept a bid
   - Track job progress
   - Leave review
3. **Provider Flow**:
   - Browse open requests
   - Submit bids
   - Accept assigned jobs
   - Update job status
   - View earnings
4. **Admin Flow**:
   - Verify new providers
   - Monitor all requests/jobs
   - Adjust commission rates
   - Review audit logs

## 📦 Tech Stack

### Backend
- **Django 5.1** - Web framework
- **Django REST Framework** - API development
- **Django Channels 4.3** - WebSocket support
- **Daphne 4.2** - ASGI server
- **SQLite** - Database (dev), PostgreSQL (prod)

### Frontend
- **React 19** - UI library
- **Vite** - Build tool
- **React Router 6** - Navigation
- **Axios** - HTTP client
- **Framer Motion** - Animations
- **Lucide React** - Icons
- **TailwindCSS** (via index.css) - Styling

### Real-time
- **WebSocket** - Bidirectional communication
- **InMemoryChannelLayer** (dev) / **Redis** (prod)

## 🚀 Deployment

### Security Checklist
- [ ] Set `DEBUG=False`
- [ ] Generate new `SECRET_KEY`
- [ ] Configure `ALLOWED_HOSTS`
- [ ] Set up HTTPS/SSL
- [ ] Update `CORS_ALLOWED_ORIGINS`
- [ ] Switch to SMTP email backend
- [ ] Migrate to PostgreSQL database

### Production Configuration
- Use **Redis** for channel layer (WebSocket scalability)
- Configure static file serving (`collectstatic`)
- Set up media file storage (AWS S3/similar)
- Enable database connection pooling
- Configure logging

### Recommended Hosting
- **Backend**: Koyeb (Free Tier), Railway, Fly.io
- **Frontend**: Koyeb (Static site), Vercel, Netlify
- **Database**: Koyeb Managed PostgreSQL
- **Redis**: Upstash Redis (Free Tier)

### 🚀 Deploy to Koyeb
For detailed instructions on deploying this project to Koyeb, see the **[Koyeb Deployment Guide](file:///E:/ServeFlow-ai/DEPLOYMENT.md)**.

## 📄 License
MIT License

## 🤝 Contributing
Contributions welcome! Please open an issue or PR.

---

**Built with ❤️ using Django, React, and Google Gemini AI by cwttaha347**
