# Database - Safe Travels

Este diretório contém os arquivos relacionados ao banco de dados PostgreSQL do projeto Safe Travels.

## Arquivos

- `sql_database_model.dbml` - Schema do banco de dados em formato DBML

## Configuração RDS PostgreSQL

O banco de dados está configurado no `template.yaml` com as seguintes características:

### Especificações (Free Tier)

- **Engine**: PostgreSQL 16.3
- **Instance Class**: db.t3.micro (elegível para free tier)
- **Storage**: 20GB gp2 (dentro do limite free tier)
- **Backup**: 7 dias de retenção
- **Multi-AZ**: Não (para economizar custos)

### Arquitetura

- O RDS está em subnets privadas (não acessível publicamente)
- Lambdas se conectam ao RDS através de VPC
- Security Groups controlam o acesso (apenas Lambdas podem acessar)
- NAT Gateway permite que Lambdas acessem a internet quando necessário

## Deploy

### Parâmetros Obrigatórios

Ao fazer o deploy, você precisará fornecer:

```bash
sam deploy --guided
```

Durante o processo, informe:

- **DBUsername**: Nome de usuário do PostgreSQL (padrão: postgres)
- **DBPassword**: Senha do banco (mínimo 8 caracteres, apenas letras e números)

### Primeira vez

```bash
sam build
sam deploy --guided --parameter-overrides DBUsername=postgres DBPassword=SuaSenhaSegura123
```

### Deploys subsequentes

```bash
sam build && sam deploy
```

## Conexão ao Banco

### Variáveis de Ambiente nas Lambdas

As funções Lambda automaticamente recebem estas variáveis de ambiente:

- `DB_HOST`: Endpoint do RDS
- `DB_PORT`: Porta (5432)
- `DB_NAME`: safetravels
- `DB_USER`: Usuário configurado
- `DB_PASSWORD`: Senha configurada

### Exemplo de Conexão (Node.js com pg)

```typescript
import { Pool } from "pg";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
});

export default pool;
```

## Custos Estimados (Free Tier)

**Dentro do Free Tier (12 meses):**

- 750 horas/mês de instância db.t3.micro
- 20GB de armazenamento SSD
- 20GB de backup

**ATENÇÃO**: O NAT Gateway **NÃO** está incluído no free tier e custa aproximadamente:

- $0.045/hora (~$32/mês) + custo por GB transferido

### Otimização de Custos

Para reduzir custos em desenvolvimento:

1. Considere pausar/deletar o stack quando não estiver usando
2. Use VPC Endpoints para evitar NAT Gateway (mais complexo)
3. Monitore o uso através do AWS Cost Explorer

## Migrations

TODO: Adicionar ferramenta de migrations (ex: Knex, TypeORM, Prisma)

## Seeds

TODO: Adicionar scripts para popular o banco com dados de teste
