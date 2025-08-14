package service

import (
	"context"
	"errors"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/uptrace/bun"
)

// MockPortfolioRepository is a mock implementation of IRepository[model.Portfolio] for testing
type MockPortfolioRepository struct {
	mock.Mock
}

func (m *MockPortfolioRepository) GetDB() bun.IDB {
	args := m.Called()
	return args.Get(0).(bun.IDB)
}

func (m *MockPortfolioRepository) Create(ctx context.Context, entity *model.Portfolio) (*model.Portfolio, error) {
	args := m.Called(ctx, entity)
	return args.Get(0).(*model.Portfolio), args.Error(1)
}

func (m *MockPortfolioRepository) Update(ctx context.Context, entity *model.Portfolio) error {
	args := m.Called(ctx, entity)
	return args.Error(0)
}

func (m *MockPortfolioRepository) Delete(ctx context.Context, id uint) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockPortfolioRepository) GetByID(ctx context.Context, id uint) (model.Portfolio, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(model.Portfolio), args.Error(1)
}

func (m *MockPortfolioRepository) FindOneBy(ctx context.Context, options ...repository.QueryOption) (model.Portfolio, error) {
	args := m.Called(ctx, options)
	return args.Get(0).(model.Portfolio), args.Error(1)
}

func (m *MockPortfolioRepository) FindAllBy(ctx context.Context, options ...repository.QueryOption) ([]model.Portfolio, error) {
	args := m.Called(ctx, options)
	return args.Get(0).([]model.Portfolio), args.Error(1)
}

func (m *MockPortfolioRepository) Count(ctx context.Context, options ...repository.QueryOption) (int, error) {
	args := m.Called(ctx, options)
	return args.Int(0), args.Error(1)
}

func TestPortfolioService_GetByID(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockPortfolioRepo := new(MockPortfolioRepository)

	expectedPortfolio := model.Portfolio{
		ID:     1,
		UserID: 1,
		Name:   "Test Portfolio",
	}

	mockUoW.On("Portfolio").Return(mockPortfolioRepo)
	mockPortfolioRepo.On("GetByID", mock.Anything, uint(1)).Return(expectedPortfolio, nil)

	service := NewPortfolioService(mockUoW)

	portfolio, err := service.GetByID(context.Background(), 1)

	require.NoError(t, err)
	assert.Equal(t, expectedPortfolio, portfolio)
	mockUoW.AssertExpectations(t)
	mockPortfolioRepo.AssertExpectations(t)
}

func TestPortfolioService_GetByID_NotFound(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockPortfolioRepo := new(MockPortfolioRepository)

	mockUoW.On("Portfolio").Return(mockPortfolioRepo)
	mockPortfolioRepo.On("GetByID", mock.Anything, uint(999)).Return(model.Portfolio{}, repository.ErrNotFound)

	service := NewPortfolioService(mockUoW)

	_, err := service.GetByID(context.Background(), 999)

	assert.ErrorIs(t, err, repository.ErrNotFound)
	mockUoW.AssertExpectations(t)
	mockPortfolioRepo.AssertExpectations(t)
}

func TestPortfolioService_FindAll(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockPortfolioRepo := new(MockPortfolioRepository)

	expectedPortfolios := []model.Portfolio{
		{ID: 1, UserID: 1, Name: "Portfolio 1"},
		{ID: 2, UserID: 1, Name: "Portfolio 2"},
	}

	mockUoW.On("Portfolio").Return(mockPortfolioRepo)
	mockPortfolioRepo.On("FindAllBy", mock.Anything, mock.Anything).Return(expectedPortfolios, nil)

	service := NewPortfolioService(mockUoW)

	portfolios, err := service.FindAll(context.Background())

	require.NoError(t, err)
	assert.Equal(t, expectedPortfolios, portfolios)
	mockUoW.AssertExpectations(t)
	mockPortfolioRepo.AssertExpectations(t)
}

