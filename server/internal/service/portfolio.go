package service

import (
	"context"
	"errors"
	"fmt"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
)

type IPortfolioService interface {
	GetByID(ctx context.Context, id uint) (model.Portfolio, error)
	FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Portfolio, error)
	CreatePortfolio(ctx context.Context, input CreatePortfolioInput) (model.Portfolio, error)
	UpdatePortfolio(ctx context.Context, id uint, input UpdatePortfolioInput) (model.Portfolio, error)
	DeletePortfolio(ctx context.Context, id uint) error
	AddAssetToPortfolio(ctx context.Context, portfolioID, assetID uint, quantity float64, price float64) (model.PortfolioAsset, error)
	UpdateAssetInPortfolio(ctx context.Context, portfolioID, assetID uint, quantity float64, price float64) (model.PortfolioAsset, error)
	RemoveAssetFromPortfolio(ctx context.Context, portfolioID, assetID uint) error
	TagPortfolio(ctx context.Context, portfolioID, tagID uint) error
	UntagPortfolio(ctx context.Context, portfolioID, tagID uint) error
	GetPortfolioAssets(ctx context.Context, portfolioID uint) ([]model.PortfolioAsset, error)
}

// PortfolioService is the concrete implementation of IPortfolioService.
type PortfolioService struct {
	uow repository.IUnitOfWork
}

// NewPortfolioService is the constructor for PortfolioService.
// It takes the Unit of Work as its dependency, from which it can access all repositories.
func NewPortfolioService(uow repository.IUnitOfWork) *PortfolioService {
	return &PortfolioService{
		uow: uow,
	}
}

// --- Input Structs for Service Methods (keeps method signatures clean) ---

type CreatePortfolioInput struct {
	UserID uint
	Name   string
}

type UpdatePortfolioInput struct {
	Name *string
}

// --- Method Implementations ---

// GetByID retrieves a single portfolio by its primary key.
// This is a simple pass-through to the repository.
func (s *PortfolioService) GetByID(ctx context.Context, id uint) (model.Portfolio, error) {
	return s.uow.Portfolio().GetByID(ctx, id)
}

// FindAll retrieves a list of portfolios based on a dynamic set of query options.
// This method also passes the options directly to the repository layer.
func (s *PortfolioService) FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Portfolio, error) {
	return s.uow.Portfolio().FindAllBy(ctx, opts...)
}

// CreatePortfolio handles the business logic for creating a new portfolio.
func (s *PortfolioService) CreatePortfolio(ctx context.Context, input CreatePortfolioInput) (model.Portfolio, error) {
	// 1. --- Business Rule Validation ---
	if len(input.Name) < 3 {
		return model.Portfolio{}, errors.New("portfolio name must be at least 3 characters long")
	}
	if input.UserID == 0 {
		return model.Portfolio{}, errors.New("a valid user ID is required to create a portfolio")
	}

	// Check if the user exists before creating the portfolio.
	_, err := s.uow.User().GetByID(ctx, input.UserID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return model.Portfolio{}, fmt.Errorf("user with ID %d not found", input.UserID)
		}
		return model.Portfolio{}, fmt.Errorf("failed to verify user: %w", err)
	}

	// 2. --- Data Mapping ---
	newPortfolio := model.Portfolio{
		UserID: int(input.UserID),
		Name:   input.Name,
	}

	// 3. --- Persistence ---
	// The Create method returns the full entity, including the new ID and timestamps.
	createdPortfolio, err := s.uow.Portfolio().Create(ctx, &newPortfolio)
	if err != nil {
		return model.Portfolio{}, fmt.Errorf("failed to create portfolio in repository: %w", err)
	}

	return *createdPortfolio, nil
}

// UpdatePortfolio handles the logic for updating an existing portfolio's details.
func (s *PortfolioService) UpdatePortfolio(ctx context.Context, id uint, input UpdatePortfolioInput) (model.Portfolio, error) {
	// 1. --- Retrieve Existing Entity ---
	portfolioToUpdate, err := s.uow.Portfolio().GetByID(ctx, id)
	if err != nil {
		// The error from the repo (e.g., ErrNotFound) is returned directly.
		return model.Portfolio{}, err
	}

	// 2. --- Apply Changes ---
	if input.Name != nil {
		// Validation
		if len(*input.Name) < 3 {
			return model.Portfolio{}, errors.New("portfolio name must be at least 3 characters long")
		}
		portfolioToUpdate.Name = *input.Name
	}
	// Note: The UpdatedAt field is typically handled automatically by the database or ORM hook.

	// 3. --- Persistence ---
	err = s.uow.Portfolio().Update(ctx, &portfolioToUpdate)
	if err != nil {
		return model.Portfolio{}, fmt.Errorf("failed to update portfolio: %w", err)
	}

	return portfolioToUpdate, nil
}

