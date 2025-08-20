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

// MockUserRepository is a mock implementation of IRepository[model.User] for testing
type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) GetDB() bun.IDB {
	args := m.Called()
	return args.Get(0).(bun.IDB)
}

func (m *MockUserRepository) Create(ctx context.Context, entity *model.User) (*model.User, error) {
	args := m.Called(ctx, entity)
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockUserRepository) Update(ctx context.Context, entity *model.User) error {
	args := m.Called(ctx, entity)
	return args.Error(0)
}

func (m *MockUserRepository) Delete(ctx context.Context, id uint) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) GetByID(ctx context.Context, id uint) (model.User, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(model.User), args.Error(1)
}

func (m *MockUserRepository) FindOneBy(ctx context.Context, options ...repository.QueryOption) (model.User, error) {
	args := m.Called(ctx, options)
	return args.Get(0).(model.User), args.Error(1)
}

func (m *MockUserRepository) FindAllBy(ctx context.Context, options ...repository.QueryOption) ([]model.User, error) {
	args := m.Called(ctx, options)
	return args.Get(0).([]model.User), args.Error(1)
}

func (m *MockUserRepository) Count(ctx context.Context, options ...repository.QueryOption) (int, error) {
	args := m.Called(ctx, options)
	return args.Int(0), args.Error(1)
}

func TestUserService_GetByID(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockUserRepo := new(MockUserRepository)

	expectedUser := model.User{
		ID:       1,
		Username: "testuser",
		Email:    "test@example.com",
		Password: "hashedpassword",
	}

	mockUoW.On("User").Return(mockUserRepo)
	mockUserRepo.On("GetByID", mock.Anything, uint(1)).Return(expectedUser, nil)

	service := NewUserService(mockUoW)

	user, err := service.GetByID(context.Background(), 1)

	require.NoError(t, err)
	assert.Equal(t, expectedUser, user)
	mockUoW.AssertExpectations(t)
	mockUserRepo.AssertExpectations(t)
}

func TestUserService_GetByID_NotFound(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockUserRepo := new(MockUserRepository)

	mockUoW.On("User").Return(mockUserRepo)
	mockUserRepo.On("GetByID", mock.Anything, uint(999)).Return(model.User{}, repository.ErrNotFound)

	service := NewUserService(mockUoW)

	_, err := service.GetByID(context.Background(), 999)

	assert.ErrorIs(t, err, repository.ErrNotFound)
	mockUoW.AssertExpectations(t)
	mockUserRepo.AssertExpectations(t)
}

func TestUserService_FindAll(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockUserRepo := new(MockUserRepository)

	expectedUsers := []model.User{
		{ID: 1, Username: "user1", Email: "user1@example.com"},
		{ID: 2, Username: "user2", Email: "user2@example.com"},
	}

	mockUoW.On("User").Return(mockUserRepo)
	mockUserRepo.On("FindAllBy", mock.Anything, mock.Anything).Return(expectedUsers, nil)

	service := NewUserService(mockUoW)

	users, err := service.FindAll(context.Background())

	require.NoError(t, err)
	assert.Equal(t, expectedUsers, users)
	mockUoW.AssertExpectations(t)
	mockUserRepo.AssertExpectations(t)
}

func TestUserService_CreateUser_Success(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockUserRepo := new(MockUserRepository)

	input := CreateUserInput{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "password123",
	}

	expectedUser := &model.User{
		ID:       1,
		Username: "testuser",
		Email:    "test@example.com",
		Password: "password123",
	}

	mockUoW.On("User").Return(mockUserRepo)
	mockUserRepo.On("Create", mock.Anything, mock.MatchedBy(func(user *model.User) bool {
		return user.Username == input.Username && user.Email == input.Email && user.Password == input.Password
	})).Return(expectedUser, nil)

	service := NewUserService(mockUoW)

	user, err := service.CreateUser(context.Background(), input)

	require.NoError(t, err)
	assert.Equal(t, *expectedUser, user)
	mockUoW.AssertExpectations(t)
	mockUserRepo.AssertExpectations(t)
}

func TestUserService_CreateUser_ValidationErrors(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	service := NewUserService(mockUoW)

	testCases := []struct {
		name        string
		input       CreateUserInput
		expectedErr string
	}{
		{
			name: "Username too short",
			input: CreateUserInput{
				Username: "ab",
				Email:    "test@example.com",
				Password: "password123",
			},
			expectedErr: "username must be at least 3 characters long",
		},
		{
			name: "Empty email",
			input: CreateUserInput{
				Username: "testuser",
				Email:    "",
				Password: "password123",
			},
			expectedErr: "email is required",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := service.CreateUser(context.Background(), tc.input)
			assert.Error(t, err)
			assert.Contains(t, err.Error(), tc.expectedErr)
		})
	}
}