func TestPortfolioService_CreatePortfolio_Success(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockPortfolioRepo := new(MockPortfolioRepository)
	mockUserRepo := new(MockUserRepository)

	input := CreatePortfolioInput{
		UserID: 1,
		Name:   "Test Portfolio",
	}

	existingUser := model.User{
		ID:       1,
		Username: "testuser",
		Email:    "test@example.com",
	}

	expectedPortfolio := &model.Portfolio{
		ID:     1,
		UserID: 1,
		Name:   "Test Portfolio",
	}

	mockUoW.On("User").Return(mockUserRepo)
	mockUoW.On("Portfolio").Return(mockPortfolioRepo)
	mockUserRepo.On("GetByID", mock.Anything, uint(1)).Return(existingUser, nil)
	mockPortfolioRepo.On("Create", mock.Anything, mock.MatchedBy(func(portfolio *model.Portfolio) bool {
		return portfolio.UserID == int(input.UserID) && portfolio.Name == input.Name
	})).Return(expectedPortfolio, nil)

	service := NewPortfolioService(mockUoW)

	portfolio, err := service.CreatePortfolio(context.Background(), input)

	require.NoError(t, err)
	assert.Equal(t, *expectedPortfolio, portfolio)
	mockUoW.AssertExpectations(t)
	mockPortfolioRepo.AssertExpectations(t)
	mockUserRepo.AssertExpectations(t)
}

func TestPortfolioService_CreatePortfolio_ValidationErrors(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	service := NewPortfolioService(mockUoW)

	testCases := []struct {
		name        string
		input       CreatePortfolioInput
		expectedErr string
	}{
		{
			name: "Name too short",
			input: CreatePortfolioInput{
				UserID: 1,
				Name:   "AB",
			},
			expectedErr: "portfolio name must be at least 3 characters long",
		},
		{
			name: "Invalid user ID",
			input: CreatePortfolioInput{
				UserID: 0,
				Name:   "Test Portfolio",
			},
			expectedErr: "a valid user ID is required",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := service.CreatePortfolio(context.Background(), tc.input)
			assert.Error(t, err)
			assert.Contains(t, err.Error(), tc.expectedErr)
		})
	}
}

func TestPortfolioService_CreatePortfolio_UserNotFound(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockUserRepo := new(MockUserRepository)

	input := CreatePortfolioInput{
		UserID: 999,
		Name:   "Test Portfolio",
	}

	mockUoW.On("User").Return(mockUserRepo)
	mockUserRepo.On("GetByID", mock.Anything, uint(999)).Return(model.User{}, repository.ErrNotFound)

	service := NewPortfolioService(mockUoW)

	_, err := service.CreatePortfolio(context.Background(), input)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "user with ID 999 not found")
	mockUoW.AssertExpectations(t)
	mockUserRepo.AssertExpectations(t)
}

func TestPortfolioService_CreatePortfolio_RepositoryError(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockPortfolioRepo := new(MockPortfolioRepository)
	mockUserRepo := new(MockUserRepository)

	input := CreatePortfolioInput{
		UserID: 1,
		Name:   "Test Portfolio",
	}

	existingUser := model.User{
		ID:       1,
		Username: "testuser",
		Email:    "test@example.com",
	}

	mockUoW.On("User").Return(mockUserRepo)
	mockUoW.On("Portfolio").Return(mockPortfolioRepo)
	mockUserRepo.On("GetByID", mock.Anything, uint(1)).Return(existingUser, nil)
	mockPortfolioRepo.On("Create", mock.Anything, mock.Anything).Return((*model.Portfolio)(nil), errors.New("database error"))

	service := NewPortfolioService(mockUoW)

	_, err := service.CreatePortfolio(context.Background(), input)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to create portfolio")
	mockUoW.AssertExpectations(t)
	mockPortfolioRepo.AssertExpectations(t)
	mockUserRepo.AssertExpectations(t)
}