// DeletePortfolio handles the removal of a portfolio.
func (s *PortfolioService) DeletePortfolio(ctx context.Context, id uint) error {
	// Here you might add business logic, e.g., "cannot delete a portfolio with active assets".
	// For now, it's a direct pass-through.
	err := s.uow.Portfolio().Delete(ctx, id)
	if err != nil {
		// The repo will return ErrNotFound if the ID doesn't exist.
		return err
	}
	return nil
}

// AddAssetToPortfolio handles adding an asset to a portfolio, creating the join table record.
func (s *PortfolioService) AddAssetToPortfolio(ctx context.Context, portfolioID, assetID uint, quantity float64, price float64) (model.PortfolioAsset, error) {
	// 1. --- Validation ---
	if quantity <= 0 {
		return model.PortfolioAsset{}, errors.New("quantity must be positive")
	}

	// 2. --- Check Existence of Portfolio and Asset ---
	if _, err := s.uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
		return model.PortfolioAsset{}, fmt.Errorf("portfolio with ID %d not found", portfolioID)
	}
	if _, err := s.uow.Asset().GetByID(ctx, assetID); err != nil {
		return model.PortfolioAsset{}, fmt.Errorf("asset with ID %d not found", assetID)
	}

	// 3. --- Check if asset already exists in portfolio ---
	_, err := s.uow.PortfolioAsset().FindByPortfolioAndAsset(ctx, int(portfolioID), int(assetID))
	if err == nil {
		return model.PortfolioAsset{}, errors.New("asset already exists in portfolio")
	}
	if !errors.Is(err, repository.ErrNotFound) {
		return model.PortfolioAsset{}, fmt.Errorf("failed to check existing portfolio asset: %w", err)
	}

	// 4. --- Create and Persist Join Table Record ---
	portfolioAsset := model.PortfolioAsset{
		PortfolioID:          int(portfolioID),
		AssetID:              int(assetID),
		Quantity:             quantity,
		AveragePurchasePrice: price,
	}

	createdPortfolioAsset, err := s.uow.PortfolioAsset().Create(ctx, &portfolioAsset)
	if err != nil {
		return model.PortfolioAsset{}, fmt.Errorf("failed to add asset to portfolio: %w", err)
	}

	return *createdPortfolioAsset, nil
}

// UpdateAssetInPortfolio handles updating an asset's quantity and price in a portfolio.
func (s *PortfolioService) UpdateAssetInPortfolio(ctx context.Context, portfolioID, assetID uint, quantity float64, price float64) (model.PortfolioAsset, error) {
	// 1. --- Validation ---
	if quantity <= 0 {
		return model.PortfolioAsset{}, errors.New("quantity must be positive")
	}

	// 2. --- Check Existence of Portfolio and Asset ---
	if _, err := s.uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
		return model.PortfolioAsset{}, fmt.Errorf("portfolio with ID %d not found", portfolioID)
	}
	if _, err := s.uow.Asset().GetByID(ctx, assetID); err != nil {
		return model.PortfolioAsset{}, fmt.Errorf("asset with ID %d not found", assetID)
	}

	// 3. --- Update Portfolio Asset ---
	err := s.uow.PortfolioAsset().UpdatePortfolioAsset(ctx, int(portfolioID), int(assetID), quantity, price)
	if err != nil {
		return model.PortfolioAsset{}, fmt.Errorf("failed to update asset in portfolio: %w", err)
	}

	// 4. --- Return Updated Portfolio Asset ---
	updatedPortfolioAsset, err := s.uow.PortfolioAsset().FindByPortfolioAndAsset(ctx, int(portfolioID), int(assetID))
	if err != nil {
		return model.PortfolioAsset{}, fmt.Errorf("failed to retrieve updated portfolio asset: %w", err)
	}

	return updatedPortfolioAsset, nil
}

