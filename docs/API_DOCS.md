# ServeFlow AI - API Documentation

## Overview
This document outlines the key API endpoints for the ServeFlow platform, including the Django Core API and the FastAPI Microservices.

## Authentication (Django)
*   **POST** `/api/token/` - Obtain JWT access/refresh tokens.
*   **POST** `/api/token/refresh/` - Refresh access token.
*   **POST** `/api/register/` - Register a new user (Client or Provider).

## Service Requests
*   **GET** `/api/requests/` - List all requests (filtered by user/provider).
*   **POST** `/api/requests/` - Create a new service request.
    *   *Triggers async call to AI Service.*
*   **GET** `/api/requests/{id}/` - Get details of a specific request.

## Jobs & Bids
*   **POST** `/api/bids/` - Provider submits a bid for a request.
*   **POST** `/api/jobs/` - User accepts a bid, creating a Job.
*   **PATCH** `/api/jobs/{id}/` - Update job status (started, completed).

## AI Service (FastAPI - Port 8001)
*   **POST** `/ai/analyze-request`
    *   **Input**: Title, Description, Category.
    *   **Output**: Structured summary, urgency, complexity, estimated duration.
*   **POST** `/ai/analyze-image`
    *   **Input**: Image file.
    *   **Output**: visual description, detected tools/parts.

## Matching Service (FastAPI - Port 8002)
*   **POST** `/match/providers`
    *   **Input**: Request location, category.
    *   **Output**: List of ranked provider IDs with match scores.
