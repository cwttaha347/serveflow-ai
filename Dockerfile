# --- Stage 1: Build Frontend ---
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
# Copy dependency files first for better caching
COPY frontend/package*.json ./
RUN npm install
# Copy frontend source
COPY frontend/ ./
# Build the production assets with the correct base path
ENV NODE_ENV=production
RUN npm run build


# --- Stage 2: Final Backend Image ---
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Install Backend dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn uvicorn daphne whitenoise

# Copy Backend code
COPY backend/ .

# Prepare static files directory
RUN mkdir -p /app/staticfiles

# Copy built frontend assets from Stage 1 into Backend's served directory
# Vite defaults to 'dist' folder
COPY --from=frontend-builder /app/frontend/dist /app/frontend_dist

# Set up Hugging Face compatible environment
# HF Spaces run with user 1000
RUN useradd -m -u 1000 user
RUN chown -R user:user /app
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PORT=7860

# Expose the mandatory HF port
EXPOSE 7860

# We use daphne to support both HTTP and WebSockets for your chat feature
CMD ["sh", "-c", "python manage.py collectstatic --noinput && daphne -b 0.0.0.0 -p 7860 serveflow.asgi:application"]
