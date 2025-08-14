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
)

func TestAssetService_GetByID(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockAssetRepo := new(MockAssetRepository)

	expectedAsset := model.Asset{
		ID:           1,
		Name:         "Apple Inc",
		AssetTypeID:  1,
		CurrentValue: 150.0,
	}

	mockUoW.On("Asset").Return(mockAssetRepo)
	mockAssetRepo.On("GetByID", mock.Anything, uint(1)).Return(expectedAsset, nil)

	service := NewAssetService(mockUoW)

	asset, err := service.GetByID(context.Background(), 1)

	require.NoError(t, err)
	assert.Equal(t, expectedAsset, asset)
	mockUoW.AssertExpectations(t)
	mockAssetRepo.AssertExpectations(t)
}

func TestAssetService_GetByID_NotFound(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockAssetRepo := new(MockAssetRepository)

	mockUoW.On("Asset").Return(mockAssetRepo)
	mockAssetRepo.On("GetByID", mock.Anything, uint(999)).Return(model.Asset{}, repository.ErrNotFound)

	service := NewAssetService(mockUoW)

	_, err := service.GetByID(context.Background(), 999)

	assert.ErrorIs(t, err, repository.ErrNotFound)
	mockUoW.AssertExpectations(t)
	mockAssetRepo.AssertExpectations(t)
}

func TestAssetService_FindAll(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockAssetRepo := new(MockAssetRepository)

	expectedAssets := []model.Asset{
		{ID: 1, Name: "Apple Inc", AssetTypeID: 1},
		{ID: 2, Name: "Bitcoin", AssetTypeID: 2},
	}

	mockUoW.On("Asset").Return(mockAssetRepo)
	mockAssetRepo.On("FindAllBy", mock.Anything, mock.Anything).Return(expectedAssets, nil)

	service := NewAssetService(mockUoW)

	assets, err := service.FindAll(context.Background())

	require.NoError(t, err)
	assert.Equal(t, expectedAssets, assets)
	mockUoW.AssertExpectations(t)
	mockAssetRepo.AssertExpectations(t)
}

func TestAssetService_CreateAsset_Success(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockAssetRepo := new(MockAssetRepository)

	input := CreateAssetInput{
		Name:      "Apple Inc",
		AssetType: "Stock",
		Value:     150.0,
	}

	expectedAsset := &model.Asset{
		ID:           1,
		Name:         "Apple Inc",
		CurrentValue: 150.0,
	}

	mockUoW.On("Asset").Return(mockAssetRepo)
	mockAssetRepo.On("Create", mock.Anything, mock.MatchedBy(func(asset *model.Asset) bool {
		return asset.Name == input.Name && asset.CurrentValue == input.Value
	})).Return(expectedAsset, nil)

	service := NewAssetService(mockUoW)

	asset, err := service.CreateAsset(context.Background(), input)

	require.NoError(t, err)
	assert.Equal(t, *expectedAsset, asset)
	mockUoW.AssertExpectations(t)
	mockAssetRepo.AssertExpectations(t)
}

func TestAssetService_CreateAsset_ValidationErrors(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	service := NewAssetService(mockUoW)

	testCases := []struct {
		name        string
		input       CreateAssetInput
		expectedErr string
	}{
		{
			name: "Name too short",
			input: CreateAssetInput{
				Name:      "AB",
				AssetType: "Stock",
				Value:     150.0,
			},
			expectedErr: "asset name must be at least 3 characters long",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := service.CreateAsset(context.Background(), tc.input)
			assert.Error(t, err)
			assert.Contains(t, err.Error(), tc.expectedErr)
		})
	}
}

func TestAssetService_CreateAsset_RepositoryError(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockAssetRepo := new(MockAssetRepository)

	input := CreateAssetInput{
		Name:      "Apple Inc",
		AssetType: "Stock",
		Value:     150.0,
	}

	mockUoW.On("Asset").Return(mockAssetRepo)
	mockAssetRepo.On("Create", mock.Anything, mock.Anything).Return((*model.Asset)(nil), errors.New("database error"))

	service := NewAssetService(mockUoW)

	_, err := service.CreateAsset(context.Background(), input)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to create asset")
	mockUoW.AssertExpectations(t)
	mockAssetRepo.AssertExpectations(t)
}

func TestAssetService_UpdateAsset_Success(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockAssetRepo := new(MockAssetRepository)

	existingAsset := model.Asset{
		ID:           1,
		Name:         "Apple Inc",
		AssetTypeID:  1,
		CurrentValue: 150.0,
	}

	input := UpdateAssetInput{
		Name:      "Apple Inc Updated",
		AssetType: "Stock",
		Value:     160.0,
	}

	mockUoW.On("Asset").Return(mockAssetRepo)
	mockAssetRepo.On("GetByID", mock.Anything, uint(1)).Return(existingAsset, nil)
	mockAssetRepo.On("Update", mock.Anything, mock.MatchedBy(func(asset *model.Asset) bool {
		return asset.ID == 1 && asset.Name == input.Name && asset.CurrentValue == input.Value
	})).Return(nil)

	service := NewAssetService(mockUoW)

	updatedAsset, err := service.UpdateAsset(context.Background(), 1, input)

	require.NoError(t, err)
	assert.Equal(t, 1, updatedAsset.ID)
	assert.Equal(t, input.Name, updatedAsset.Name)
	assert.Equal(t, input.Value, updatedAsset.CurrentValue)
	mockUoW.AssertExpectations(t)
	mockAssetRepo.AssertExpectations(t)
}

func TestAssetService_UpdateAsset_AssetNotFound(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockAssetRepo := new(MockAssetRepository)

	input := UpdateAssetInput{
		Name:      "Apple Inc Updated",
		AssetType: "Stock",
		Value:     160.0,
	}

	mockUoW.On("Asset").Return(mockAssetRepo)
	mockAssetRepo.On("GetByID", mock.Anything, uint(999)).Return(model.Asset{}, repository.ErrNotFound)

	service := NewAssetService(mockUoW)

	_, err := service.UpdateAsset(context.Background(), 999, input)

	assert.ErrorIs(t, err, repository.ErrNotFound)
	mockUoW.AssertExpectations(t)
	mockAssetRepo.AssertExpectations(t)
}

func TestAssetService_DeleteAsset_Success(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockAssetRepo := new(MockAssetRepository)

	mockUoW.On("Asset").Return(mockAssetRepo)
	mockAssetRepo.On("Delete", mock.Anything, uint(1)).Return(nil)

	service := NewAssetService(mockUoW)

	err := service.DeleteAsset(context.Background(), 1)

	require.NoError(t, err)
	mockUoW.AssertExpectations(t)
	mockAssetRepo.AssertExpectations(t)
}

func TestAssetService_DeleteAsset_NotFound(t *testing.T) {
	mockUoW := new(MockUnitOfWork)
	mockAssetRepo := new(MockAssetRepository)

	mockUoW.On("Asset").Return(mockAssetRepo)
	mockAssetRepo.On("Delete", mock.Anything, uint(999)).Return(repository.ErrNotFound)

	service := NewAssetService(mockUoW)

	err := service.DeleteAsset(context.Background(), 999)

	assert.ErrorIs(t, err, repository.ErrNotFound)
	mockUoW.AssertExpectations(t)
	mockAssetRepo.AssertExpectations(t)
}
