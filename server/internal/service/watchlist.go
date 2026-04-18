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
	GetByID(ctx context.Context, id string) (*model.Watchlist, error)
	FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Watchlist, error)
	FindByUserID(ctx context.Context, userID string) ([]model.Watchlist, error)
	FindByUserIDWithAssets(ctx context.Context, userID string) ([]model.Watchlist, error)
	FindWithAssets(ctx context.Context, watchlistID string) (*model.Watchlist, error)
	CreateWatchlist(ctx context.Context, input CreateWatchlistInput) (*model.Watchlist, error)
	UpdateWatchlist(ctx context.Context, id string, input UpdateWatchlistInput) (*model.Watchlist, error)
	DeleteWatchlist(ctx context.Context, id string) error
	AddAssetToWatchlist(ctx context.Context, watchlistID, assetID string) error
	RemoveAssetFromWatchlist(ctx context.Context, watchlistID, assetID string) error
	GetWatchlistAssets(ctx context.Context, watchlistID string) ([]model.Asset, error)
	IsAssetInWatchlist(ctx context.Context, watchlistID, assetID string) (bool, error)
	ValidateUserOwnership(ctx context.Context, userID string, watchlistID string) error
	GetByUserID(ctx context.Context, userID string) ([]model.Watchlist, error)
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
	UserID string
	Name   string
}

type UpdateWatchlistInput struct {
	Name string
}

// GetByID retrieves a single watchlist by its ID
func (s *WatchlistService) GetByID(ctx context.Context, id string) (*model.Watchlist, error) {
	return s.uow.Watchlist().GetByID(ctx, id)
}

// FindAll retrieves all watchlists with optional query options
func (s *WatchlistService) FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Watchlist, error) {
	return s.uow.Watchlist().FindAllBy(ctx, opts...)
}

// FindByUserID retrieves all watchlists for a specific user
func (s *WatchlistService) FindByUserID(ctx context.Context, userID string) ([]model.Watchlist, error) {
	return s.uow.Watchlist().FindByUserID(ctx, userID)
}

// FindByUserIDWithAssets retrieves watchlists for a user with their associated assets
func (s *WatchlistService) FindByUserIDWithAssets(ctx context.Context, userID string) ([]model.Watchlist, error) {
	return s.uow.Watchlist().FindByUserIDWithAssets(ctx, userID)
}

// FindWithAssets retrieves a watchlist with its associated assets
func (s *WatchlistService) FindWithAssets(ctx context.Context, watchlistID string) (*model.Watchlist, error) {
	return s.uow.Watchlist().FindWithAssets(ctx, watchlistID)
}

// CreateWatchlist creates a new watchlist with validation
func (s *WatchlistService) CreateWatchlist(ctx context.Context, input CreateWatchlistInput) (*model.Watchlist, error) {
	// Validate input
	if err := s.validateCreateWatchlistInput(input); err != nil {
		return nil, err
	}

	// Verify user exists - skip for now as we need to implement GetByID with string
	// TODO: Implement user verification with string ID
	// if _, err := s.uow.User().GetByID(ctx, input.UserID); err != nil {
	// 	if errors.Is(err, repository.ErrNotFound) {
	// 		return nil, fmt.Errorf("user with ID %s not found", input.UserID)
	// 	}
	// 	return nil, fmt.Errorf("failed to verify user: %w", err)
	// }

	// Check for duplicate watchlist name for the user
	existingWatchlists, err := s.uow.Watchlist().FindByUserID(ctx, input.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing watchlists: %w", err)
	}

	for _, watchlist := range existingWatchlists {
		if watchlist.Name == input.Name {
			return nil, fmt.Errorf("watchlist with name '%s' already exists for this user", input.Name)
		}
	}

	// Create watchlist
	newWatchlist := model.Watchlist{
		UserID: input.UserID,
		Name:   input.Name,
	}

	createdWatchlist, err := s.uow.Watchlist().Create(ctx, &newWatchlist)
	if err != nil {
		return nil, fmt.Errorf("failed to create watchlist: %w", err)
	}

	return createdWatchlist, nil
}

// UpdateWatchlist updates an existing watchlist
func (s *WatchlistService) UpdateWatchlist(ctx context.Context, id string, input UpdateWatchlistInput) (*model.Watchlist, error) {
	// Validate input
	if err := s.validateUpdateWatchlistInput(input); err != nil {
		return nil, err
	}

	// Get existing watchlist
	watchlistToUpdate, err := s.uow.Watchlist().GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Check for duplicate name for the same user (excluding current watchlist)
	existingWatchlists, err := s.uow.Watchlist().FindByUserID(ctx, watchlistToUpdate.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing watchlists: %w", err)
	}

	for _, watchlist := range existingWatchlists {
		if watchlist.Name == input.Name && watchlist.ID != watchlistToUpdate.ID {
			return nil, fmt.Errorf("watchlist with name '%s' already exists for this user", input.Name)
		}
	}

	// Apply updates
	watchlistToUpdate.Name = input.Name

	// Save changes
	err = s.uow.Watchlist().Update(ctx, watchlistToUpdate)
	if err != nil {
		return nil, fmt.Errorf("failed to update watchlist: %w", err)
	}

	return watchlistToUpdate, nil
}

