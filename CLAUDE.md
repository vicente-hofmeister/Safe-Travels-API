# CLAUDE.md — Safe Travels API

## Contexto do projeto

TCC de Sistemas de Informação (PUCRS) — Vicente Hofmeister.

Sistema colaborativo para compartilhamento de localização em tempo real durante viagens em grupo, com foco em conectividade limitada, segurança e privacidade.

> **Atenção:** O plano original previa deploy na AWS (SAM/Lambda). Essa abordagem foi **descontinuada**. A API roda agora como **Node.js puro em Docker**. Os arquivos `template.yaml`, `samconfig.toml` e `apiHandler.ts` são legados da arquitetura anterior e não devem ser evoluídos.

Repositórios relacionados:
- [Safe-Travels-Mobile](https://github.com/vicente-hofmeister/Safe-Travels-Mobile)
- [Safe-Travels-Wiki](https://github.com/vicente-hofmeister/Safe-Travels-Wiki)

---

## Stack e versões

### Ferramentas do sistema (instalar manualmente)

| Ferramenta | Versão esperada | Observação |
|---|---|---|
| Node.js | **25.x** | Mesma versão usada na imagem Docker (`node:25-alpine`) |
| npm | **10.x** (vem com Node 25) | Gerenciador de pacotes |
| Docker | **27.x ou superior** | Para rodar API + banco localmente |
| Docker Compose | **v2** (plugin, não standalone) | Embutido no Docker Desktop |
| Git | qualquer recente | — |

### Dependências de produção

| Pacote | Versão |
|---|---|
| fastify | ^5.8.5 |
| @fastify/cors | ^11.2.0 |
| pg | ^8.16.3 |
| bcrypt | ^6.0.0 |
| jsonwebtoken | ^9.0.3 |
| zod | ^4.3.6 |
| dotenv | ^17.2.3 |

### Dependências de desenvolvimento

| Pacote | Versão |
|---|---|
| typescript | ^5.9.3 |
| tsx | ^4.21.0 |
| vitest | ^4.0.18 |
| eslint | ^9.39.2 |
| prettier | ^3.8.1 |
| @types/node | ^25.2.2 |
| @types/pg | ^8.20.0 |
| @types/bcrypt | ^6.0.0 |
| @types/jsonwebtoken | ^9.0.10 |

### Infraestrutura (Docker Compose)

| Serviço | Imagem | Versão |
|---|---|---|
| API | `node:25-alpine` (build local, stage `runtime`) | — |
| Seed | `node:25-alpine` (build local, stage `deps`) | — |
| Banco de dados | `postgres` | **17-alpine** |
| Adminer (UI do banco) | `adminer` | **4** |

---

## Setup do ambiente (do zero)

### 1. Pré-requisitos

**Node.js 25**
```bash
# Via nvm (recomendado)
nvm install 25
nvm use 25
node -v  # deve exibir v25.x.x

# Ou baixar direto em: https://nodejs.org
```

**Docker Desktop**
- Windows/Mac: https://www.docker.com/products/docker-desktop
- Linux: instalar Docker Engine + plugin Compose
```bash
docker -v          # Docker version 27.x.x
docker compose version  # Docker Compose version v2.x.x
```

### 2. Clonar e instalar dependências

```bash
git clone https://github.com/vicente-hofmeister/Safe-Travels-API.git
cd Safe-Travels-API
git checkout map-data-feed
npm install
```

### 3. Configurar variáveis de ambiente

Crie o arquivo `.env` na raiz do projeto:

```env
# API
SAFE_TRAVELS_NODE_ENV=development
SAFE_TRAVELS_API_HOST=0.0.0.0
SAFE_TRAVELS_API_PORT=3000

# Banco de dados
SAFE_TRAVELS_DB_HOST=database
SAFE_TRAVELS_DB_PORT=5432
SAFE_TRAVELS_DB_NAME=safe_travels
SAFE_TRAVELS_DB_USER=safe_travels_user
SAFE_TRAVELS_DB_PASSWORD=safe_travels_pass

# Auth
SAFE_TRAVELS_AUTH_JWT_SECRET=troque-este-valor-em-producao
SAFE_TRAVELS_AUTH_JWT_EXPIRES_IN=1h
SAFE_TRAVELS_AUTH_BCRYPT_SALT_ROUNDS=10

# Adminer (UI do banco)
SAFE_TRAVELS_ADMINER_DEFAULT_SERVER=database
SAFE_TRAVELS_ADMINER_PORT=8080
```

> `SAFE_TRAVELS_DB_HOST=database` é o nome do serviço no Docker Compose. Para rodar a API fora do Docker, use `localhost`.

### 4. Build da imagem Docker

```bash
npm run docker:build
# ou equivalente:
docker build -t safe-travels-api:dev .
```

### 5. Subir todos os serviços

```bash
npm run docker:up
```

Isso sobe: banco de dados → inicialização do schema (`db-init`) → API → Adminer.

Verificar se tudo está rodando:
```bash
docker compose ps
curl http://localhost:3000/health
```

### 6. Resetar ambiente (se necessário)

Derruba tudo, remove volumes e reconstrói do zero:
```bash
npm run docker:reset
```

---

## Branches

| Branch | Propósito |
|---|---|
| `main` | Último código estável |
| `map-data-feed` | Mergeada — feed de localização para o mapa (módulos location + group) |
| `groups` | Branch ativa — lógica de grupos |

> Sempre desenvolva a partir da branch ativa. Não altere `main` diretamente.

---

## Estrutura do projeto

```
src/
  server.ts           # Entry point — cria e inicia o servidor Fastify
  apiHandler.ts       # LEGADO AWS Lambda — não evoluir
  config/
    database.ts       # Pool de conexão PostgreSQL
    environment.ts    # Leitura de variáveis de ambiente e authConfig
  middleware/
    jwt.ts            # verifyJwt — preHandler Fastify para rotas protegidas
  types/
    fastify.d.ts      # Augmentação do FastifyRequest com request.user
  modules/
    auth/             # Register e login (implementado)
    user/             # Stub (apenas health check)
    trip/             # Stub (apenas health check)
    group/            # CRUD de grupos e membros (implementado)
    location/         # Registro e consulta de eventos de localização (implementado)
    health/           # Health check global
database/
  init/
    create_schema.sql # Schema SQL (users, location_events, groups, group_members)
scripts/
  seed.ts             # Injeta usuários e location events de teste (rodar via docker:seed)
```

### Stages do Dockerfile

| Stage | Propósito |
|---|---|
| `deps` | `npm ci` completo (inclui devDependencies) — usado pelo serviço `seed` |
| `build` | Compila TypeScript e poda devDependencies (`npm prune --omit=dev`) |
| `runtime` | Imagem final de produção — apenas `dist/` e dependências de produção |

Cada módulo segue o padrão: `routes → controller → service`.

---

## Autenticação JWT

O middleware `src/middleware/jwt.ts` exporta `verifyJwt`, um preHandler Fastify que:
1. Lê o header `Authorization: Bearer <token>`
2. Verifica a assinatura com `jsonwebtoken` usando `authConfig.jwtSecret`
3. Popula `request.user` com `{ userId, username, email }` extraídos do token
4. Retorna 401 se o token estiver ausente, inválido ou expirado

O JWT é emitido pelo módulo `auth` no login/register. O payload contém `sub` (user_id), `username` e `email`.

Todas as rotas protegidas recebem `{ preHandler: [verifyJwt] }`. Rotas de health check são públicas.

---

## Banco de dados

PostgreSQL 17. Tabelas:

- **`users`** — `user_id` (UUID), `username`, `name`, `email`, `password_hash`, timestamps, `deleted_at`
- **`location_events`** — `location_event_id` (bigserial), `user_id`, `latitude`, `longitude`, `accuracy_meters`, `captured_at` — sempre ancorado no usuário
- **`location_event_groups`** — `(location_event_id, group_id)` — vincula eventos de localização a grupos
- **`location_event_trips`** — `(location_event_id, trip_id)` — stub; FK para `trips` pendente
- **`groups`** — `group_id` (UUID), `name`, `description`, `owner_id`, timestamps, `deleted_at` (soft delete)
- **`group_members`** — PK composta `(group_id, user_id)`, `joined_at`

> `location_events` é sempre criado pelo usuário. Ao registrar localização, o service automaticamente vincula o evento a todos os grupos do usuário via `location_event_groups`. A API nunca expõe `user_id` nas consultas de localização por grupo.

O schema é inicializado automaticamente pelo serviço `db-init` no Docker Compose (`database/init/create_schema.sql`).

> Ao adicionar novas tabelas ao schema, rodar `npm run docker:reset` para recriar o banco.

---

## Comandos essenciais

```bash
# Desenvolvimento local (sem Docker — requer banco rodando separadamente)
npm run dev

# Build TypeScript
npm run build

# Testes
npm run test
npm run test:watch

# Lint / Format
npm run lint
npm run lint:fix
npm run format

# Docker — ciclo completo
npm run docker:up        # Sobe todos os serviços (API + DB + Adminer)
npm run docker:down      # Derruba tudo
npm run docker:reset     # Derruba, reconstrói e sobe do zero (limpa volumes)
npm run docker:logs      # Logs de todos os serviços

# Docker — serviços individuais
npm run docker:api:up    # Sobe apenas a API
npm run docker:db:up     # Sobe apenas o banco
npm run docker:db:logs   # Logs do banco

# Banco de dados — seed
npm run docker:seed      # Injeta usuários e location events de teste
```

O Adminer fica disponível em `http://localhost:<SAFE_TRAVELS_ADMINER_PORT>` para inspeção visual do banco.

---

## Endpoints implementados

> Rotas marcadas com 🔒 exigem `Authorization: Bearer <token>` no header.

### Auth (`/auth`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/auth/health` | Health check do módulo |
| POST | `/auth/register` | Cadastro de usuário (retorna JWT) |
| POST | `/auth/login` | Login por email (retorna JWT) |

**Register body:**
```json
{ "name": "string", "username": "string", "email": "string", "password": "string" }
```

**Login body:**
```json
{ "email": "string", "password": "string" }
```

**Resposta de autenticação:**
```json
{ "accessToken": "...", "tokenType": "Bearer", "expiresIn": "1h", "user": { ... } }
```

### Location (`/location`)
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/location/health` | — | Health check |
| POST | `/location/register` | 🔒 | Registra localização do usuário autenticado |
| GET | `/location/latest` | 🔒 | Localização mais recente de cada usuário |
| GET | `/location/latest?userIds=id1,id2` | 🔒 | Filtra por lista de usuários |
| GET | `/location/id/:locationEventId` | 🔒 | Busca por ID do evento |
| GET | `/location/user/:userId` | 🔒 | Localização mais recente de um usuário |

> `POST /location/register` — o `userId` é extraído do JWT. Body: `{ latitude, longitude, accuracyMeters?, capturedAt? }`

**Resposta de localização (consultas):**
```json
{
  "locationEventId": 3,
  "user": { "userId": "...", "username": "alice", "name": "Alice Silva" },
  "latitude": -30.0574,
  "longitude": -51.1778,
  "accuracyMeters": 4,
  "capturedAt": "2026-04-19T08:10:00.000Z",
  "createdAt": "..."
}
```

### Group (`/group`)
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/group/health` | — | Health check |
| POST | `/group` | 🔒 | Cria grupo; criador vira owner e membro automaticamente |
| GET | `/group/:groupId` | 🔒 | Retorna dados do grupo e lista de membros |
| POST | `/group/:groupId/members` | 🔒 | Adiciona membro (apenas owner) |
| DELETE | `/group/:groupId/members/:userId` | 🔒 | Remove membro (owner remove qualquer um; membro remove a si mesmo) |
| GET | `/group/user/:userId` | 🔒 | Grupos que um usuário pertence |
| DELETE | `/group/:groupId` | 🔒 | Soft delete do grupo (apenas owner) |
| GET | `/group/:groupId/location` | 🔒 | Localização mais recente dos membros do grupo (anonimizada — sem identificar usuário) |

**Criar grupo body:**
```json
{ "name": "Viagem PUCRS 2026", "description": "opcional" }
```

**Adicionar membro body:**
```json
{ "userId": "uuid-do-usuario" }
```

### Outros módulos (stubs)
`/health`, `/user/health`, `/trip/health` — apenas health checks por enquanto.

---

## Padrões de código

- **ESM puro** — imports com extensão `.js` mesmo em arquivos `.ts`
- **Injeção de dependência nos services** — funções de service aceitam `dependencies` opcionais para facilitar testes (padrão do módulo `auth`)
- **Erros de domínio tipados** — use `AuthError` / `GroupError` (padrão: classe com `statusCode` e `message`) para erros de negócio
- **Zod para validação de input** — sempre valide na camada de service
- **Sem ORM** — queries SQL diretas via `query()` do `src/config/database.ts`
- **Transações** — usar `withDatabaseTransaction()` quando múltiplas queries precisam ser atômicas

---

## Seed de desenvolvimento

O seed (`scripts/seed.ts`) insere usuários e eventos de localização de teste. Usuários disponíveis:

| username | email | senha |
|---|---|---|
| root | root@root.com | rootroot |
| alice | alice@safetravels.dev | senha123 |
| bob | bob@safetravels.dev | senha123 |
| carol | carol@safetravels.dev | senha123 |
| dave | dave@safetravels.dev | senha123 |

---

## Observações importantes

- `apiHandler.ts` é **legado AWS** — não adicionar rotas novas nele
- `template.yaml` e `samconfig.toml` são **legados AWS** — ignorar
- O `db-init` container roda o SQL de schema uma vez e encerra (`restart: "no"`)
- A API depende do banco estar saudável (`depends_on: database: condition: service_healthy`)
- O owner de um grupo não pode remover a si mesmo via `DELETE /group/:groupId/members/:userId` — deve deletar o grupo

---

## Mapa de implementação vs documentação (wiki)

> Fonte de referência: `../safe-travels-wiki/docs/api/swagger.yml` e `docs/database/sql_database_model.dbml`.
> Última comparação: 2026-04-26.

### Status por módulo

| Módulo | Swagger planeja | Implementado | Status |
|---|---|---|---|
| **Auth** | 10 endpoints | 2 (register, login) | Parcial |
| **User** | 9 endpoints | 0 (só health) | Stub |
| **Group** | 12 endpoints | 6 endpoints | Parcial — modelo REST diferente |
| **Trip** | 6 endpoints | 0 (só health) | Stub |
| **Location** | 1 endpoint (fallback Kinesis) | 5 endpoints | Expandido (nova arquitetura) |
| **Health** | Não listado | 1 endpoint | Extra |

---

### Auth — detalhes

| Endpoint (swagger) | Implementado | Observação |
|---|---|---|
| `POST /auth/register` | ✅ | Compatível |
| `POST /auth/login` | ✅ | **Divergência**: swagger pede `username`; implementação usa `email` |
| `POST /auth/refresh` | ❌ | Não implementado — JWT stateless, sem refresh token |
| `POST /auth/logout` | ❌ | Não implementado — JWT stateless, sem revogação |
| `POST /auth/forgot-password` | ❌ | Não implementado |
| `POST /auth/reset-password` | ❌ | Não implementado |
| `POST /auth/change-password` | ❌ | Não implementado |
| `POST /auth/verify-email` | ❌ | Não implementado |
| `POST /auth/verify-phone` | ❌ | Não implementado |
| `POST /auth/register-device` | ❌ | Não implementado |

---

### User — detalhes

| Endpoint (swagger) | Implementado | Observação |
|---|---|---|
| `GET /user/get-profile/{user_id}` | ❌ | Módulo stub |
| `POST /user/set-privacy` | ❌ | Sistema de privacidade não iniciado |
| `GET /user/ask-to-follow/{user_id}` | ❌ | Sistema de follows não iniciado |
| `GET /user/accept-follower/{user_id}` | ❌ | — |
| `POST /user/change-follower-tier` | ❌ | — |
| `DELETE /user/remove-follower/{user_id}` | ❌ | — |
| `DELETE /user/stop_following/{user_id}` | ❌ | — |
| `GET /user/get-location/{user_id}` | ❌ | Coberto por `GET /location/user/:userId` |
| `POST /user/send-location` | ❌ | Coberto por `POST /location/register` |

---

### Group — detalhes

| Endpoint (swagger) | Equivalente implementado | Observação |
|---|---|---|
| `POST /group/create` | `POST /group` | Renomeado para padrão REST |
| `POST /group/invite` | `POST /group/:groupId/members` | **Divergência**: swagger tem fluxo de convite (invite → respond); implementação é adição direta pelo owner |
| `POST /group/respond-invite` | ❌ | Sem sistema de convites |
| `DELETE /group/remove-member/{group_id}/{user_id}` | `DELETE /group/:groupId/members/:userId` | Compatível (caminhos diferentes) |
| `DELETE /group/leave/{group_id}` | `DELETE /group/:groupId/members/:userId` (self) | Unificado no mesmo endpoint; owner bloqueado |
| `POST /group/set-group-privacy` | ❌ | Sistema de privacidade não iniciado |
| `POST /group/set-user-privacy` | ❌ | — |
| `GET /group/ask-to-follow/{group_id}` | ❌ | Sistema de follows não iniciado |
| `GET /group/accept-follower/{user_id}` | ❌ | — |
| `DELETE /group/remove-follower/{group_id}/{user_id}` | ❌ | — |
| `DELETE /group/stop_following/{group_id}` | ❌ | — |
| `GET /group/get-location/{group_id}` | ❌ | Não implementado |
| *(não estava no swagger)* | `GET /group/:groupId` | Novo endpoint adicionado |
| *(não estava no swagger)* | `GET /group/user/:userId` | Novo endpoint adicionado |
| *(não estava no swagger)* | `DELETE /group/:groupId` | Novo endpoint adicionado |

---

### Trip — detalhes

| Endpoint (swagger) | Implementado | Observação |
|---|---|---|
| `GET /trip/get-trip-sumary/{trip_id}` | ❌ | Módulo stub |
| `GET /trip/get-trip-details/{trip_id}` | ❌ | — |
| `GET /trip/list-trips/user/{user_id}` | ❌ | — |
| `GET /trip/list-trips/group/{group_id}` | ❌ | — |
| `GET /trip/get-user-current-trip/{user_id}` | ❌ | — |
| `GET /trip/get-group-current-trip/{group_id}` | ❌ | — |

---

### Location — detalhes

| Endpoint (swagger) | Equivalente implementado | Observação |
|---|---|---|
| `POST /location/send-location` (fallback Kinesis) | `POST /location/register` | **Adaptação**: Kinesis removido; toda localização vai direto ao banco |
| *(não estava no swagger)* | `GET /location/latest` | Novo — feed de localização para o mapa |
| *(não estava no swagger)* | `GET /location/latest?userIds=...` | Filtro por membros do grupo |
| *(não estava no swagger)* | `GET /location/id/:locationEventId` | Novo |
| *(não estava no swagger)* | `GET /location/user/:userId` | Novo |

---

### Banco de dados — DBML vs schema atual

| Tabela (DBML) | Status | Diferenças |
|---|---|---|
| `users` | ✅ Implementada | Faltam: `phone`, `profile_image`, `location_data`, `privacy_settings`. Adicionado: `password_hash`. `email` é scalar (DBML usava array). |
| `follows` | ❌ Não existe | Tabela de follows/tiers não criada |
| `groups` | ✅ Implementada | Faltam: `profile_image`, `location_data`. Adicionado: `description` |
| `group_members` | ✅ Implementada | Idêntica ao DBML |
| `trips` | ❌ Não existe | Tabela não criada |
| `user_trips` | ❌ Não existe | — |
| `group_trips` | ❌ Não existe | — |
| `location_events` | ✅ Implementada | **Nova** — não estava no DBML (substituiu o campo `location_data` inline dos outros modelos) |

---

## Pendências (não implementadas)

### Alta prioridade (core do TCC)
- [ ] **Módulo `trip`** — tabelas + CRUD + associação com usuários e grupos
- [ ] **Módulo `user`** — perfil do usuário (`GET /user/get-profile/:userId`)
- [x] **`GET /group/:groupId/location`** — localização dos membros de um grupo (anonimizada)

### Média prioridade
- [ ] **Sistema de follows** — tabela `follows`, tiers, endpoints de follow/unfollow para usuários e grupos
- [ ] **Sistema de privacidade** — campos `privacy_settings` em `users`, configurações por grupo e por membro

### Baixa prioridade / a discutir
- [ ] `POST /auth/refresh` — refresh token (requer armazenar estado)
- [ ] `POST /auth/logout` — logout com revogação de token (requer armazenar estado)
- [ ] `POST /auth/forgot-password` / `reset-password` — requer serviço de e-mail externo
- [ ] `POST /auth/change-password`
- [ ] `POST /auth/verify-email` / `verify-phone` — requer serviço de notificação externo
- [ ] Campos de perfil: `phone`, `profile_image` (usuários e grupos)

---

## Divergências documentadas

### D1 — Arquitetura: AWS → Docker (proposital, documentada)
Original: API Gateway + Lambda (SAM) + Kinesis Data Streams para processamento assíncrono de localização.
Atual: Node.js puro em Docker Compose, processamento síncrono direto ao PostgreSQL.
Arquivos legados: `apiHandler.ts`, `template.yaml`, `samconfig.toml`.

### D2 — Convenção de URLs: verbo → REST
Swagger usava estilo `/resource/verb` (e.g., `/group/create`, `/group/leave/{id}`).
Implementação usa REST canônico (`POST /group`, `DELETE /group/:id/members/:userId`).

### D3 — Login: campo de identificação ✅ Resolvido
Swagger especifica login por `username`. Implementação usa `email` — **decisão definitiva**.
O swagger está desatualizado nesse ponto; ao atualizar a spec, usar `email`.

### D4 — Adição de membros ao grupo: convite vs direto
Swagger prevê fluxo de convite com dois passos (`/group/invite` → `/group/respond-invite`).
Implementação tem adição direta pelo owner (`POST /group/:groupId/members`), sem etapa de aceite.
**Decisão**: adição direta é o comportamento do MVP. Fluxo de convite fica para v2.

### D5 — Sistema de follows e privacidade
Tabela `follows` com `tier` (regular, close, etc.) controlaria granularidade de localização.
**Status**: não cortado formalmente, mas indefinido se entra no MVP.
Não implementar sem decisão explícita — impacta banco (tabela `follows`) e múltiplos módulos.

### D6 — Swagger desatualizado; endpoints extras na implementação ✅ Resolvido
Implementação adicionou endpoints que não estavam no swagger original:
- `GET /group/:groupId`, `GET /group/user/:userId`, `DELETE /group/:groupId`
- `GET /location/latest`, `GET /location/id/:locationEventId`, `GET /location/user/:userId`

**Decisão**: o swagger será atualizado para refletir a implementação real — idealmente gerado automaticamente a partir do código (Zod schemas / Fastify schemas).

### D7 — Modelo de localização: campo inline → tabela dedicada
DBML tinha um campo `location_data` nas tabelas `users`, `groups` e `trips`.
Implementação usa uma tabela separada `location_events` com histórico completo de posições.
Essa é uma consequência da remoção do Kinesis (D1) e é a abordagem correta para a arquitetura atual.
