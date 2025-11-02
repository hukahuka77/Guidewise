# Guidewise Architecture Documentation

## System Overview

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        Mobile[Mobile Browser]
    end

    subgraph "Frontend - Next.js 15"
        Pages[Pages & Routes]
        Components[React Components]
        Auth[Supabase Auth Client]
        Storage[Supabase Storage Client]
    end

    subgraph "Backend - Flask API"
        API[Flask REST API]
        PDF[WeasyPrint PDF Generator]
        Templates[Jinja2 Templates]
    end

    subgraph "External Services"
        Supabase[(Supabase)]
        SupaAuth[Supabase Auth]
        SupaStorage[Supabase Storage]
        Stripe[Stripe Payments]
        OpenAI[OpenAI GPT-4]
        GooglePlaces[Google Places API]
    end

    Browser --> Pages
    Mobile --> Pages
    Pages --> Components
    Components --> Auth
    Components --> Storage
    Components --> API

    API --> PDF
    API --> Templates
    API --> Supabase
    API --> Stripe
    API --> OpenAI
    API --> GooglePlaces

    Auth --> SupaAuth
    Storage --> SupaStorage
    SupaAuth --> Supabase
    SupaStorage --> Supabase

    style Supabase fill:#3ecf8e
    style Stripe fill:#635bff
    style OpenAI fill:#10a37f
    style GooglePlaces fill:#4285f4
```

## Data Flow Architecture

```mermaid
graph LR
    subgraph "User Actions"
        Create[Create Guidebook]
        Edit[Edit Guidebook]
        View[View Guidebook]
        Download[Download PDF]
        Subscribe[Subscribe to Pro]
    end

    subgraph "Frontend Processing"
        Form[Form Validation]
        Upload[Image Upload]
        API_Call[API Request]
    end

    subgraph "Backend Processing"
        Auth_Check[JWT Verification]
        Business_Logic[Business Logic]
        DB_Write[Database Write]
        Render[Template Render]
    end

    subgraph "Data Storage"
        PostgreSQL[(PostgreSQL)]
        Object_Storage[(Supabase Storage)]
    end

    Create --> Form
    Edit --> Form
    View --> API_Call
    Download --> API_Call
    Subscribe --> API_Call

    Form --> Upload
    Upload --> Object_Storage
    Upload --> API_Call

    API_Call --> Auth_Check
    Auth_Check --> Business_Logic
    Business_Logic --> DB_Write
    Business_Logic --> Render

    DB_Write --> PostgreSQL
    Render --> PostgreSQL
```

## Database Schema

```mermaid
erDiagram
    GUIDEBOOK ||--o{ RULE : contains
    GUIDEBOOK }o--|| PROPERTY : "belongs to"
    GUIDEBOOK }o--o| HOST : "has"
    GUIDEBOOK }o--o| WIFI : "includes"

    GUIDEBOOK {
        uuid id PK
        string user_id FK
        int property_id FK
        int host_id FK
        int wifi_id FK
        string template_key
        string check_in_time
        string check_out_time
        text access_info
        text welcome_info
        text parking_info
        text cover_image_url
        json safety_info
        json things_to_do
        json places_to_eat
        json checkout_info
        json house_manual
        json included_tabs
        json custom_sections
        json custom_tabs_meta
        boolean active
        datetime claimed_at
        datetime expires_at
        string claim_token
        string public_slug
        text published_html
        string published_etag
        datetime published_at
        datetime created_time
        datetime last_modified_time
    }

    PROPERTY {
        int id PK
        string user_id FK
        string name
        string address_street
        string address_city_state
        string address_zip
    }

    HOST {
        int id PK
        string user_id FK
        string name
        text bio
        text contact
        text host_image_url
    }

    WIFI {
        int id PK
        string user_id FK
        string network
        string password
    }

    RULE {
        int id PK
        string guidebook_id FK
        string text
    }

    PROFILES {
        string id PK
        string email
        string plan
        int extra_slots
        string stripe_customer_id
        string stripe_subscription_id
    }
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Supabase Auth
    participant Backend API
    participant Database

    User->>Frontend: Login/Signup
    Frontend->>Supabase Auth: Authenticate
    Supabase Auth->>Frontend: JWT Token
    Frontend->>Frontend: Store token

    User->>Frontend: Create Guidebook
    Frontend->>Backend API: POST /api/generate + Bearer Token
    Backend API->>Backend API: Verify JWT (HS256/RS256)
    Backend API->>Backend API: Extract user_id from JWT
    Backend API->>Database: Set auth.uid() for RLS
    Backend API->>Database: INSERT guidebook
    Database->>Database: Validate RLS (user_id matches)
    Database->>Backend API: Success
    Backend API->>Frontend: Guidebook created
    Frontend->>User: Show success
