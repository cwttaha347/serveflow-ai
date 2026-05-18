# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    libheif-dev \
    libde265-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn uvicorn daphne

# Copy project
COPY . /app/

# Bake admin/static assets at build time so container start does not block on collectstatic.
ENV SECRET_KEY=collectstatic-build-only \
    DEBUG=0 \
    DATABASE_URL=sqlite:////tmp/collectstatic.db
RUN python manage.py collectstatic --noinput

# Outside /app so dev volume mount (./backend:/app) cannot overwrite with CRLF host copy
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 8000

CMD ["sh", "/docker-entrypoint.sh"]
