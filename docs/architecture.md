# Arquitetura — Safe Travels API

> Visualizar no VS Code: extensão **Markdown Preview Mermaid Support** ou **Markdown Preview Enhanced**
> Visualizar online: https://mermaid.live

---

## Infraestrutura (Docker Compose)

```mermaid
graph TB
    Mobile["📱 Safe Travels Mobile"]

    subgraph compose["Docker Compose"]
        direction TB
        API["API\nNode.js 25 / Fastify 5\n:3000"]
        DB[("PostgreSQL 17\n:5432")]
        Adminer["Adminer 4\n:8080"]
        DBInit["db-init\n(run once — aplica schema)"]
    end

    Mobile -->|"HTTP REST + JWT Bearer"| API
    API -->|"pg pool (max 10)"| DB
    Adminer -->|"SQL"| DB
    DBInit -->|"create_schema.sql"| DB

    DBInit -.->|"depends_on healthy"| DB
    API -.->|"depends_on healthy + db-init done"| DB
```

---

## Estrutura de módulos

```mermaid
graph LR
    subgraph server["src/server.ts (entry point)"]
        direction TB
        MW["middleware/jwt.ts\nverifyJwt"]

        subgraph modules["modules/"]
            Health["health\nGET /health"]
            Auth["auth\nPOST /auth/register\nPOST /auth/login"]
            User["user\n(stub)"]
            Trip["trip\n(stub)"]
            Group["group\nCRUD + membros\n+ localização"]
            Location["location\nregistro + consultas"]
        end

        subgraph config["config/"]
            Env["environment.ts\nauthConfig"]
            DB2["database.ts\nquery()\nwithDatabaseTransaction()"]
        end
    end

    MW --> Group
    MW --> Location
    MW --> User
    MW --> Trip
    Group -->|"getGroupLatestLocations"| Location
    Auth --> DB2
    Group --> DB2
    Location --> DB2
    Env --> MW
    Env --> Auth
```

---

## Modelo de dados (visão geral)

```mermaid
erDiagram
    users ||--o{ follows : "follower_id / following_id"
    users ||--o{ group_members : "user_id"
    users ||--o{ user_trips : "user_id"
    users ||--o{ location_events : "user_id"
    users ||--o{ groups : "owner_id"

    groups ||--o{ group_members : "group_id"
    groups ||--o{ group_trips : "group_id"
    groups ||--o{ location_event_groups : "group_id"

    trips ||--o{ user_trips : "trip_id"
    trips ||--o{ group_trips : "trip_id"
    trips ||--o{ location_event_trips : "trip_id"

    location_events ||--o{ location_event_groups : "location_event_id"
    location_events ||--o{ location_event_trips : "location_event_id"

    users {
        varchar user_id PK
        varchar username
        varchar name
        varchar email
        varchar phone
        varchar privacy_settings
    }

    groups {
        varchar group_id PK
        varchar owner_id FK
        varchar name
        varchar description
    }

    trips {
        varchar trip_id PK
        varchar title
        date start_date
        date end_date
    }

    location_events {
        bigserial location_event_id PK
        varchar user_id FK
        decimal latitude
        decimal longitude
        int accuracy_meters
        timestamptz captured_at
    }

    location_event_groups {
        bigint location_event_id FK
        varchar group_id FK
    }

    location_event_trips {
        bigint location_event_id FK
        varchar trip_id FK
    }
```
