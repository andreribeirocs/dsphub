#!/bin/bash

# Database Setup Script for DSP Hub API
# This script sets up the PostgreSQL database using Docker

set -e

echo "🚀 Setting up DSP Hub API Database with Docker..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed and running
check_docker() {
    print_status "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    print_success "Docker is installed and running"
}

# Check if Docker Compose is available
check_docker_compose() {
    print_status "Checking Docker Compose..."
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    print_success "Docker Compose is available"
}

# Check .env file
check_env() {
    print_status "Checking environment configuration..."
    if [ ! -f .env ]; then
        print_error ".env file not found!"
        print_status "Please create a .env file with your database configuration:"
        echo 'DATABASE_URL="postgresql://postgres:123456@localhost:5432/dsphub"'
        exit 1
    fi
    
    if grep -q "DATABASE_URL.*dsphub" .env; then
        print_success ".env file found with correct database configuration"
    else
        print_warning ".env file exists but may need database URL update"
        print_status "Expected: DATABASE_URL=\"postgresql://postgres:123456@localhost:5432/dsphub\""
    fi
}

# Start Docker containers
start_containers() {
    print_status "Starting Docker containers..."
    
    # Use docker-compose if available, otherwise use docker compose
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="docker compose"
    fi
    
    $COMPOSE_CMD up -d postgres redis
    
    print_status "Waiting for PostgreSQL to be ready..."
    
    # Wait for PostgreSQL to be ready
    max_attempts=30
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec dsphub_postgres pg_isready -U postgres -d dsphub &> /dev/null; then
            print_success "PostgreSQL is ready!"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_error "PostgreSQL failed to start after $max_attempts attempts"
            print_status "Checking container logs..."
            $COMPOSE_CMD logs postgres
            exit 1
        fi
        
        print_status "Attempt $attempt/$max_attempts - waiting for PostgreSQL..."
        sleep 2
        ((attempt++))
    done
}

# Install dependencies if needed
install_dependencies() {
    if [ ! -d "node_modules" ]; then
        print_status "Installing Node.js dependencies..."
        npm install
        print_success "Dependencies installed"
    else
        print_success "Dependencies already installed"
    fi
}

# Generate Prisma client
generate_client() {
    print_status "Generating Prisma client..."
    npx prisma generate
    print_success "Prisma client generated"
}

# Run Prisma migrations
run_migrations() {
    print_status "Running Prisma migrations..."
    npx prisma migrate deploy
    print_success "Migrations completed"
}

# Seed database
seed_database() {
    print_status "Seeding database..."
    if [ -f "prisma/seed.ts" ]; then
        npm run prisma:seed 2>/dev/null || npx prisma db seed
        print_success "Database seeded"
    else
        print_warning "No seed file found, skipping seeding"
    fi
}

# Show status
show_status() {
    print_status "Checking container status..."
    if command -v docker-compose &> /dev/null; then
        docker-compose ps
    else
        docker compose ps
    fi
}

# Main execution
main() {
    echo "🏗️  DSP Hub API Database Setup"
    echo "============================="
    echo ""
    
    check_docker
    check_docker_compose
    check_env
    start_containers
    install_dependencies
    generate_client
    run_migrations
    seed_database
    
    echo ""
    echo "🎉 Database setup completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Start the API: npm run start:dev"
    echo "   2. Access the API at: http://localhost:3000"
    echo "   3. View database with Prisma Studio: npx prisma studio"
    echo "   4. Or start Prisma Studio in Docker: docker-compose --profile tools up prisma-studio"
    echo ""
    echo "🐳 Docker containers running:"
    echo "   - PostgreSQL: localhost:5432 (database: dsphub)"
    echo "   - Redis: localhost:6379"
    echo ""
    show_status
    echo ""
    echo "🛠️  Useful commands:"
    echo "   - Stop containers: docker-compose down"
    echo "   - View logs: docker-compose logs -f postgres"
    echo "   - Reset database: docker-compose down -v && ./setup-database.sh"
    echo "   - Connect to database: docker exec -it dsphub_postgres psql -U postgres -d dsphub"
}

# Run main function
main "$@"

