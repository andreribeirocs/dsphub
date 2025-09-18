# 🐳 Docker Database Setup for DSP Hub API

This guide will help you set up the PostgreSQL database using Docker for your DSP Hub API.

## Prerequisites

- Docker Desktop installed and running
- Node.js and npm installed
- Your `.env` file configured with: `DATABASE_URL="postgresql://postgres:123456@localhost:5432/dsphub"`

## Quick Setup

### Option 1: Automated Setup (Recommended)

1. **Start Docker Desktop** and wait for it to be ready
2. **Run the setup script**:

   ```bash
   ./setup-database.sh
   ```

### Option 2: Manual Setup

1. **Start Docker containers**:

   ```bash
   docker-compose up -d postgres redis
   ```

2. **Wait for PostgreSQL to be ready** (about 30 seconds):

   ```bash
   docker-compose logs -f postgres
   ```

   Wait until you see "database system is ready to accept connections"

3. **Install dependencies** (if not already done):

   ```bash
   npm install
   ```

4. **Generate Prisma client**:

   ```bash
   npx prisma generate
   ```

5. **Run migrations**:

   ```bash
   npx prisma migrate deploy
   ```

6. **Seed the database** (optional):

   ```bash
   npx prisma db seed
   ```

## Verify Setup

1. **Check containers are running**:

   ```bash
   docker-compose ps
   ```

2. **Test database connection**:

   ```bash
   npx prisma studio
   ```

   This opens a web interface at <http://localhost:5555>

3. **Start your API**:

   ```bash
   npm run start:dev
   ```

## Container Information

- **PostgreSQL**: `localhost:5432`
  - Database: `dsphub`
  - Username: `postgres`
  - Password: `123456`

- **Redis**: `localhost:6379` (for sessions/caching)

## Useful Commands

```bash
# View container logs
docker-compose logs -f postgres

# Stop all containers
docker-compose down

# Reset database (removes all data)
docker-compose down -v

# Connect to PostgreSQL directly
docker exec -it dsphub_postgres psql -U postgres -d dsphub

# Start Prisma Studio in Docker
docker-compose --profile tools up prisma-studio
```

## Troubleshooting

### Container won't start

```bash
# Check Docker is running
docker info

# Check for port conflicts
lsof -i :5432
```

### Database connection issues

1. Verify your `.env` file has the correct DATABASE_URL
2. Make sure PostgreSQL container is healthy:
   ```bash
   docker-compose ps
   ```

### Migration errors

```bash
# Reset migrations (careful - this deletes data)
npx prisma migrate reset

# Or force deploy
npx prisma migrate deploy --force
```

## Next Steps

After setup is complete:

1. ✅ Database is running in Docker
2. ✅ Migrations are applied
3. ✅ Data is seeded (if applicable)
4. 🚀 Start your API: `npm run start:dev`
5. 🌐 Access API at: <http://localhost:3000>
6. 🔍 View database: `npx prisma studio`

---

**Need help?** Run `./setup-database.sh` for automated setup or check the logs with `docker-compose logs -f`