func TestUserService_CreateUser_RepositoryError(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockUserRepo := new(MockUserRepository)

	input := CreateUserInput{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "password123",
	}

	mockUoW.On("User").Return(mockUserRepo)
	mockUserRepo.On("Create", mock.Anything, mock.Anything).Return((*model.User)(nil), errors.New("database error"))

	service := NewUserService(mockUoW)

	_, err := service.CreateUser(context.Background(), input)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to create user")
	mockUoW.AssertExpectations(t)
	mockUserRepo.AssertExpectations(t)
}

func TestUserService_UpdateUser_Success(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockUserRepo := new(MockUserRepository)

	existingUser := model.User{
		ID:       1,
		Username: "testuser",
		Email:    "old@example.com",
		Password: "oldpassword",
	}

	newEmail := "new@example.com"
	newPassword := "newpassword"
	input := UpdateUserInput{
		Email:    &newEmail,
		Password: &newPassword,
	}

	mockUoW.On("User").Return(mockUserRepo)
	mockUserRepo.On("GetByID", mock.Anything, uint(1)).Return(existingUser, nil)
	mockUserRepo.On("Update", mock.Anything, mock.MatchedBy(func(user *model.User) bool {
		return user.ID == 1 && user.Email == newEmail && user.Password == newPassword
	})).Return(nil)

	service := NewUserService(mockUoW)

	updatedUser, err := service.UpdateUser(context.Background(), 1, input)

	require.NoError(t, err)
	assert.Equal(t, 1, updatedUser.ID)
	assert.Equal(t, newEmail, updatedUser.Email)
	assert.Equal(t, newPassword, updatedUser.Password)
	assert.Equal(t, "testuser", updatedUser.Username) // Should remain unchanged
	mockUoW.AssertExpectations(t)
	mockUserRepo.AssertExpectations(t)
}

func TestUserService_UpdateUser_PartialUpdate(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockUserRepo := new(MockUserRepository)

	existingUser := model.User{
		ID:       1,
		Username: "testuser",
		Email:    "old@example.com",
		Password: "oldpassword",
	}

	newEmail := "new@example.com"
	input := UpdateUserInput{
		Email: &newEmail,
		// Password is nil, should not be updated
	}

	mockUoW.On("User").Return(mockUserRepo)
	mockUserRepo.On("GetByID", mock.Anything, uint(1)).Return(existingUser, nil)
	mockUserRepo.On("Update", mock.Anything, mock.MatchedBy(func(user *model.User) bool {
		return user.ID == 1 && user.Email == newEmail && user.Password == "oldpassword"
	})).Return(nil)

	service := NewUserService(mockUoW)

	updatedUser, err := service.UpdateUser(context.Background(), 1, input)

	require.NoError(t, err)
	assert.Equal(t, newEmail, updatedUser.Email)
	assert.Equal(t, "oldpassword", updatedUser.Password) // Should remain unchanged
	mockUoW.AssertExpectations(t)
	mockUserRepo.AssertExpectations(t)
}

func TestUserService_UpdateUser_UserNotFound(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockUserRepo := new(MockUserRepository)

	input := UpdateUserInput{
		Email: stringPtr("new@example.com"),
	}

	mockUoW.On("User").Return(mockUserRepo)
	mockUserRepo.On("GetByID", mock.Anything, uint(999)).Return(model.User{}, repository.ErrNotFound)

	service := NewUserService(mockUoW)

	_, err := service.UpdateUser(context.Background(), 999, input)

	assert.ErrorIs(t, err, repository.ErrNotFound)
	mockUoW.AssertExpectations(t)
	mockUserRepo.AssertExpectations(t)
}

func TestUserService_UpdateUser_RepositoryError(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockUserRepo := new(MockUserRepository)

	existingUser := model.User{
		ID:       1,
		Username: "testuser",
		Email:    "old@example.com",
		Password: "oldpassword",
	}

	input := UpdateUserInput{
		Email: stringPtr("new@example.com"),
	}

	mockUoW.On("User").Return(mockUserRepo)
	mockUserRepo.On("GetByID", mock.Anything, uint(1)).Return(existingUser, nil)
	mockUserRepo.On("Update", mock.Anything, mock.Anything).Return(errors.New("database error"))

	service := NewUserService(mockUoW)

	_, err := service.UpdateUser(context.Background(), 1, input)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to update user")
	mockUoW.AssertExpectations(t)
	mockUserRepo.AssertExpectations(t)
}

func TestUserService_DeleteUser_Success(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockUserRepo := new(MockUserRepository)

	mockUoW.On("User").Return(mockUserRepo)
	mockUserRepo.On("Delete", mock.Anything, uint(1)).Return(nil)

	service := NewUserService(mockUoW)

	err := service.DeleteUser(context.Background(), 1)

	require.NoError(t, err)
	mockUoW.AssertExpectations(t)
	mockUserRepo.AssertExpectations(t)
}

