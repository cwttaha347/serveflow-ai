# ServeFlow AI - API Documentation Reference

## 1. Authentication & User Management
Endpoints for securing the platform and managing accounts.

### 1.1 Login (Get Token)
*   **POST** `/api/auth/login/`
*   **Body**: `{ "username": "...", "password": "..." }`
*   **Response**: `{ "token": "...", "user_id": 1, "role": "user" }`

### 1.2 User Profile (Self)
*   **GET/PUT/PATCH** `/api/users/me/`
*   **Description**: Get or update current user details including the attached `profile` object.
*   **Response**: 
    ```json
    {
      "id": 1,
      "username": "jdoe",
      "email": "john@example.com",
      "profile": {
        "bio": "Expert plumber",
        "latitude": 40.7128,
        "longitude": -74.0060
      }
    }
    ```

---

## 2. Service Request Management
The core workflow for posting and managing help requests.

### 2.1 AI Image Analysis
*   **POST** `/api/requests/ai-analyze/`
*   **Content-Type**: `multipart/form-data`
*   **Body**: `image` (File)
*   **Response**:
    ```json
    {
      "analysis": {
        "suggested_title": "Emergency Sink Leak",
        "suggested_description": "Water dripping from the main pipe...",
        "category_id": 5,
        "estimated_budget_range": "$120 - $250"
      }
    }
    ```

### 2.2 Create Request
*   **POST** `/api/requests/`
*   **Body**:
    ```json
    {
      "title": "Sink Repair",
      "description": "Fixed leaking sink in kitchen",
      "category_id": 5,
      "address": "123 Main St",
      "budget": 150.00,
      "preferred_date": "2026-01-12T10:00:00Z"
    }
    ```

### 2.3 List My Requests
*   **GET** `/api/requests/my_requests/`
*   **Returns**: List of requests created by the authenticated user.

---

## 3. Bidding & Matching
Connecting users with providers.

### 3.1 AI Match (Recommendations)
*   **POST** `/api/requests/{id}/ai_match/`
*   **Description**: Returns top 10 providers in the same category, ranked by the match scoring engine.
*   **Response**:
    ```json
    {
      "matched_providers": [
        {
          "provider_name": "ProPlumb",
          "match_score": 95.5,
          "distance_km": 2.4
        }
      ]
    }
    ```

### 3.2 Submit Bid
*   **POST** `/api/bids/`
*   **Body**: `{ "request": 10, "amount": "140.00", "proposal": "I can be there in 20 mins." }`

### 3.3 Accept Bid
*   **POST** `/api/bids/{id}/accept/`
*   **Description**: Changes bid to 'accepted', creates a `Job`, and marks the request as 'assigned'.

---

## 4. Job Operations
Lifecycle of a service engagement.

### 4.1 Update Job Status
*   **POST** `/api/jobs/{id}/start/` - Mark work as in-progress.
*   **POST** `/api/jobs/{id}/complete/` - Mark work as done and auto-generate invoice.
*   **POST** `/api/jobs/{id}/cancel/` - Terminate the job.

### 4.2 Invoices
*   **POST** `/api/invoices/{id}/mark_paid/`
*   **Description**: Administrative endpoint to confirm receipt of funds.

---

## 5. Intelligence Services (Microservices)
These are internal APIs often called by the Django monolith.

### 5.1 Request Diagnosis (FastAPI)
*   **POST** `/api/categories/diagnose/`
*   **Body**: `{ "description": "some text" }`
*   **Output**: Returns the `category_id` most likely represented by the text.

---

## 6. Messaging
Real-time chat support.

### 6.1 Send Message
*   **POST** `/api/messages/`
*   **Body**: `{ "job": 5, "content": "I am outside the building." }`

### 6.2 Mark Read
*   **POST** `/api/messages/mark_read/`
*   **Body**: `{ "job_id": 5 }`