// DeleteWatchlist removes a watchlist and all its asset associations
func (s *WatchlistService) DeleteWatchlist(ctx context.Context, id string) error {
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
			err = uow.Watchlist().RemoveAssetFromWatchlist(ctx, watchlist.ID, wa.AssetID)
			if err != nil {
				return fmt.Errorf("failed to remove asset %s from watchlist: %w", wa.AssetID, err)
			}
		}

		// Delete the watchlist
		return uow.Watchlist().Delete(ctx, id)
	})
}

// AddAssetToWatchlist adds an asset to a watchlist with validation
func (s *WatchlistService) AddAssetToWatchlist(ctx context.Context, watchlistID, assetID string) error {
	// Validate inputs
	if watchlistID == "" {
		return errors.New("watchlist ID must not be empty")
	}
	if assetID == "" {
		return errors.New("asset ID must not be empty")
	}

	// Use Unit of Work to ensure atomicity
	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Verify watchlist exists
		if _, err := uow.Watchlist().GetByID(ctx, watchlistID); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("watchlist with ID %s not found", watchlistID)
			}
			return fmt.Errorf("failed to verify watchlist: %w", err)
		}

		// Verify asset exists
		if _, err := uow.Asset().GetByID(ctx, assetID); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("asset with ID %s not found", assetID)
			}
			return fmt.Errorf("failed to verify asset: %w", err)
		}

		// Add asset to watchlist
		return uow.Watchlist().AddAssetToWatchlist(ctx, watchlistID, assetID)
	})
}

// RemoveAssetFromWatchlist removes an asset from a watchlist with validation
func (s *WatchlistService) RemoveAssetFromWatchlist(ctx context.Context, watchlistID, assetID string) error {
	// Validate inputs
	if watchlistID == "" {
		return errors.New("watchlist ID must not be empty")
	}
	if assetID == "" {
		return errors.New("asset ID must not be empty")
	}

	// Use Unit of Work to ensure atomicity
	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Verify watchlist exists
		if _, err := uow.Watchlist().GetByID(ctx, watchlistID); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("watchlist with ID %s not found", watchlistID)
			}
			return fmt.Errorf("failed to verify watchlist: %w", err)
		}

		// Verify asset exists
		if _, err := uow.Asset().GetByID(ctx, assetID); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("asset with ID %s not found", assetID)
			}
			return fmt.Errorf("failed to verify asset: %w", err)
		}

		// Check if asset is in watchlist
		isInWatchlist, err := uow.Watchlist().IsAssetInWatchlist(ctx, watchlistID, assetID)
		if err != nil {
			return fmt.Errorf("failed to check if asset is in watchlist: %w", err)
		}
		if !isInWatchlist {
			return fmt.Errorf("asset %s is not in watchlist %s", assetID, watchlistID)
		}

		// Remove asset from watchlist
		return uow.Watchlist().RemoveAssetFromWatchlist(ctx, watchlistID, assetID)
	})
}

// GetWatchlistAssets retrieves all assets in a watchlist
func (s *WatchlistService) GetWatchlistAssets(ctx context.Context, watchlistID string) ([]model.Asset, error) {
	// Validate input
	if watchlistID == "" {
		return nil, errors.New("watchlist ID must not be empty")
	}

	// Verify watchlist exists
	if _, err := s.uow.Watchlist().GetByID(ctx, watchlistID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, fmt.Errorf("watchlist with ID %s not found", watchlistID)
		}
		return nil, fmt.Errorf("failed to verify watchlist: %w", err)
	}

	return s.uow.Watchlist().GetWatchlistAssets(ctx, watchlistID)
}

// IsAssetInWatchlist checks if an asset is in a watchlist
func (s *WatchlistService) IsAssetInWatchlist(ctx context.Context, watchlistID, assetID string) (bool, error) {
	// Validate inputs
	if watchlistID == "" {
		return false, errors.New("watchlist ID must not be empty")
	}
	if assetID == "" {
		return false, errors.New("asset ID must not be empty")
	}

	return s.uow.Watchlist().IsAssetInWatchlist(ctx, watchlistID, assetID)
}

// ValidateUserOwnership validates that a user owns a specific watchlist
func (s *WatchlistService) ValidateUserOwnership(ctx context.Context, userID string, watchlistID string) error {
	// Validate inputs
	if userID == "" {
		return errors.New("user ID cannot be empty")
	}
	if watchlistID == "" {
		return errors.New("watchlist ID must not be empty")
	}

	// Get watchlist
	watchlist, err := s.uow.Watchlist().GetByID(ctx, watchlistID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("watchlist with ID %s not found", watchlistID)
		}
		return fmt.Errorf("failed to get watchlist: %w", err)
	}

	// Check ownership
	if watchlist.UserID != userID {
		return fmt.Errorf("user %s does not own watchlist %s", userID, watchlistID)
	}

	return nil
}

// Helper methods for validation

func (s *WatchlistService) validateCreateWatchlistInput(input CreateWatchlistInput) error {
	if input.UserID == "" {
		return errors.New("user ID cannot be empty")
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

func (s *WatchlistService) GetByUserID(ctx context.Context, userID string) ([]model.Watchlist, error) {
	return s.uow.Watchlist().FindByUserID(ctx, userID)
}
