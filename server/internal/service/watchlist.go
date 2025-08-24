package service

import (
	"context"
	"errors"
	"fmt"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
)

// IWatchlistService defines the interface for watchlist management operations
type IWatchlistService interface {
	GetByID(ctx context.Context, id uint) (model.Watchlist, error)
	FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Watchlist, error)
	FindByUserID(ctx context.Context, userID int) ([]model.Watchlist, error)
	FindByUserIDWithAssets(ctx context.Context, userID int) ([]model.Watchlist, error)
	FindWithAssets(ctx context.Context, watchlistID int) (model.Watchlist, error)
	CreateWatchlist(ctx context.Context, input CreateWatchlistInput) (model.Watchlist, error)
	UpdateWatchlist(ctx context.Context, id uint, input UpdateWatchlistInput) (model.Watchlist, error)
	DeleteWatchlist(ctx context.Context, id uint) error
	AddAssetToWatchlist(ctx context.Context, watchlistID, assetID int) error
	RemoveAssetFromWatchlist(ctx context.Context, watchlistID, assetID int) error
	GetWatchlistAssets(ctx context.Context, watchlistID int) ([]model.Asset, error)
	IsAssetInWatchlist(ctx context.Context, watchlistID, assetID int) (bool, error)
	ValidateUserOwnership(ctx context.Context, userID int, watchlistID int) error
	GetByUserID(ctx context.Context, userID int) ([]model.Watchlist, error)
}

// WatchlistService is the concrete implementation of IWatchlistService
type WatchlistService struct {
	uow repository.IUnitOfWork
}

// NewWatchlistService creates a new watchlist service instance
func NewWatchlistService(uow repository.IUnitOfWork) *WatchlistService {
	return &WatchlistService{uow: uow}
}

// Input structs for watchlist operations
type CreateWatchlistInput struct {
	UserID int
	Name   string
}

type UpdateWatchlistInput struct {
	Name string
}

// GetByID retrieves a single watchlist by its ID
func (s *WatchlistService) GetByID(ctx context.Context, id uint) (model.Watchlist, error) {
	return s.uow.Watchlist().GetByID(ctx, id)
}

// FindAll retrieves all watchlists with optional query options
func (s *WatchlistService) FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Watchlist, error) {
	return s.uow.Watchlist().FindAllBy(ctx, opts...)
}

// FindByUserID retrieves all watchlists for a specific user
func (s *WatchlistService) FindByUserID(ctx context.Context, userID int) ([]model.Watchlist, error) {
	return s.uow.Watchlist().FindByUserID(ctx, userID)
}

// FindByUserIDWithAssets retrieves watchlists for a user with their associated assets
func (s *WatchlistService) FindByUserIDWithAssets(ctx context.Context, userID int) ([]model.Watchlist, error) {
	return s.uow.Watchlist().FindByUserIDWithAssets(ctx, userID)
}

// FindWithAssets retrieves a watchlist with its associated assets
func (s *WatchlistService) FindWithAssets(ctx context.Context, watchlistID int) (model.Watchlist, error) {
	return s.uow.Watchlist().FindWithAssets(ctx, watchlistID)
}

// CreateWatchlist creates a new watchlist with validation
func (s *WatchlistService) CreateWatchlist(ctx context.Context, input CreateWatchlistInput) (model.Watchlist, error) {
	// Validate input
	if err := s.validateCreateWatchlistInput(input); err != nil {
		return model.Watchlist{}, err
	}

	// Verify user exists
	if _, err := s.uow.User().GetByID(ctx, uint(input.UserID)); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return model.Watchlist{}, fmt.Errorf("user with ID %d not found", input.UserID)
		}
		return model.Watchlist{}, fmt.Errorf("failed to verify user: %w", err)
	}

	// Check for duplicate watchlist name for the user
	existingWatchlists, err := s.uow.Watchlist().FindByUserID(ctx, input.UserID)
	if err != nil {
		return model.Watchlist{}, fmt.Errorf("failed to check existing watchlists: %w", err)
	}

	for _, watchlist := range existingWatchlists {
		if watchlist.Name == input.Name {
			return model.Watchlist{}, fmt.Errorf("watchlist with name '%s' already exists for this user", input.Name)
		}
	}

	// Create watchlist
	newWatchlist := model.Watchlist{
		UserID: input.UserID,
		Name:   input.Name,
	}

	createdWatchlist, err := s.uow.Watchlist().Create(ctx, &newWatchlist)
	if err != nil {
		return model.Watchlist{}, fmt.Errorf("failed to create watchlist: %w", err)
	}

	return *createdWatchlist, nil
}

