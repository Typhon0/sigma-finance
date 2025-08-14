#!/bin/bash

# Test runner script for comprehensive unit tests
# This script runs all repository and service tests

set -e

echo "🧪 Running comprehensive unit tests for repositories and services..."
echo "=================================================================="

# Set test environment variables
export TEST_DB_HOST=${TEST_DB_HOST:-localhost}
export TEST_DB_PORT=${TEST_DB_PORT:-5432}
export TEST_DB_USER=${TEST_DB_USER:-postgres}
export TEST_DB_PASSWORD=${TEST_DB_PASSWORD:-postgres}
export TEST_DB_NAME=${TEST_DB_NAME:-sigma_finance_test}
export TEST_DB_SSLMODE=${TEST_DB_SSLMODE:-disable}

echo "📋 Test Configuration:"
echo "  Database Host: $TEST_DB_HOST"
echo "  Database Port: $TEST_DB_PORT"
echo "  Database Name: $TEST_DB_NAME"
echo "  Database User: $TEST_DB_USER"
echo ""

# Check if test database is available (optional - tests will fail gracefully if not)
echo "🔍 Checking test database connectivity..."
if command -v psql &> /dev/null; then
    if PGPASSWORD=$TEST_DB_PASSWORD psql -h $TEST_DB_HOST -p $TEST_DB_PORT -U $TEST_DB_USER -d $TEST_DB_NAME -c "SELECT 1;" &> /dev/null; then
        echo "✅ Test database is accessible"
    else
        echo "⚠️  Test database is not accessible - integration tests may fail"
        echo "   Make sure PostgreSQL is running and the test database exists"
    fi
else
    echo "⚠️  psql not found - skipping database connectivity check"
fi

echo ""

# Run repository tests
echo "🗄️  Running Repository Tests..."
echo "--------------------------------"
go test -v ./internal/repository/... -run "Test.*Repository.*" || echo "❌ Some repository tests failed"

echo ""

# Run service tests  
echo "🔧 Running Service Tests..."
echo "---------------------------"
go test -v ./internal/service/... -run "Test.*Service.*" || echo "❌ Some service tests failed"

echo ""

# Run all tests with coverage
echo "📊 Running All Tests with Coverage..."
echo "------------------------------------"
go test -v -coverprofile=coverage.out ./internal/repository/... ./internal/service/...

# Generate coverage report
if [ -f coverage.out ]; then
    echo ""
    echo "📈 Test Coverage Summary:"
    echo "------------------------"
    go tool cover -func=coverage.out | tail -1
    
    # Generate HTML coverage report
    go tool cover -html=coverage.out -o coverage.html
    echo "📄 Detailed coverage report generated: coverage.html"
fi

echo ""
echo "✅ Test execution completed!"
echo "=========================="