// RemoveAssetFromPortfolio handles removing an asset from a portfolio.
func (s *PortfolioService) RemoveAssetFromPortfolio(ctx context.Context, portfolioID, assetID uint) error {
	// 1. --- Check Existence of Portfolio and Asset ---
	if _, err := s.uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
		return fmt.Errorf("portfolio with ID %d not found", portfolioID)
	}
	if _, err := s.uow.Asset().GetByID(ctx, assetID); err != nil {
		return fmt.Errorf("asset with ID %d not found", assetID)
	}

	// 2. --- Remove Portfolio Asset ---
	err := s.uow.PortfolioAsset().DeleteByPortfolioAndAsset(ctx, int(portfolioID), int(assetID))
	if err != nil {
		return fmt.Errorf("failed to remove asset from portfolio: %w", err)
	}

	return nil
}

// TagPortfolio handles adding a tag to a portfolio.
func (s *PortfolioService) TagPortfolio(ctx context.Context, portfolioID, tagID uint) error {
	// 1. --- Check Existence of Portfolio and Tag ---
	if _, err := s.uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
		return fmt.Errorf("portfolio with ID %d not found", portfolioID)
	}
	if _, err := s.uow.Tag().GetByID(ctx, tagID); err != nil {
		return fmt.Errorf("tag with ID %d not found", tagID)
	}

	// 2. --- Check if tag already exists on portfolio ---
	existingTags, err := s.uow.PortfolioTag().FindAllBy(ctx,
		repository.ByColumn("portfolio_id", portfolioID),
		repository.ByColumn("tag_id", tagID),
	)
	if err != nil {
		return fmt.Errorf("failed to check existing portfolio tag: %w", err)
	}
	if len(existingTags) > 0 {
		return errors.New("tag already exists on portfolio")
	}

	// 3. --- Create Portfolio Tag ---
	portfolioTag := model.PortfolioTag{
		PortfolioID: int(portfolioID),
		TagID:       int(tagID),
	}

	_, err = s.uow.PortfolioTag().Create(ctx, &portfolioTag)
	if err != nil {
		return fmt.Errorf("failed to tag portfolio: %w", err)
	}

	return nil
}

// UntagPortfolio handles removing a tag from a portfolio.
func (s *PortfolioService) UntagPortfolio(ctx context.Context, portfolioID, tagID uint) error {
	// 1. --- Check Existence of Portfolio and Tag ---
	if _, err := s.uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
		return fmt.Errorf("portfolio with ID %d not found", portfolioID)
	}
	if _, err := s.uow.Tag().GetByID(ctx, tagID); err != nil {
		return fmt.Errorf("tag with ID %d not found", tagID)
	}

	// 2. --- Find and Delete Portfolio Tag ---
	portfolioTags, err := s.uow.PortfolioTag().FindAllBy(ctx,
		repository.ByColumn("portfolio_id", portfolioID),
		repository.ByColumn("tag_id", tagID),
	)
	if err != nil {
		return fmt.Errorf("failed to find portfolio tag: %w", err)
	}
	if len(portfolioTags) == 0 {
		return errors.New("tag not found on portfolio")
	}

	// For junction tables, we need to delete by the composite key
	_, err = s.uow.PortfolioTag().GetDB().NewDelete().
		Model((*model.PortfolioTag)(nil)).
		Where("portfolio_id = ? AND tag_id = ?", portfolioTags[0].PortfolioID, portfolioTags[0].TagID).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to untag portfolio: %w", err)
	}

	return nil
}

// GetPortfolioAssets retrieves all assets in a portfolio with their details.
func (s *PortfolioService) GetPortfolioAssets(ctx context.Context, portfolioID uint) ([]model.PortfolioAsset, error) {
	// 1. --- Check Existence of Portfolio ---
	if _, err := s.uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
		return nil, fmt.Errorf("portfolio with ID %d not found", portfolioID)
	}

	// 2. --- Get Portfolio Assets ---
	portfolioAssets, err := s.uow.PortfolioAsset().FindByPortfolioID(ctx, int(portfolioID))
	if err != nil {
		return nil, fmt.Errorf("failed to get portfolio assets: %w", err)
	}

	return portfolioAssets, nil
}