// UpdateWatchlist updates an existing watchlist
func (s *WatchlistService) UpdateWatchlist(ctx context.Context, id uint, input UpdateWatchlistInput) (model.Watchlist, error) {
	// Validate input
	if err := s.validateUpdateWatchlistInput(input); err != nil {
		return model.Watchlist{}, err
	}

	// Get existing watchlist
	watchlistToUpdate, err := s.uow.Watchlist().GetByID(ctx, id)
	if err != nil {
		return model.Watchlist{}, err
	}

	// Check for duplicate name for the same user (excluding current watchlist)
	existingWatchlists, err := s.uow.Watchlist().FindByUserID(ctx, watchlistToUpdate.UserID)
	if err != nil {
		return model.Watchlist{}, fmt.Errorf("failed to check existing watchlists: %w", err)
	}

	for _, watchlist := range existingWatchlists {
		if watchlist.Name == input.Name && watchlist.ID != watchlistToUpdate.ID {
			return model.Watchlist{}, fmt.Errorf("watchlist with name '%s' already exists for this user", input.Name)
		}
	}

	// Apply updates
	watchlistToUpdate.Name = input.Name

	// Save changes
	err = s.uow.Watchlist().Update(ctx, &watchlistToUpdate)
	if err != nil {
		return model.Watchlist{}, fmt.Errorf("failed to update watchlist: %w", err)
	}

	return watchlistToUpdate, nil
}

// DeleteWatchlist removes a watchlist and all its asset associations
func (s *WatchlistService) DeleteWatchlist(ctx context.Context, id uint) error {
	// Use Unit of Work to ensure atomicity
	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Verify watchlist exists
		watchlist, err := uow.Watchlist().GetByID(ctx, id)
		if err != nil {
			return err
		}

		// Get all assets in the watchlist
		watchlistAssets, err := uow.WatchlistAsset().FindAllBy(ctx, repository.ByColumn("watchlist_id", watchlist.ID))
		if err != nil {
			return fmt.Errorf("failed to get watchlist assets: %w", err)
		}

		// Remove all asset associations
		for _, wa := range watchlistAssets {
			err = uow.Watchlist().RemoveAssetFromWatchlist(ctx, int(watchlist.ID), int(wa.AssetID))
			if err != nil {
				return fmt.Errorf("failed to remove asset %d from watchlist: %w", wa.AssetID, err)
			}
		}

		// Delete the watchlist
		return uow.Watchlist().Delete(ctx, id)
	})
}

// AddAssetToWatchlist adds an asset to a watchlist with validation
func (s *WatchlistService) AddAssetToWatchlist(ctx context.Context, watchlistID, assetID int) error {
	// Validate inputs
	if watchlistID <= 0 {
		return errors.New("watchlist ID must be positive")
	}
	if assetID <= 0 {
		return errors.New("asset ID must be positive")
	}

	// Use Unit of Work to ensure atomicity
	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Verify watchlist exists
		if _, err := uow.Watchlist().GetByID(ctx, uint(watchlistID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("watchlist with ID %d not found", watchlistID)
			}
			return fmt.Errorf("failed to verify watchlist: %w", err)
		}

		// Verify asset exists
		if _, err := uow.Asset().GetByID(ctx, uint(assetID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("asset with ID %d not found", assetID)
			}
			return fmt.Errorf("failed to verify asset: %w", err)
		}

		// Add asset to watchlist
		return uow.Watchlist().AddAssetToWatchlist(ctx, watchlistID, assetID)
	})
}

