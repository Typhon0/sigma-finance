@echo off
echo Running comprehensive authentication integration tests...
echo.

echo ========================================
echo Running GraphQL Authentication Integration Tests
echo ========================================
go test -v ./internal/handler/graphql -run "TestGraphQLIntegration_AuthenticationOperations|TestGraphQLIntegration_WeakPasswordValidation|TestGraphQLIntegration_AuthenticationErrorHandling" -timeout 30s
if %ERRORLEVEL% neq 0 (
    echo FAILED: GraphQL Authentication Integration Tests
    exit /b 1
)

echo.
echo ========================================
echo Running Comprehensive Authentication Flow Tests
echo ========================================
go test -v ./internal/handler/graphql -run "TestComprehensiveAuthenticationFlows" -timeout 30s
if %ERRORLEVEL% neq 0 (
    echo FAILED: Comprehensive Authentication Flow Tests
    exit /b 1
)

echo.
echo ========================================
echo Running Security and Rate Limiting Tests
echo ========================================
go test -v ./internal/handler/graphql -run "TestSecurityAndRateLimiting" -timeout 30s
if %ERRORLEVEL% neq 0 (
    echo FAILED: Security and Rate Limiting Tests
    exit /b 1
)

echo.
echo ========================================
echo Running JWT Token Lifecycle Tests
echo ========================================
go test -v ./internal/handler/graphql -run "TestJWTTokenLifecycle" -timeout 30s
if %ERRORLEVEL% neq 0 (
    echo FAILED: JWT Token Lifecycle Tests
    exit /b 1
)

echo.
echo ========================================
echo Running Email Verification Workflow Tests
echo ========================================
go test -v ./internal/handler/graphql -run "TestEmailVerificationWorkflows" -timeout 30s
if %ERRORLEVEL% neq 0 (
    echo FAILED: Email Verification Workflow Tests
    exit /b 1
)

echo.
echo ========================================
echo Running Audit and Security Logging Tests
echo ========================================
go test -v ./internal/handler/graphql -run "TestAuditAndSecurityLogging" -timeout 30s
if %ERRORLEVEL% neq 0 (
    echo FAILED: Audit and Security Logging Tests
    exit /b 1
)

echo.
echo ========================================
echo Running Error Handling and Edge Cases Tests
echo ========================================
go test -v ./internal/handler/graphql -run "TestErrorHandlingAndEdgeCases" -timeout 30s
if %ERRORLEVEL% neq 0 (
    echo FAILED: Error Handling and Edge Cases Tests
    exit /b 1
)

echo.
echo ========================================
echo Running Rate Limiting Integration Tests
echo ========================================
go test -v ./internal/service -run "TestRateLimitingIntegration" -timeout 30s
if %ERRORLEVEL% neq 0 (
    echo FAILED: Rate Limiting Integration Tests
    exit /b 1
)

echo.
echo ========================================
echo Running Security Features Tests
echo ========================================
go test -v ./internal/service -run "TestSecurityFeatures" -timeout 30s
if %ERRORLEVEL% neq 0 (
    echo FAILED: Security Features Tests
    exit /b 1
)

echo.
echo ========================================
echo Running Token Lifecycle Management Tests
echo ========================================
go test -v ./internal/service -run "TestTokenLifecycleManagement" -timeout 30s
if %ERRORLEVEL% neq 0 (
    echo FAILED: Token Lifecycle Management Tests
    exit /b 1
)

echo.
echo ========================================
echo Running Authentication Flow Tests
echo ========================================
go test -v ./internal/handler/graphql -run "TestAuthenticationFlow_EndToEnd" -timeout 30s
if %ERRORLEVEL% neq 0 (
    echo FAILED: Authentication Flow Tests
    exit /b 1
)

echo.
echo ========================================
echo Running Middleware Integration Tests
echo ========================================
go test -v ./internal/handler/graphql -run "TestGraphQLAuthDirectives_Integration|TestRequireEmailVerifiedDirective_Integration" -timeout 30s
if %ERRORLEVEL% neq 0 (
    echo FAILED: Middleware Integration Tests
    exit /b 1
)

echo.
echo ========================================
echo Running Audit Integration Tests
echo ========================================
go test -v ./internal/service -run "TestAuditService_AuthenticationEventsIntegration|TestAuditService_HelperFunctions" -timeout 30s
if %ERRORLEVEL% neq 0 (
    echo FAILED: Audit Integration Tests
    exit /b 1
)

echo.
echo ========================================
echo ALL AUTHENTICATION INTEGRATION TESTS PASSED!
echo ========================================
echo.
echo Test Coverage Summary:
echo - Complete registration and login flows: PASSED
echo - Password reset and email verification workflows: PASSED  
echo - Security tests for rate limiting and account lockout: PASSED
echo - JWT token lifecycle and session management: PASSED
echo - Authentication error handling and edge cases: PASSED
echo - Audit logging for all authentication events: PASSED
echo - GraphQL directive enforcement: PASSED
echo - Token expiration and refresh mechanisms: PASSED
echo.
echo All requirements from task 12 have been validated successfully.