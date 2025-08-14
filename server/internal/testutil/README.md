# Test Utilities

This package provides comprehensive testing utilities for the Sigma Finance application, including database setup, test data seeding, and mock implementations.

## Overview

The test utilities support both unit testing (with mocks) and integration testing (with real database connections). The testing strategy follows Clean Architecture principles and ensures comprehensive coverage of all repository and service layers.

## Components

### TestDB
- **Purpose**: Manages test database connections and cleanup
- **Features**: 
  - Automatic connection management
  - Table cleanup between tests
  - Test data seeding
  - Graceful error handling

### TestData
- **Purpose**: Provides consistent test data across all tests
- **Includes**: Users, Portfolios, Assets, AssetTypes, Tags
- **Features**: Realistic data relationships and proper foreign key constraints

### Mock Implementations
- **MockUnitOfWork**: Complete mock of the Unit of Work pattern
- **MockRepositories**: Individual repository mocks for all entities
- **Features**: 
  - Full interface compliance
  - Testify mock integration
  - Assertion support

## Usage

### Integration Tests (with Database)

```go
func TestRepositoryIntegration(t *testing.T) {
    testDB := testutil.NewTestDB(t)
    defer testDB.Close()
    
    ctx := context.Background()
    testDB.CleanupTables(ctx)
    testData := testDB.SeedTestData(ctx)
    
    repo := NewRepository[model.User](testDB.DB)
    
    // Test with real database
    user, err := repo.GetByID(ctx, uint(testData.Users[0].ID))
    require.NoError(t, err)
    assert.Equal(t, testData.Users[0].Username, user.Username)
}
```

### Unit Tests (with Mocks)

```go
func TestServiceUnit(t *testing.T) {
    mockUoW := new(testutil.MockUnitOfWork)
    mockRepo := new(testutil.MockUserRepository)
    
    expectedUser := model.User{ID: 1, Username: "test"}
    
    mockUoW.On("User").Return(mockRepo)
    mockRepo.On("GetByID", mock.Anything, uint(1)).Return(expectedUser, nil)
    
    service := NewUserService(mockUoW)
    
    user, err := service.GetByID(context.Background(), 1)
    require.NoError(t, err)
    assert.Equal(t, expectedUser, user)
    
    mockUoW.AssertExpectations(t)
    mockRepo.AssertExpectations(t)
}
```

## Database Configuration

### Environment Variables

Set these environment variables for test database configuration:

```bash
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_USER=postgres
TEST_DB_PASSWORD=postgres
TEST_DB_NAME=sigma_finance_test
TEST_DB_SSLMODE=disable
```

### Test Database Setup

1. Create a test database:
```sql
CREATE DATABASE sigma_finance_test;
```

2. Run migrations on the test database to create tables

3. The test utilities will handle data cleanup and seeding automatically

## Test Data Structure

### Users
- **testuser1**: Primary test user with portfolios and assets
- **testuser2**: Secondary test user for multi-user scenarios

### Portfolios
- **Test Portfolio 1**: Belongs to testuser1
- **Test Portfolio 2**: Belongs to testuser2

### Assets
- **Apple Inc**: Stock asset with realistic pricing
- **Bitcoin**: Crypto asset with realistic pricing

### Asset Types
- **Stock**: For traditional equity assets
- **Crypto**: For cryptocurrency assets

### Tags
- **Technology**: For tech-related assets
- **High Risk**: For high-risk investments

## Best Practices

### Test Isolation
- Always call `testDB.CleanupTables(ctx)` before each test
- Use separate test database from development/production
- Seed fresh test data for each test scenario

### Mock Usage
- Use mocks for unit tests to isolate business logic
- Use real database for integration tests
- Always assert mock expectations to catch interface changes

### Error Testing
- Test both success and failure scenarios
- Test validation errors with specific error messages
- Test repository errors (not found, database errors)
- Test business logic errors (insufficient funds, invalid data)

### Financial Data Testing
- Test money handling with integer arithmetic
- Test ownership percentage validation (0-100%)
- Test transaction amount validation
- Test balance calculations and updates

## Running Tests

### All Tests
```bash
# Windows
run_tests.bat

# Linux/Mac
./run_tests.sh
```

### Specific Test Categories
```bash
# Repository tests only
go test -v ./internal/repository/...

# Service tests only  
go test -v ./internal/service/...

# With coverage
go test -v -coverprofile=coverage.out ./internal/repository/... ./internal/service/...
```

### Individual Test Files
```bash
# Specific repository
go test -v ./internal/repository/ -run TestRepository_Create

# Specific service
go test -v ./internal/service/ -run TestUserService_CreateUser
```

## Coverage Goals

- **Repository Layer**: >90% coverage including error scenarios
- **Service Layer**: >95% coverage including validation and business logic
- **Integration Tests**: Cover all major user workflows
- **Error Handling**: Test all error paths and edge cases

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running
- Check test database exists and is accessible
- Verify environment variables are set correctly
- Check firewall/network connectivity

### Test Failures
- Check for proper test isolation (cleanup between tests)
- Verify test data seeding is working correctly
- Check for race conditions in concurrent tests
- Validate mock expectations are properly set

### Performance Issues
- Use test database on same machine as tests
- Consider using in-memory database for unit tests
- Optimize test data seeding for large test suites
- Use parallel test execution where appropriate