// RemoveAssetFromWatchlist removes an asset from a watchlist with validation
func (s *WatchlistService) RemoveAssetFromWatchlist(ctx context.Context, watchlistID, assetID int) error {
	// Validate inputs
	if watchlistID <= 0 {
		return errors.New("watchlist ID must be positive")
	}
	if assetID <= 0 {
		return errors.New("asset ID must be positive")
	}

	// Use Unit of Work to ensure atomicity
	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Verify watchlist exists
		if _, err := uow.Watchlist().GetByID(ctx, uint(watchlistID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("watchlist with ID %d not found", watchlistID)
			}
			return fmt.Errorf("failed to verify watchlist: %w", err)
		}

		// Verify asset exists
		if _, err := uow.Asset().GetByID(ctx, uint(assetID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("asset with ID %d not found", assetID)
			}
			return fmt.Errorf("failed to verify asset: %w", err)
		}

		// Check if asset is in watchlist
		isInWatchlist, err := uow.Watchlist().IsAssetInWatchlist(ctx, watchlistID, assetID)
		if err != nil {
			return fmt.Errorf("failed to check if asset is in watchlist: %w", err)
		}
		if !isInWatchlist {
			return fmt.Errorf("asset %d is not in watchlist %d", assetID, watchlistID)
		}

		// Remove asset from watchlist
		return uow.Watchlist().RemoveAssetFromWatchlist(ctx, watchlistID, assetID)
	})
}

// GetWatchlistAssets retrieves all assets in a watchlist
func (s *WatchlistService) GetWatchlistAssets(ctx context.Context, watchlistID int) ([]model.Asset, error) {
	// Validate input
	if watchlistID <= 0 {
		return nil, errors.New("watchlist ID must be positive")
	}

	// Verify watchlist exists
	if _, err := s.uow.Watchlist().GetByID(ctx, uint(watchlistID)); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, fmt.Errorf("watchlist with ID %d not found", watchlistID)
		}
		return nil, fmt.Errorf("failed to verify watchlist: %w", err)
	}

	return s.uow.Watchlist().GetWatchlistAssets(ctx, watchlistID)
}

// IsAssetInWatchlist checks if an asset is in a watchlist
func (s *WatchlistService) IsAssetInWatchlist(ctx context.Context, watchlistID, assetID int) (bool, error) {
	// Validate inputs
	if watchlistID <= 0 {
		return false, errors.New("watchlist ID must be positive")
	}
	if assetID <= 0 {
		return false, errors.New("asset ID must be positive")
	}

	return s.uow.Watchlist().IsAssetInWatchlist(ctx, watchlistID, assetID)
}

// ValidateUserOwnership validates that a user owns a specific watchlist
func (s *WatchlistService) ValidateUserOwnership(ctx context.Context, userID int, watchlistID int) error {
	// Validate inputs
	if userID <= 0 {
		return errors.New("user ID must be positive")
	}
	if watchlistID <= 0 {
		return errors.New("watchlist ID must be positive")
	}

	// Get watchlist
	watchlist, err := s.uow.Watchlist().GetByID(ctx, uint(watchlistID))
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("watchlist with ID %d not found", watchlistID)
		}
		return fmt.Errorf("failed to get watchlist: %w", err)
	}

	// Check ownership
	if watchlist.UserID != userID {
		return fmt.Errorf("user %d does not own watchlist %d", userID, watchlistID)
	}

	return nil
}

// Helper methods for validation

func (s *WatchlistService) validateCreateWatchlistInput(input CreateWatchlistInput) error {
	if input.UserID <= 0 {
		return errors.New("user ID must be positive")
	}
	if len(input.Name) < 1 {
		return errors.New("watchlist name is required")
	}
	if len(input.Name) > 100 {
		return errors.New("watchlist name must be 100 characters or less")
	}
	return nil
}

func (s *WatchlistService) validateUpdateWatchlistInput(input UpdateWatchlistInput) error {
	if input.Name == "" {
		return errors.New("watchlist name is required")
	}
	return nil
}

func (s *WatchlistService) GetByUserID(ctx context.Context, userID int) ([]model.Watchlist, error) {
	return s.uow.Watchlist().FindByUserID(ctx, userID)
}