```

## Subscription & Billing Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Stripe
    participant Database

    User->>Frontend: Click "Upgrade to Pro"
    Frontend->>Backend: POST /api/billing/create-checkout-session
    Backend->>Stripe: Create checkout session
    Stripe->>Backend: Session URL
    Backend->>Frontend: Return URL
    Frontend->>User: Redirect to Stripe

    User->>Stripe: Complete payment
    Stripe->>Backend: Webhook: checkout.session.completed
    Backend->>Backend: Verify webhook signature
    Backend->>Database: UPDATE profiles SET plan='pro'
    Backend->>Backend: Apply activation policy
    Backend->>Database: UPDATE guidebooks SET active=true
    Database->>Backend: Success
    Backend->>Stripe: 200 OK

    User->>Frontend: Return to app
    Frontend->>Backend: GET /api/billing/summary
    Backend->>Database: Get user plan
    Backend->>Stripe: Get subscription details
    Backend->>Frontend: Plan status + invoices
    Frontend->>User: Show Pro status
```

## PDF Generation Flow

```mermaid
graph TD
    A[User clicks Download PDF] --> B[Select Template]
    B --> C{Include QR Code?}
    C -->|Yes| D[Enter QR URL]
    C -->|No| E[GET /api/guidebook/id/pdf]
    D --> E

    E --> F{Cache Hit?}
    F -->|Yes| G[Return Cached PDF]
    F -->|No| H[Fetch Guidebook from DB]

    H --> I[Normalize Data]
    I --> J[Render Jinja2 Template]
    J --> K{QR Code?}
    K -->|Yes| L[Fetch QR Image]
    K -->|No| M[WeasyPrint HTML to PDF]
    L --> M

    M --> N[Cache PDF with ETag]
    N --> O[Return PDF to Client]
    G --> O

    style G fill:#90EE90
    style O fill:#87CEEB
```

## AI Recommendation Flow

```mermaid
graph LR
    A[User enters location] --> B[Click AI Generate]
    B --> C{Food or Activities?}

    C -->|Food| D[POST /api/ai-food]
    C -->|Activities| E[POST /api/ai-activities]

    D --> F[OpenAI GPT-4]
    E --> G[OpenAI GPT-4o]

    F --> H[Generate 5 restaurants]
    G --> I[Generate 5 activities]

    H --> J[For each recommendation]
    I --> J

    J --> K[Google Places Text Search]
    K --> L{Found?}
    L -->|Yes| M[Get Place Details]
    L -->|No| N[Skip item]

    M --> O[Extract photo_reference]
    O --> P[Return enriched data]
    N --> P

    P --> Q[Frontend displays results]
    Q --> R[User clicks photo]
    R --> S[GET /api/place-photo]
    S --> T[Fetch from Google with API key]
    T --> U[Return image with CORS headers]

    style F fill:#10a37f
    style G fill:#10a37f
    style K fill:#4285f4
    style M fill:#4285f4
```

## Frontend Component Hierarchy

