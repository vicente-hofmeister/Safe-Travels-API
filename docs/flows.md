# Fluxos principais — Safe Travels API

> Visualizar no VS Code: extensão **Markdown Preview Mermaid Support** ou **Markdown Preview Enhanced**
> Visualizar online: https://mermaid.live

---

## Autenticação — Register

```mermaid
sequenceDiagram
    actor Mobile
    participant API
    participant DB

    Mobile->>API: POST /auth/register\n{name, username, email, password}
    API->>API: Zod validation
    API->>DB: SELECT WHERE email = ? OR username = ?
    DB-->>API: rows

    alt usuário já existe
        API-->>Mobile: 409 Conflict
    else
        API->>API: bcrypt.hash(password)
        API->>DB: INSERT INTO users
        DB-->>API: user row
        API->>API: jwt.sign({sub, username, email})
        API-->>Mobile: 201 {accessToken, tokenType, expiresIn, user}
    end
```

---

## Autenticação — Login

```mermaid
sequenceDiagram
    actor Mobile
    participant API
    participant DB

    Mobile->>API: POST /auth/login\n{email, password}
    API->>API: Zod validation
    API->>DB: SELECT WHERE email = ?
    DB-->>API: user row

    alt usuário não encontrado
        API-->>Mobile: 401 Unauthorized
    else
        API->>API: bcrypt.compare(password, hash)
        alt senha incorreta
            API-->>Mobile: 401 Unauthorized
        else
            API->>API: jwt.sign({sub, username, email})
            API-->>Mobile: 200 {accessToken, tokenType, expiresIn, user}
        end
    end
```

---

## Registro de localização (com vinculação automática a grupos)

```mermaid
sequenceDiagram
    actor Mobile
    participant API
    participant JWT as verifyJwt
    participant DB

    Mobile->>API: POST /location/register\nAuthorization: Bearer <token>\n{latitude, longitude, accuracyMeters?, capturedAt?}

    API->>JWT: verifyJwt
    JWT->>JWT: jwt.verify(token)
    alt token inválido
        JWT-->>Mobile: 401 Unauthorized
    else
        JWT-->>API: request.user = {userId, username, email}
    end

    API->>API: validateRegisterLocationInput

    note over API,DB: withDatabaseTransaction
    API->>DB: INSERT INTO location_events\n(user_id, lat, lon, ...)
    DB-->>API: location_event_id

    API->>DB: SELECT group_id FROM group_members\nWHERE user_id = ?
    DB-->>API: [group_ids]

    alt usuário pertence a grupos
        API->>DB: INSERT INTO location_event_groups\nSELECT event_id, unnest(group_ids)
    end

    API-->>Mobile: 201 {locationEventId, userId, latitude, longitude, ...}
```

---

## Consulta de localização do grupo

```mermaid
sequenceDiagram
    actor Mobile
    participant API
    participant JWT as verifyJwt
    participant DB

    Mobile->>API: GET /group/:groupId/location\nAuthorization: Bearer <token>

    API->>JWT: verifyJwt
    JWT-->>API: request.user

    API->>DB: SELECT group_id FROM groups\nWHERE group_id = ? AND deleted_at IS NULL
    DB-->>API: group row

    alt grupo não encontrado
        API-->>Mobile: 404 Not Found
    else
        API->>DB: SELECT DISTINCT ON (le.user_id)\n  le.latitude, le.longitude, ...\nFROM location_events le\nJOIN location_event_groups leg ON ...\nWHERE leg.group_id = ?\nORDER BY le.user_id, le.captured_at DESC
        DB-->>API: location rows (sem user_id)
        API-->>Mobile: 200 {data: [{latitude, longitude, accuracyMeters, capturedAt}, ...]}
    end
```

---

## Criação de grupo

```mermaid
sequenceDiagram
    actor Mobile
    participant API
    participant JWT as verifyJwt
    participant DB

    Mobile->>API: POST /group\nAuthorization: Bearer <token>\n{name, description?}

    API->>JWT: verifyJwt
    JWT-->>API: request.user = {userId}

    API->>API: Zod validation

    note over API,DB: withDatabaseTransaction
    API->>DB: INSERT INTO groups\n(name, description, owner_id)
    DB-->>API: group row

    API->>DB: INSERT INTO group_members\n(group_id, user_id)  ← owner vira membro

    API->>DB: SELECT username, name FROM users\nWHERE user_id = ?
    DB-->>API: owner info

    API-->>Mobile: 201 {groupId, name, description, owner, ...}
```
