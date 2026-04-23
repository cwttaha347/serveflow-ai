# Technical Documentation: ServeFlow AI

## 1. System Architecture
ServeFlow AI utilizes a distributed microservices architecture designed for high throughput and fault tolerance.

```mermaid
graph TD
    subgraph "Client Layer (React v18)"
        UserClient[User Client]
        ProviderClient[Provider Client]
        AdminClient[Admin Portal]
    end
    
    subgraph "API Gateway Layer"
        Nginx[Nginx Load Balancer]
    end
    
    subgraph "Core Service Layer (Django)"
        Django[Django Core / DRF]
        WS[Daphne ASGI / WebSockets]
        ASync[Dramatiq/Celery Tasks]
    end
    
    subgraph "Intelligence Tier (FastAPI)"
        FAI[FastAPI AI Analysis]
        FME[FastAPI Matching Engine]
    end
    
    subgraph "Persistence & Cache"
        Postgres[(PostgreSQL + PostGIS)]
        Redis[(Redis Cache / Broker)]
    end
    
    subgraph "External Providers"
        Gemini[Google Gemini 1.5]
        S3[Media Storage]
    end

    UserClient --> Nginx
    ProviderClient --> Nginx
    AdminClient --> Nginx
    
    Nginx --> Django
    Nginx --> WS
    
    Django --> Postgres
    Django --> Redis
    Django --> FAI
    Django --> FME
    
    WS --> Redis
    
    FAI --> Gemini
    FME --> Postgres
```

---

## 2. Sequence Diagram: Service Request Protocol
This diagram illustrates the lifecycle of a request from initial visual scan to provider notification.

```mermaid
sequenceDiagram
    participant U as User (React)
    participant D as Django API
    participant AI as FastAPI (AI)
    participant G as Google Gemini
    participant M as FastAPI (Match)
    participant P as Provider (WebSocket)

    U->>D: POST /api/requests/ai-analyze/ (Image)
    D->>AI: analyze_image(image_bytes)
    AI->>G: Vision Query (Prompt + Image)
    G-->>AI: JSON Result (Title, Desc, Cat)
    AI-->>D: Structured Analysis
    D-->>U: AI Assessment Results
    
    U->>D: POST /api/requests/ (Confirm)
    D->>D: Save to Postgres
    D->>M: POST /match/providers (Location, Cat)
    M->>D: Query Available Providers
    M->>M: Calculate Match Scores
    M-->>D: Ranked Provider List
    
    D->>WS: Broadcast New Request
    WS-->>P: Socket Notification: "New Job Nearby"
```

---

## 3. Data Model (Detailed ERD)
The schema is optimized for geospatial proximity and historical performance tracking.

```mermaid
erDiagram
    USER ||--o| PROFILE : "1:1 Extension"
    USER ||--o| PROVIDER : "Optional 1:1"
    USER ||--o{ REQUEST : "Creates"
    
    PROVIDER }|--|{ CATEGORY : "Many-to-Many"
    PROVIDER ||--o{ BID : "Submits"
    PROVIDER ||--o{ JOB : "Assigned to"
    
    REQUEST }|--|| CATEGORY : "Classification"
    REQUEST ||--o{ BID : "Receives"
    REQUEST ||--o| JOB : "Becomes"
    
    JOB ||--o| INVOICE : "Generates"
    JOB ||--o| REVIEW : "1:1 Feedback"
    JOB ||--o{ MESSAGE : "History"

    CATEGORY {
        string name "Unique ID"
        string pricing_model "fixed | hourly | quote"
        decimal base_price "Starting at"
        boolean is_active "Soft delete flag"
    }
    
    PROVIDER {
        decimal rating "Aggregated mean"
        int completed_jobs "Global count"
        string availability "available | busy | offline"
        decimal latitude "Current location"
        decimal longitude "Current location"
    }

    REQUEST {
        string status "pending | open | assigned | done"
        json ai_summary "Cached Gemini output"
        decimal latitude "Service location"
        decimal longitude "Service location"
        datetime preferred_date "Target schedule"
    }
```

---

## 4. Logical Data Flow (Level 2)

### 4.1 AI Analysis Module (Process 2.0)
```mermaid
graph LR
    I[Raw Image/Text] --> P21[Sanitization & Scaling]
    P21 --> P22[Multi-Key Load Balancer]
    P22 --> P23[Gemini Inference]
    P23 --> P24[JSON Normalization]
    P24 --> P25[Category Map Matching]
    P25 --> O[Structural Assessment]
```

### 4.2 Matching Engine Module (Process 3.0)
```mermaid
graph TD
    R[Request Context] --> P31[Geospatial Filter]
    P31 -- "Radial Query" --> P32[Category Hard-Filter]
    P32 --> P33[Scoring Pipeline]
    
    subgraph "Scoring Pipeline"
        S1[Distance Score]
        S2[Rating Weight]
        S3[Exp. Bonus]
    end
    
    S1 & S2 & S3 --> P34[Sort & Cap]
    P34 --> O[Ranked Provider List]
```

---

## 5. Network & Infrastructure
*   **Protocol Support**: HTTP/1.1 for REST, WSS for real-time tracking.
*   **Media Storage**: Local storage (Dev) or S3-compatible (Prod) for user-uploaded site photos.
*   **Inter-Service Auth**: Internal HMAC or Shared Secret for FastAPI <-> Django communication.
