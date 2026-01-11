# Technical Documentation: ServeFlow AI

## 1. System Architecture
High-level overview of the ServeFlow microservices architecture.

```mermaid
graph TD
    UserClient[User Client (React)]
    ProviderClient[Provider Client (React)]
    AdminClient[Admin Client (React)]
    
    LB[Load Balancer / Nginx]
    
    subgraph "Backend Cluster"
        Django[Django Core API]
        FastAPI_AI[FastAPI AI Service]
        FastAPI_Match[FastAPI Matching Service]
        Redis[Redis Cache & Queue]
    end
    
    subgraph "Data Layer"
        PostgreSQL[(PostgreSQL Database)]
        GoogleGemini[Google Gemini API]
    end

    UserClient --> LB
    ProviderClient --> LB
    AdminClient --> LB
    
    LB --> Django
    
    Django --> PostgreSQL
    Django --> Redis
    Django -- "Async Task" --> FastAPI_AI
    Django -- "Async Task" --> FastAPI_Match
    
    FastAPI_AI --> GoogleGemini
    FastAPI_Match --> Django
    FastAPI_Match --> Redis
```

## 2. Entity Relationship Diagram (ERD)
Detailed schema of the relational database.

```mermaid
erDiagram
    User ||--o{ Profile : has
    User ||--o{ Provider : "is a"
    User ||--o{ Request : "creates"
    User ||--o{ Message : "sends/receives"
    
    Provider ||--o{ Job : "performs"
    Provider ||--o{ Bid : "makes"
    Provider ||--|| User : "extends"
    Provider }|--|{ Category : "specializes in"
    
    Request ||--o{ Job : "becomes"
    Request ||--o{ Bid : "receives"
    Request }|--|| Category : "belongs to"
    
    Job ||--o{ Review : "has"
    Job ||--o{ Invoice : "generates"
    Job ||--o{ Dispute : "may have"
    Job ||--o{ Message : "contains"
    
    Category {
        string name
        string pricing_model
        float base_price
    }
    
    User {
        string username
        string email
        string role
        boolean is_verified
    }
    
    Provider {
        float rating
        boolean verified
        string availability_status
        float earnings
    }
    
    Request {
        string title
        text description
        json ai_summary
        string status
        float budget
    }
    
    Job {
        string status
        datetime start_time
        datetime end_time
        float commission_rate
    }

    Invoice {
        float total
        boolean paid
        string payment_method
    }
```

## 3. Data Flow Diagrams (DFD)

### Level 0 DFD (Context Diagram)
```mermaid
graph LR
    User((User))
    Provider((Provider))
    Admin((Admin))
    System[ServeFlow System]
    
    User -- "Service Request" --> System
    User -- "Payment" --> System
    
    System -- "Service Confirmation" --> User
    System -- "Provider Details" --> User
    
    Provider -- "Availability" --> System
    Provider -- "Bid/Acceptance" --> System
    
    System -- "Job Notification" --> Provider
    System -- "Payout" --> Provider
    
    Admin -- "Policy/Config" --> System
    System -- "Reports/Logs" --> Admin
```

### Level 1 DFD (Request Processing)
```mermaid
graph TD
    User((User))
    P1[Request Processing]
    P2[AI Analysis]
    P3[Matching Engine]
    P4[Job Management]
    DB[(Database)]
    
    User -- "Submit Request" --> P1
    P1 -- "Raw Data" --> P2
    P2 -- "Structured Data (Gemini)" --> P1
    P1 -- "Save Request" --> DB
    
    P1 -- "Request Details" --> P3
    DB -- "Provider Data" --> P3
    P3 -- "Ranked Matches" --> P4
    
    P4 -- "Notify Provider" --> Provider((Provider))
```

## 4. User Flow Charts

### User Request Flow
```mermaid
flowchart TD
    Start([User Logs In]) --> Dashboard
    Dashboard --> CreateReq[Click 'New Request']
    CreateReq --> InputDetails[Enter Title, Desc, Address]
    InputDetails --> UploadImg[Upload Image (Optional)]
    UploadImg --> Submit
    
    Submit --> AI{AI Analysis}
    AI -- Processing --> Loading[Show Skeleton Loader]
    AI -- Success --> Summary[Show AI Summary & Key Points]
    
    Summary --> Confirm{Confirm Request?}
    Confirm -- No --> Edit[Edit Details]
    Confirm -- Yes --> Post[Post to Marketplace]
    
    Post --> Wait[Waiting for Bids/Match]
    Wait --> MatchFound[Provider Found]
    MatchFound --> Accept[Accept Provider]
    Accept --> Payment[Hold Payment]
    Payment --> JobStart([Job Started])
```

### Provider Job Flow
```mermaid
flowchart TD
    Start([Provider Logs In]) --> Dashboard
    Dashboard --> Toggle[Toggle Availability On]
    Toggle --> Listen[Listening for Jobs]
    
    Listen --> JobAlert{New Job Alert}
    JobAlert -- Ignore --> Listen
    JobAlert -- View --> Details[View Job Details & AI Summary]
    
    Details --> Action{Action}
    Action -- Decline --> Listen
    Action -- Bid --> SubmitBid[Submit Bid/Quote]
    Action -- Accept --> AcceptJob[Accept Fixed Price]
    
    SubmitBid --> Wait[Wait for User Approval]
    AcceptJob --> JobActive([Job Active])
```

## 5. Navigation Structure (Sitemap)
Visual representation of the application's routing.

```mermaid
graph TD
    Root[/] --> Landing[Landing Page]
    Root --> Auth[Authentication]
    
    Auth --> Login
    Auth --> Register
    
    Root --> Dashboard[User Dashboard]
    Dashboard --> MyReq[My Requests]
    Dashboard --> Settings
    Dashboard --> Tracking[Live Tracking]
    
    Root --> ProvDash[Provider Dashboard]
    ProvDash --> Jobs[Job Queue]
    ProvDash --> Earnings
    ProvDash --> Profile
    
    Root --> Admin[Admin Panel]
    Admin --> Users
    Admin --> Categories
    Admin --> Analytics
    Admin --> AuditLogs
```
