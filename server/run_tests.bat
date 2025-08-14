@echo off
REM Test runner script for comprehensive unit tests
REM This script runs all repository and service tests

echo 🧪 Running comprehensive unit tests for repositories and services...
echo ==================================================================

REM Set test environment variables
if "%TEST_DB_HOST%"=="" set TEST_DB_HOST=localhost
if "%TEST_DB_PORT%"=="" set TEST_DB_PORT=5432
if "%TEST_DB_USER%"=="" set TEST_DB_USER=postgres
if "%TEST_DB_PASSWORD%"=="" set TEST_DB_PASSWORD=postgres
if "%TEST_DB_NAME%"=="" set TEST_DB_NAME=sigma_finance_test
if "%TEST_DB_SSLMODE%"=="" set TEST_DB_SSLMODE=disable

echo 📋 Test Configuration:
echo   Database Host: %TEST_DB_HOST%
echo   Database Port: %TEST_DB_PORT%
echo   Database Name: %TEST_DB_NAME%
echo   Database User: %TEST_DB_USER%
echo.

echo 🗄️  Running Repository Tests...
echo --------------------------------
go test -v ./internal/repository/... -run "Test.*Repository.*"
if errorlevel 1 echo ❌ Some repository tests failed

echo.

echo 🔧 Running Service Tests...
echo ---------------------------
go test -v ./internal/service/... -run "Test.*Service.*"
if errorlevel 1 echo ❌ Some service tests failed

echo.

echo 📊 Running All Tests with Coverage...
echo ------------------------------------
go test -v -coverprofile=coverage.out ./internal/repository/... ./internal/service/...

REM Generate coverage report
if exist coverage.out (
    echo.
    echo 📈 Test Coverage Summary:
    echo ------------------------
    go tool cover -func=coverage.out | findstr "total:"
    
    REM Generate HTML coverage report
    go tool cover -html=coverage.out -o coverage.html
    echo 📄 Detailed coverage report generated: coverage.html
)

echo.
echo ✅ Test execution completed!
echo ==========================
pause