func TestUserService_DeleteUser_NotFound(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockUserRepo := new(MockUserRepository)

	mockUoW.On("User").Return(mockUserRepo)
	mockUserRepo.On("Delete", mock.Anything, uint(999)).Return(repository.ErrNotFound)

	service := NewUserService(mockUoW)

	err := service.DeleteUser(context.Background(), 999)

	assert.ErrorIs(t, err, repository.ErrNotFound)
	mockUoW.AssertExpectations(t)
	mockUserRepo.AssertExpectations(t)
}

// MockPortfolioAssetRepository is a mock implementation of PortfolioAssetRepository for testing
type MockPortfolioAssetRepository struct {
	mock.Mock
}

func (m *MockPortfolioAssetRepository) GetDB() bun.IDB {
	args := m.Called()
	return args.Get(0).(bun.IDB)
}

func (m *MockPortfolioAssetRepository) Create(ctx context.Context, entity *model.PortfolioAsset) (*model.PortfolioAsset, error) {
	args := m.Called(ctx, entity)
	return args.Get(0).(*model.PortfolioAsset), args.Error(1)
}

func (m *MockPortfolioAssetRepository) Update(ctx context.Context, entity *model.PortfolioAsset) error {
	args := m.Called(ctx, entity)
	return args.Error(0)
}

func (m *MockPortfolioAssetRepository) Delete(ctx context.Context, id uint) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockPortfolioAssetRepository) GetByID(ctx context.Context, id uint) (model.PortfolioAsset, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(model.PortfolioAsset), args.Error(1)
}

func (m *MockPortfolioAssetRepository) FindOneBy(ctx context.Context, options ...repository.QueryOption) (model.PortfolioAsset, error) {
	args := m.Called(ctx, options)
	return args.Get(0).(model.PortfolioAsset), args.Error(1)
}

func (m *MockPortfolioAssetRepository) FindAllBy(ctx context.Context, options ...repository.QueryOption) ([]model.PortfolioAsset, error) {
	args := m.Called(ctx, options)
	return args.Get(0).([]model.PortfolioAsset), args.Error(1)
}

func (m *MockPortfolioAssetRepository) Count(ctx context.Context, options ...repository.QueryOption) (int, error) {
	args := m.Called(ctx, options)
	return args.Int(0), args.Error(1)
}

func (m *MockPortfolioAssetRepository) GetByPortfolioID(ctx context.Context, portfolioID int) ([]model.PortfolioAsset, error) {
	args := m.Called(ctx, portfolioID)
	return args.Get(0).([]model.PortfolioAsset), args.Error(1)
}

func (m *MockPortfolioAssetRepository) GetByAssetID(ctx context.Context, assetID int) ([]model.PortfolioAsset, error) {
	args := m.Called(ctx, assetID)
	return args.Get(0).([]model.PortfolioAsset), args.Error(1)
}

func (m *MockPortfolioAssetRepository) GetWithAssetDetails(ctx context.Context, id int) (model.PortfolioAsset, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(model.PortfolioAsset), args.Error(1)
}

func (m *MockPortfolioAssetRepository) UpdateQuantity(ctx context.Context, id int, quantity float64) error {
	args := m.Called(ctx, id, quantity)
	return args.Error(0)
}

func (m *MockPortfolioAssetRepository) UpdateOwnership(ctx context.Context, id int, ownershipPct float64) error {
	args := m.Called(ctx, id, ownershipPct)
	return args.Error(0)
}

func (m *MockPortfolioAssetRepository) FindByPortfolioID(ctx context.Context, portfolioID int) ([]model.PortfolioAsset, error) {
	args := m.Called(ctx, portfolioID)
	return args.Get(0).([]model.PortfolioAsset), args.Error(1)
}

func (m *MockPortfolioAssetRepository) FindByPortfolioAndAsset(ctx context.Context, portfolioID, assetID int) (model.PortfolioAsset, error) {
	args := m.Called(ctx, portfolioID, assetID)
	return args.Get(0).(model.PortfolioAsset), args.Error(1)
}

func (m *MockPortfolioAssetRepository) UpdatePortfolioAsset(ctx context.Context, portfolioID, assetID int, quantity, price float64) error {
	args := m.Called(ctx, portfolioID, assetID, quantity, price)
	return args.Error(0)
}

func (m *MockPortfolioAssetRepository) DeleteByPortfolioAndAsset(ctx context.Context, portfolioID, assetID int) error {
	args := m.Called(ctx, portfolioID, assetID)
	return args.Error(0)
}

func (m *MockPortfolioAssetRepository) FindByAssetID(ctx context.Context, assetID int) ([]model.PortfolioAsset, error) {
	args := m.Called(ctx, assetID)
	return args.Get(0).([]model.PortfolioAsset), args.Error(1)
}

func (m *MockPortfolioAssetRepository) UpdateAveragePurchasePrice(ctx context.Context, portfolioID, assetID int, avgPrice float64) error {
	args := m.Called(ctx, portfolioID, assetID, avgPrice)
	return args.Error(0)
}

// Helper function to create string pointers
func stringPtr(s string) *string {
	return &s
}