```mermaid
graph TD
    Root[App Root Layout] --> Nav[Navbar]
    Root --> Pages
    Root --> Footer[Footer]

    Pages --> Public[Public Pages]
    Pages --> Auth[Authenticated Pages]

    Public --> Home[Home]
    Public --> Login[Login]
    Public --> Signup[Signup]
    Public --> Pricing[Pricing]

    Auth --> Dashboard[Dashboard]
    Auth --> Create[Create Guidebook]
    Auth --> Edit[Edit Guidebook]

    Dashboard --> GuidebookCards[Guidebook Cards]
    Dashboard --> BillingPage[Billing Page]
    Dashboard --> ProfilePage[Profile Page]
    Dashboard --> PDFViewer[PDF Viewer]

    Create --> CreateLayout[Create Layout]
    CreateLayout --> SidebarNav[Sidebar Navigation]
    CreateLayout --> Sections[Form Sections]

    Sections --> WelcomeSection[Welcome Section]
    Sections --> CheckinSection[Checkin Section]
    Sections --> PropertySection[Property Section]
    Sections --> FoodSection[Food Section]
    Sections --> ActivitiesSection[Activities Section]
    Sections --> RulesSection[Rules Section]
    Sections --> CheckoutSection[Checkout Section]
    Sections --> CustomTabs[Custom Tabs]

    FoodSection --> DynamicItemList[Dynamic Item List]
    ActivitiesSection --> DynamicItemList

    DynamicItemList --> PlacePickerModal[Place Picker Modal]
    DynamicItemList --> AddItemModal[Add Item Modal]

    style Root fill:#e1f5ff
    style Create fill:#fff4e1
    style Dashboard fill:#e8f5e9
```

## API Endpoint Map

```mermaid
graph TB
    subgraph "Guidebook Management"
        POST_Generate[POST /api/generate]
        GET_List[GET /api/guidebooks]
        GET_Detail[GET /api/guidebooks/:id]
        PUT_Update[PUT /api/guidebooks/:id]
        POST_Publish[POST /api/guidebooks/:id/publish]
        GET_Activate[GET /api/guidebooks/activate_for_user]
    end

    subgraph "Rendering"
        GET_Direct[GET /guidebook/:id]
        GET_Slug[GET /g/:slug]
        GET_Preview[GET /preview/:id]
    end

    subgraph "Billing"
        POST_Checkout[POST /api/billing/create-checkout-session]
        POST_Addon[POST /api/billing/create-addon-session]
        GET_Summary[GET /api/billing/summary]
        POST_Refresh[POST /api/billing/refresh-plan]
        POST_Portal[POST /api/billing/create-portal-session]
        POST_Webhook[POST /webhooks/stripe]
    end

    subgraph "AI & Places"
        POST_Food[POST /api/ai-food]
        POST_Activities[POST /api/ai-activities]
        POST_Search[POST /api/places/search]
        GET_Enrich[GET /api/places/enrich]
        GET_Photo[GET /api/place-photo]
    end

    subgraph "PDF"
        GET_PDF[GET /api/guidebook/:id/pdf]
        POST_Template[POST /api/guidebook/:id/template]
    end

    style POST_Generate fill:#90EE90
    style GET_PDF fill:#FFB6C1
    style POST_Checkout fill:#DDA0DD
    style POST_Food fill:#F0E68C
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Client Devices"
        Desktop[Desktop Browser]
        Mobile[Mobile Browser]
    end

    subgraph "Frontend Hosting"
        CDN[CDN - Static Assets]
        NextJS[Next.js Server]
    end

    subgraph "Backend Hosting"
        LoadBalancer[Load Balancer]
        Flask1[Flask Instance 1]
        Flask2[Flask Instance 2]
        FlaskN[Flask Instance N]
    end

    subgraph "Data Layer"
        Supabase_DB[(Supabase PostgreSQL)]
        Supabase_Storage[(Supabase Storage)]
    end

    subgraph "External APIs"
        Stripe_API[Stripe API]
        OpenAI_API[OpenAI API]
        Google_API[Google Places API]
    end

    Desktop --> CDN
    Mobile --> CDN
    Desktop --> NextJS
    Mobile --> NextJS

    NextJS --> LoadBalancer
    LoadBalancer --> Flask1
    LoadBalancer --> Flask2
    LoadBalancer --> FlaskN

    Flask1 --> Supabase_DB
    Flask2 --> Supabase_DB
    FlaskN --> Supabase_DB

    Flask1 --> Supabase_Storage
    Flask2 --> Supabase_Storage
    FlaskN --> Supabase_Storage

    Flask1 --> Stripe_API
    Flask1 --> OpenAI_API
    Flask1 --> Google_API

    NextJS --> Supabase_DB
    NextJS --> Supabase_Storage

    style Supabase_DB fill:#3ecf8e
    style Stripe_API fill:#635bff
    style OpenAI_API fill:#10a37f
    style Google_API fill:#4285f4
```

## Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        A[User Request] --> B{Has JWT Token?}
        B -->|No| C[401 Unauthorized]
        B -->|Yes| D[Extract JWT]

        D --> E{Valid Signature?}
        E -->|No| C
        E -->|Yes| F[Decode Claims]

        F --> G[Extract user_id from sub]
        G --> H[Set Flask g.user_id]
        H --> I[Set PostgreSQL RLS context]

        I --> J[Execute Query]
        J --> K{RLS Check}
        K -->|Fail| L[403 Forbidden]
        K -->|Pass| M[Return Data]
    end

    subgraph "Row Level Security"
        RLS1[user_id = auth.uid]
        RLS2[Guidebook ownership]
        RLS3[Host ownership]
        RLS4[Property ownership]
    end

    I -.-> RLS1
    I -.-> RLS2
    I -.-> RLS3
    I -.-> RLS4

    style C fill:#ffcccc
    style L fill:#ffcccc
    style M fill:#ccffcc
```

## Caching Strategy

```mermaid
graph LR
    subgraph "Frontend Caching"
        A[Browser Cache] --> B[Static Assets]
        A --> C[API Responses]
        D[In-Memory Cache] --> E[Dashboard Data]
    end

    subgraph "Backend Caching"
        F[Published HTML] --> G[ETag Based]
        H[PDF Cache] --> I[1 Hour TTL]
        J[Photo Proxy] --> K[24 Hour TTL]
    end

    subgraph "Database Caching"
        L[Connection Pool] --> M[Pre-ping + Keepalives]
        N[Query Results] --> O[Supabase Managed]
    end

    style G fill:#90EE90
    style I fill:#FFB6C1
    style K fill:#87CEEB
```

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 15 + React 19 | SSR/SSG web framework |
| **Styling** | Tailwind CSS 4 | Utility-first CSS |
| **UI Components** | Radix UI | Accessible primitives |
| **Backend** | Flask 3.0 | REST API server |
| **Database** | PostgreSQL (Supabase) | Relational data storage |
| **ORM** | SQLAlchemy 3.0 | Database abstraction |
| **Authentication** | Supabase Auth | JWT-based auth |
| **Storage** | Supabase Storage | Object storage for images |
| **Payments** | Stripe | Subscription management |
| **PDF** | WeasyPrint 66 | HTML to PDF rendering |
| **AI** | OpenAI GPT-4/4o | Content recommendations |
| **Maps** | Google Places API | Location data enrichment |
| **Server** | Gunicorn | WSGI HTTP server |

---

## Key Architectural Decisions

1. **Supabase for Auth & Database**: Reduces infrastructure complexity, provides RLS
2. **Serverless-Ready Design**: Stateless backend, external storage
3. **JWT-Based Auth**: Scalable, no session storage needed
4. **JSON Columns**: Flexible schema for evolving features
5. **ETag Caching**: Performance optimization for public guidebooks
6. **CORS Proxy**: Solves third-party API CORS issues
7. **On-Demand PDF**: No storage overhead, always fresh
8. **Webhook-Driven Billing**: Eventual consistency, reliable state sync
9. **Row-Level Security**: Defense in depth for multi-tenancy
10. **Template System**: Reusable rendering for web and PDF

