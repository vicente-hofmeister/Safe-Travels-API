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
git checkout basic_auth
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
| `map-data-feed` | Branch ativa de desenvolvimento — feed de localização para o mapa |

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
  modules/
    auth/             # Register e login (implementado)
    user/             # Stub (apenas health check)
    trip/             # Stub (apenas health check)
    group/            # Stub (apenas health check)
    location/         # Registro e consulta de eventos de localização (implementado)
    health/           # Health check global
database/
  init/
    create_schema.sql # Schema SQL inicial (users + location_events)
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

## Banco de dados

PostgreSQL 17. Tabelas principais:

- **`users`** — `user_id` (UUID), `username`, `name`, `email`, `password_hash`, timestamps, `deleted_at`
- **`location_events`** — `location_event_id` (bigserial), `user_id`, `latitude`, `longitude`, `accuracy_meters`, `captured_at`

O schema é inicializado automaticamente pelo serviço `db-init` no Docker Compose (`database/init/create_schema.sql`).

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

### Auth (`/auth`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/auth/health` | Health check do módulo |
| POST | `/auth/register` | Cadastro de usuário (retorna JWT) |
| POST | `/auth/login` | Login por email ou username (retorna JWT) |

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
| Método | Rota | Descrição |
|---|---|---|
| GET | `/location/health` | Health check |
| POST | `/location/register` | Registra evento de localização |
| GET | `/location/latest` | Localização mais recente de cada usuário (inclui `user.username` e `user.name`) |
| GET | `/location/latest?userIds=id1,id2` | Filtra por lista de usuários |
| GET | `/location/id/:locationEventId` | Busca por ID do evento (inclui `user.username` e `user.name`) |
| GET | `/location/user/:userId` | Localização mais recente de um usuário (inclui `user.username` e `user.name`) |

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

### Outros módulos (stubs)
`/health`, `/user/health`, `/trip/health`, `/group/health` — apenas health checks por enquanto.

---

## Padrões de código

- **ESM puro** — imports com extensão `.js` mesmo em arquivos `.ts`
- **Injeção de dependência nos services** — funções de service aceitam `dependencies` opcionais para facilitar testes
- **Erros de domínio tipados** — use `AuthError` (e padrão similar em outros módulos) para erros de negócio com `statusCode`
- **Zod para validação de input** — sempre valide na camada de service
- **Sem ORM** — queries SQL diretas via `query()` do `src/config/database.ts`

---

## Observações importantes

- `apiHandler.ts` é **legado AWS** — não adicionar rotas novas nele
- `template.yaml` e `samconfig.toml` são **legados AWS** — ignorar
- O `db-init` container roda o SQL de schema uma vez e encerra (`restart: "no"`)
- A API depende do banco estar saudável (`depends_on: database: condition: service_healthy`)
