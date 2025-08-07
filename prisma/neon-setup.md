# Configuração do Neon PostgreSQL

## Informações da Conexão

- **Host**: ep-white-fog-a5xxg7uy.us-east-2.aws.neon.tech
- **Database**: neondb
- **User**: neondb_owner
- **Region**: US East 2 (Ohio)

## Configuração Realizada

1. **Variáveis de Ambiente**
   - `.env` configurado com as credenciais do Neon
   - `DATABASE_URL` e `DIRECT_URL` apontando para o Neon

2. **Prisma Schema**
   - Configurado com provider PostgreSQL
   - Suporte para pooled e direct connections do Neon

3. **Docker Compose**
   - PostgreSQL local comentado (usando Neon cloud)

## Comandos Úteis

```bash
# Setup inicial do banco
./scripts/setup-database.sh

# Gerar Prisma Client
cd api && npx prisma generate

# Criar primeira migração
cd api && npx prisma migrate dev --name init

# Visualizar banco de dados
cd api && npx prisma studio

# Deploy de migrações em produção
cd api && npx prisma migrate deploy
```

## Vantagens do Neon

- ✅ Serverless PostgreSQL
- ✅ Auto-scaling
- ✅ Branching para desenvolvimento
- ✅ Free tier generoso (0.5 GB storage)
- ✅ Connection pooling built-in
- ✅ Backups automáticos

## Monitoramento

Acesse o dashboard do Neon em: https://console.neon.tech/