func TestPortfolioService_UpdatePortfolio_Success(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockPortfolioRepo := new(MockPortfolioRepository)

	existingPortfolio := model.Portfolio{
		ID:     1,
		UserID: 1,
		Name:   "Old Portfolio Name",
	}

	newName := "New Portfolio Name"
	input := UpdatePortfolioInput{
		Name: &newName,
	}

	mockUoW.On("Portfolio").Return(mockPortfolioRepo)
	mockPortfolioRepo.On("GetByID", mock.Anything, uint(1)).Return(existingPortfolio, nil)
	mockPortfolioRepo.On("Update", mock.Anything, mock.MatchedBy(func(portfolio *model.Portfolio) bool {
		return portfolio.ID == 1 && portfolio.Name == newName
	})).Return(nil)

	service := NewPortfolioService(mockUoW)

	updatedPortfolio, err := service.UpdatePortfolio(context.Background(), 1, input)

	require.NoError(t, err)
	assert.Equal(t, 1, updatedPortfolio.ID)
	assert.Equal(t, newName, updatedPortfolio.Name)
	assert.Equal(t, 1, updatedPortfolio.UserID) // Should remain unchanged
	mockUoW.AssertExpectations(t)
	mockPortfolioRepo.AssertExpectations(t)
}

func TestPortfolioService_UpdatePortfolio_PortfolioNotFound(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockPortfolioRepo := new(MockPortfolioRepository)

	input := UpdatePortfolioInput{
		Name: stringPtr("New Portfolio Name"),
	}

	mockUoW.On("Portfolio").Return(mockPortfolioRepo)
	mockPortfolioRepo.On("GetByID", mock.Anything, uint(999)).Return(model.Portfolio{}, repository.ErrNotFound)

	service := NewPortfolioService(mockUoW)

	_, err := service.UpdatePortfolio(context.Background(), 999, input)

	assert.ErrorIs(t, err, repository.ErrNotFound)
	mockUoW.AssertExpectations(t)
	mockPortfolioRepo.AssertExpectations(t)
}

func TestPortfolioService_UpdatePortfolio_RepositoryError(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockPortfolioRepo := new(MockPortfolioRepository)

	existingPortfolio := model.Portfolio{
		ID:     1,
		UserID: 1,
		Name:   "Old Portfolio Name",
	}

	input := UpdatePortfolioInput{
		Name: stringPtr("New Portfolio Name"),
	}

	mockUoW.On("Portfolio").Return(mockPortfolioRepo)
	mockPortfolioRepo.On("GetByID", mock.Anything, uint(1)).Return(existingPortfolio, nil)
	mockPortfolioRepo.On("Update", mock.Anything, mock.Anything).Return(errors.New("database error"))

	service := NewPortfolioService(mockUoW)

	_, err := service.UpdatePortfolio(context.Background(), 1, input)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to update portfolio")
	mockUoW.AssertExpectations(t)
	mockPortfolioRepo.AssertExpectations(t)
}

func TestPortfolioService_DeletePortfolio_Success(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockPortfolioRepo := new(MockPortfolioRepository)

	mockUoW.On("Portfolio").Return(mockPortfolioRepo)
	mockPortfolioRepo.On("Delete", mock.Anything, uint(1)).Return(nil)

	service := NewPortfolioService(mockUoW)

	err := service.DeletePortfolio(context.Background(), 1)

	require.NoError(t, err)
	mockUoW.AssertExpectations(t)
	mockPortfolioRepo.AssertExpectations(t)
}

func TestPortfolioService_DeletePortfolio_NotFound(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockPortfolioRepo := new(MockPortfolioRepository)

	mockUoW.On("Portfolio").Return(mockPortfolioRepo)
	mockPortfolioRepo.On("Delete", mock.Anything, uint(999)).Return(repository.ErrNotFound)

	service := NewPortfolioService(mockUoW)

	err := service.DeletePortfolio(context.Background(), 999)

	assert.ErrorIs(t, err, repository.ErrNotFound)
	mockUoW.AssertExpectations(t)
	mockPortfolioRepo.AssertExpectations(t)
}

// Test removed - GetByUserID method doesn't exist in PortfolioService
// The method was replaced with GetPortfolioAssets and other portfolio-specific methods
