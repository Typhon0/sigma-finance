package service

import (
	"context"
	"errors"
	"fmt"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"strings"
)

// ITagService defines the interface for tag management operations
type ITagService interface {
	GetByID(ctx context.Context, id uint) (model.Tag, error)
	FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Tag, error)
	FindByName(ctx context.Context, name string) (model.Tag, error)
	CreateTag(ctx context.Context, input CreateTagInput) (model.Tag, error)
	UpdateTag(ctx context.Context, id uint, input UpdateTagInput) (model.Tag, error)
	DeleteTag(ctx context.Context, id uint) error
	TagAsset(ctx context.Context, assetID, tagID int) error
	UntagAsset(ctx context.Context, assetID, tagID int) error
	TagPortfolio(ctx context.Context, portfolioID, tagID int) error
	UntagPortfolio(ctx context.Context, portfolioID, tagID int) error
	GetAssetTags(ctx context.Context, assetID int) ([]model.Tag, error)
	GetPortfolioTags(ctx context.Context, portfolioID int) ([]model.Tag, error)
	GetTaggedAssets(ctx context.Context, tagID int) ([]model.Asset, error)
	GetTaggedPortfolios(ctx context.Context, tagID int) ([]model.Portfolio, error)
	GetTagUsageStatistics(ctx context.Context, tagID int) (TagUsageStats, error)
	FindOrCreateTag(ctx context.Context, name string) (model.Tag, error)
	BulkTagAssets(ctx context.Context, assetIDs []int, tagID int) error
	BulkTagPortfolios(ctx context.Context, portfolioIDs []int, tagID int) error
}

// TagService is the concrete implementation of ITagService
type TagService struct {
	uow repository.IUnitOfWork
}

// NewTagService creates a new tag service instance
func NewTagService(uow repository.IUnitOfWork) *TagService {
	return &TagService{uow: uow}
}

// Input structs for tag operations
type CreateTagInput struct {
	Name string
}

type UpdateTagInput struct {
	Name string
}

// TagUsageStats represents usage statistics for a tag
type TagUsageStats struct {
	TagID           int
	TagName         string
	AssetCount      int
	PortfolioCount  int
	TotalUsageCount int
}

// GetByID retrieves a single tag by its ID
func (s *TagService) GetByID(ctx context.Context, id uint) (model.Tag, error) {
	return s.uow.Tag().GetByID(ctx, id)
}

// FindAll retrieves all tags with optional query options
func (s *TagService) FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Tag, error) {
	return s.uow.Tag().FindAllBy(ctx, opts...)
}

// FindByName retrieves a tag by its name
func (s *TagService) FindByName(ctx context.Context, name string) (model.Tag, error) {
	return s.uow.Tag().FindOneBy(ctx, repository.ByColumn("name", name))
}

// CreateTag creates a new tag with validation
func (s *TagService) CreateTag(ctx context.Context, input CreateTagInput) (model.Tag, error) {
	// Validate input
	if err := s.validateCreateTagInput(input); err != nil {
		return model.Tag{}, err
	}

	// Normalize tag name
	normalizedName := s.normalizeTagName(input.Name)

	// Check if tag already exists
	_, err := s.FindByName(ctx, normalizedName)
	if err == nil {
		return model.Tag{}, fmt.Errorf("tag with name '%s' already exists", normalizedName)
	}
	if !errors.Is(err, repository.ErrNotFound) {
		return model.Tag{}, fmt.Errorf("failed to check existing tag: %w", err)
	}

	// Create tag
	newTag := model.Tag{
		Name: normalizedName,
	}

	createdTag, err := s.uow.Tag().Create(ctx, &newTag)
	if err != nil {
		return model.Tag{}, fmt.Errorf("failed to create tag: %w", err)
	}

	return *createdTag, nil
}

// UpdateTag updates an existing tag
func (s *TagService) UpdateTag(ctx context.Context, id uint, input UpdateTagInput) (model.Tag, error) {
	// Validate input
	if err := s.validateUpdateTagInput(input); err != nil {
		return model.Tag{}, err
	}

	// Get existing tag
	tagToUpdate, err := s.uow.Tag().GetByID(ctx, id)
	if err != nil {
		return model.Tag{}, err
	}

	// Normalize tag name
	normalizedName := s.normalizeTagName(input.Name)

	// Check if another tag with the same name exists (excluding current tag)
	existingTag, err := s.FindByName(ctx, normalizedName)
	if err == nil && existingTag.ID != tagToUpdate.ID {
		return model.Tag{}, fmt.Errorf("tag with name '%s' already exists", normalizedName)
	}
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return model.Tag{}, fmt.Errorf("failed to check existing tag: %w", err)
	}

	// Apply updates
	tagToUpdate.Name = normalizedName

	// Save changes
	err = s.uow.Tag().Update(ctx, &tagToUpdate)
	if err != nil {
		return model.Tag{}, fmt.Errorf("failed to update tag: %w", err)
	}

	return tagToUpdate, nil
}

// DeleteTag removes a tag and all its associations
func (s *TagService) DeleteTag(ctx context.Context, id uint) error {
	// Use Unit of Work to ensure atomicity
	return s.uow.Do(ctx, func(repos *repository.TxRepositories) error {
		// Verify tag exists
		tag, err := repos.TagRepo.GetByID(ctx, id)
		if err != nil {
			return err
		}

		// Remove all asset tag associations
		assetTags, err := repos.AssetTagRepo.FindAllBy(ctx, repository.ByColumn("tag_id", tag.ID))
		if err != nil {
			return fmt.Errorf("failed to get asset tags: %w", err)
		}

		for _, at := range assetTags {
			// For junction tables, we need to delete by the composite key
			_, err = repos.AssetTagRepo.GetDB().NewDelete().
				Model((*model.AssetTag)(nil)).
				Where("asset_id = ? AND tag_id = ?", at.AssetID, at.TagID).
				Exec(ctx)
			if err != nil {
				return fmt.Errorf("failed to remove asset tag association: %w", err)
			}
		}

		// Remove all portfolio tag associations
		portfolioTags, err := repos.PortfolioTagRepo.FindAllBy(ctx, repository.ByColumn("tag_id", tag.ID))
		if err != nil {
			return fmt.Errorf("failed to get portfolio tags: %w", err)
		}

		for _, pt := range portfolioTags {
			// For junction tables, we need to delete by the composite key
			_, err = repos.PortfolioTagRepo.GetDB().NewDelete().
				Model((*model.PortfolioTag)(nil)).
				Where("portfolio_id = ? AND tag_id = ?", pt.PortfolioID, pt.TagID).
				Exec(ctx)
			if err != nil {
				return fmt.Errorf("failed to remove portfolio tag association: %w", err)
			}
		}

		// Delete the tag
		return repos.TagRepo.Delete(ctx, id)
	})
}

// TagAsset associates a tag with an asset
func (s *TagService) TagAsset(ctx context.Context, assetID, tagID int) error {
	// Validate inputs
	if err := s.validateTagAssociation(assetID, tagID); err != nil {
		return err
	}

	// Use Unit of Work to ensure atomicity
	return s.uow.Do(ctx, func(repos *repository.TxRepositories) error {
		// Verify asset exists
		if _, err := repos.AssetRepo.GetByID(ctx, uint(assetID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("asset with ID %d not found", assetID)
			}
			return fmt.Errorf("failed to verify asset: %w", err)
		}

		// Verify tag exists
		if _, err := repos.TagRepo.GetByID(ctx, uint(tagID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("tag with ID %d not found", tagID)
			}
			return fmt.Errorf("failed to verify tag: %w", err)
		}

		// Check if association already exists
		existingAssociations, err := repos.AssetTagRepo.FindAllBy(ctx,
			repository.ByColumn("asset_id", assetID),
			repository.ByColumn("tag_id", tagID),
		)
		if err != nil {
			return fmt.Errorf("failed to check existing association: %w", err)
		}

		if len(existingAssociations) > 0 {
			return nil // Association already exists, no need to create again
		}

		// Create association
		assetTag := model.AssetTag{
			AssetID: assetID,
			TagID:   tagID,
		}

		_, err = repos.AssetTagRepo.Create(ctx, &assetTag)
		if err != nil {
			return fmt.Errorf("failed to create asset tag association: %w", err)
		}

		return nil
	})
}

// UntagAsset removes a tag association from an asset
func (s *TagService) UntagAsset(ctx context.Context, assetID, tagID int) error {
	// Validate inputs
	if err := s.validateTagAssociation(assetID, tagID); err != nil {
		return err
	}

	// Use Unit of Work to ensure atomicity
	return s.uow.Do(ctx, func(repos *repository.TxRepositories) error {
		// Find the association
		assetTags, err := repos.AssetTagRepo.FindAllBy(ctx,
			repository.ByColumn("asset_id", assetID),
			repository.ByColumn("tag_id", tagID),
		)
		if err != nil {
			return fmt.Errorf("failed to find asset tag association: %w", err)
		}

		if len(assetTags) == 0 {
			return fmt.Errorf("asset %d is not tagged with tag %d", assetID, tagID)
		}

		// Delete the association
		for _, at := range assetTags {
			// For junction tables, we need to delete by the composite key
			_, err = repos.AssetTagRepo.GetDB().NewDelete().
				Model((*model.AssetTag)(nil)).
				Where("asset_id = ? AND tag_id = ?", at.AssetID, at.TagID).
				Exec(ctx)
			if err != nil {
				return fmt.Errorf("failed to remove asset tag association: %w", err)
			}
		}

		return nil
	})
}

// TagPortfolio associates a tag with a portfolio
func (s *TagService) TagPortfolio(ctx context.Context, portfolioID, tagID int) error {
	// Validate inputs
	if err := s.validateTagAssociation(portfolioID, tagID); err != nil {
		return err
	}

	// Use Unit of Work to ensure atomicity
	return s.uow.Do(ctx, func(repos *repository.TxRepositories) error {
		// Verify portfolio exists
		if _, err := repos.PortfolioRepo.GetByID(ctx, uint(portfolioID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("portfolio with ID %d not found", portfolioID)
			}
			return fmt.Errorf("failed to verify portfolio: %w", err)
		}

		// Verify tag exists
		if _, err := repos.TagRepo.GetByID(ctx, uint(tagID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("tag with ID %d not found", tagID)
			}
			return fmt.Errorf("failed to verify tag: %w", err)
		}

		// Check if association already exists
		existingAssociations, err := repos.PortfolioTagRepo.FindAllBy(ctx,
			repository.ByColumn("portfolio_id", portfolioID),
			repository.ByColumn("tag_id", tagID),
		)
		if err != nil {
			return fmt.Errorf("failed to check existing association: %w", err)
		}

		if len(existingAssociations) > 0 {
			return nil // Association already exists, no need to create again
		}

		// Create association
		portfolioTag := model.PortfolioTag{
			PortfolioID: portfolioID,
			TagID:       tagID,
		}

		_, err = repos.PortfolioTagRepo.Create(ctx, &portfolioTag)
		if err != nil {
			return fmt.Errorf("failed to create portfolio tag association: %w", err)
		}

		return nil
	})
}

// UntagPortfolio removes a tag association from a portfolio
func (s *TagService) UntagPortfolio(ctx context.Context, portfolioID, tagID int) error {
	// Validate inputs
	if err := s.validateTagAssociation(portfolioID, tagID); err != nil {
		return err
	}

	// Use Unit of Work to ensure atomicity
	return s.uow.Do(ctx, func(repos *repository.TxRepositories) error {
		// Find the association
		portfolioTags, err := repos.PortfolioTagRepo.FindAllBy(ctx,
			repository.ByColumn("portfolio_id", portfolioID),
			repository.ByColumn("tag_id", tagID),
		)
		if err != nil {
			return fmt.Errorf("failed to find portfolio tag association: %w", err)
		}

		if len(portfolioTags) == 0 {
			return fmt.Errorf("portfolio %d is not tagged with tag %d", portfolioID, tagID)
		}

		// Delete the association
		for _, pt := range portfolioTags {
			// For junction tables, we need to delete by the composite key
			_, err = repos.PortfolioTagRepo.GetDB().NewDelete().
				Model((*model.PortfolioTag)(nil)).
				Where("portfolio_id = ? AND tag_id = ?", pt.PortfolioID, pt.TagID).
				Exec(ctx)
			if err != nil {
				return fmt.Errorf("failed to remove portfolio tag association: %w", err)
			}
		}

		return nil
	})
}

// GetAssetTags retrieves all tags associated with an asset
func (s *TagService) GetAssetTags(ctx context.Context, assetID int) ([]model.Tag, error) {
	if assetID <= 0 {
		return nil, errors.New("asset ID must be positive")
	}

	// Get asset tag associations
	assetTags, err := s.uow.AssetTag().FindAllBy(ctx, repository.ByColumn("asset_id", assetID))
	if err != nil {
		return nil, fmt.Errorf("failed to get asset tags: %w", err)
	}

	if len(assetTags) == 0 {
		return []model.Tag{}, nil
	}

	// Extract tag IDs
	tagIDs := make([]int, len(assetTags))
	for i, at := range assetTags {
		tagIDs[i] = at.TagID
	}

	// Get tags by IDs
	var tags []model.Tag
	for _, tagID := range tagIDs {
		tag, err := s.uow.Tag().GetByID(ctx, uint(tagID))
		if err != nil {
			return nil, fmt.Errorf("failed to get tag %d: %w", tagID, err)
		}
		tags = append(tags, tag)
	}

	return tags, nil
}

// GetPortfolioTags retrieves all tags associated with a portfolio
func (s *TagService) GetPortfolioTags(ctx context.Context, portfolioID int) ([]model.Tag, error) {
	if portfolioID <= 0 {
		return nil, errors.New("portfolio ID must be positive")
	}

	// Get portfolio tag associations
	portfolioTags, err := s.uow.PortfolioTag().FindAllBy(ctx, repository.ByColumn("portfolio_id", portfolioID))
	if err != nil {
		return nil, fmt.Errorf("failed to get portfolio tags: %w", err)
	}

	if len(portfolioTags) == 0 {
		return []model.Tag{}, nil
	}

	// Extract tag IDs
	tagIDs := make([]int, len(portfolioTags))
	for i, pt := range portfolioTags {
		tagIDs[i] = pt.TagID
	}

	// Get tags by IDs
	var tags []model.Tag
	for _, tagID := range tagIDs {
		tag, err := s.uow.Tag().GetByID(ctx, uint(tagID))
		if err != nil {
			return nil, fmt.Errorf("failed to get tag %d: %w", tagID, err)
		}
		tags = append(tags, tag)
	}

	return tags, nil
}

// GetTaggedAssets retrieves all assets associated with a tag
func (s *TagService) GetTaggedAssets(ctx context.Context, tagID int) ([]model.Asset, error) {
	if tagID <= 0 {
		return nil, errors.New("tag ID must be positive")
	}

	// Get asset tag associations
	assetTags, err := s.uow.AssetTag().FindAllBy(ctx, repository.ByColumn("tag_id", tagID))
	if err != nil {
		return nil, fmt.Errorf("failed to get tagged assets: %w", err)
	}

	if len(assetTags) == 0 {
		return []model.Asset{}, nil
	}

	// Extract asset IDs
	assetIDs := make([]int, len(assetTags))
	for i, at := range assetTags {
		assetIDs[i] = at.AssetID
	}

	// Get assets by IDs
	var assets []model.Asset
	for _, assetID := range assetIDs {
		asset, err := s.uow.Asset().GetByID(ctx, uint(assetID))
		if err != nil {
			return nil, fmt.Errorf("failed to get asset %d: %w", assetID, err)
		}
		assets = append(assets, asset)
	}

	return assets, nil
}

// GetTaggedPortfolios retrieves all portfolios associated with a tag
func (s *TagService) GetTaggedPortfolios(ctx context.Context, tagID int) ([]model.Portfolio, error) {
	if tagID <= 0 {
		return nil, errors.New("tag ID must be positive")
	}

	// Get portfolio tag associations
	portfolioTags, err := s.uow.PortfolioTag().FindAllBy(ctx, repository.ByColumn("tag_id", tagID))
	if err != nil {
		return nil, fmt.Errorf("failed to get tagged portfolios: %w", err)
	}

	if len(portfolioTags) == 0 {
		return []model.Portfolio{}, nil
	}

	// Extract portfolio IDs
	portfolioIDs := make([]int, len(portfolioTags))
	for i, pt := range portfolioTags {
		portfolioIDs[i] = pt.PortfolioID
	}

	// Get portfolios by IDs
	var portfolios []model.Portfolio
	for _, portfolioID := range portfolioIDs {
		portfolio, err := s.uow.Portfolio().GetByID(ctx, uint(portfolioID))
		if err != nil {
			return nil, fmt.Errorf("failed to get portfolio %d: %w", portfolioID, err)
		}
		portfolios = append(portfolios, portfolio)
	}

	return portfolios, nil
}

// GetTagUsageStatistics retrieves usage statistics for a tag
func (s *TagService) GetTagUsageStatistics(ctx context.Context, tagID int) (TagUsageStats, error) {
	if tagID <= 0 {
		return TagUsageStats{}, errors.New("tag ID must be positive")
	}

	// Get tag
	tag, err := s.uow.Tag().GetByID(ctx, uint(tagID))
	if err != nil {
		return TagUsageStats{}, fmt.Errorf("failed to get tag: %w", err)
	}

	// Count asset associations
	assetCount, err := s.uow.AssetTag().Count(ctx, repository.ByColumn("tag_id", tagID))
	if err != nil {
		return TagUsageStats{}, fmt.Errorf("failed to count asset associations: %w", err)
	}

	// Count portfolio associations
	portfolioCount, err := s.uow.PortfolioTag().Count(ctx, repository.ByColumn("tag_id", tagID))
	if err != nil {
		return TagUsageStats{}, fmt.Errorf("failed to count portfolio associations: %w", err)
	}

	return TagUsageStats{
		TagID:           tag.ID,
		TagName:         tag.Name,
		AssetCount:      assetCount,
		PortfolioCount:  portfolioCount,
		TotalUsageCount: assetCount + portfolioCount,
	}, nil
}

// FindOrCreateTag finds an existing tag by name or creates a new one
func (s *TagService) FindOrCreateTag(ctx context.Context, name string) (model.Tag, error) {
	normalizedName := s.normalizeTagName(name)

	// Try to find existing tag
	existingTag, err := s.FindByName(ctx, normalizedName)
	if err == nil {
		return existingTag, nil
	}

	if !errors.Is(err, repository.ErrNotFound) {
		return model.Tag{}, fmt.Errorf("failed to search for existing tag: %w", err)
	}

	// Create new tag
	return s.CreateTag(ctx, CreateTagInput{Name: normalizedName})
}

// BulkTagAssets associates a tag with multiple assets
func (s *TagService) BulkTagAssets(ctx context.Context, assetIDs []int, tagID int) error {
	if len(assetIDs) == 0 {
		return errors.New("asset IDs list cannot be empty")
	}
	if tagID <= 0 {
		return errors.New("tag ID must be positive")
	}

	// Use Unit of Work to ensure atomicity
	return s.uow.Do(ctx, func(repos *repository.TxRepositories) error {
		// Verify tag exists
		if _, err := repos.TagRepo.GetByID(ctx, uint(tagID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("tag with ID %d not found", tagID)
			}
			return fmt.Errorf("failed to verify tag: %w", err)
		}

		// Tag each asset
		for _, assetID := range assetIDs {
			if assetID <= 0 {
				continue // Skip invalid IDs
			}

			// Verify asset exists
			if _, err := repos.AssetRepo.GetByID(ctx, uint(assetID)); err != nil {
				if errors.Is(err, repository.ErrNotFound) {
					return fmt.Errorf("asset with ID %d not found", assetID)
				}
				return fmt.Errorf("failed to verify asset %d: %w", assetID, err)
			}

			// Check if association already exists
			existingAssociations, err := repos.AssetTagRepo.FindAllBy(ctx,
				repository.ByColumn("asset_id", assetID),
				repository.ByColumn("tag_id", tagID),
			)
			if err != nil {
				return fmt.Errorf("failed to check existing association for asset %d: %w", assetID, err)
			}

			if len(existingAssociations) > 0 {
				continue // Association already exists, skip
			}

			// Create association
			assetTag := model.AssetTag{
				AssetID: assetID,
				TagID:   tagID,
			}

			_, err = repos.AssetTagRepo.Create(ctx, &assetTag)
			if err != nil {
				return fmt.Errorf("failed to create asset tag association for asset %d: %w", assetID, err)
			}
		}

		return nil
	})
}

// BulkTagPortfolios associates a tag with multiple portfolios
func (s *TagService) BulkTagPortfolios(ctx context.Context, portfolioIDs []int, tagID int) error {
	if len(portfolioIDs) == 0 {
		return errors.New("portfolio IDs list cannot be empty")
	}
	if tagID <= 0 {
		return errors.New("tag ID must be positive")
	}

	// Use Unit of Work to ensure atomicity
	return s.uow.Do(ctx, func(repos *repository.TxRepositories) error {
		// Verify tag exists
		if _, err := repos.TagRepo.GetByID(ctx, uint(tagID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("tag with ID %d not found", tagID)
			}
			return fmt.Errorf("failed to verify tag: %w", err)
		}

		// Tag each portfolio
		for _, portfolioID := range portfolioIDs {
			if portfolioID <= 0 {
				continue // Skip invalid IDs
			}

			// Verify portfolio exists
			if _, err := repos.PortfolioRepo.GetByID(ctx, uint(portfolioID)); err != nil {
				if errors.Is(err, repository.ErrNotFound) {
					return fmt.Errorf("portfolio with ID %d not found", portfolioID)
				}
				return fmt.Errorf("failed to verify portfolio %d: %w", portfolioID, err)
			}

			// Check if association already exists
			existingAssociations, err := repos.PortfolioTagRepo.FindAllBy(ctx,
				repository.ByColumn("portfolio_id", portfolioID),
				repository.ByColumn("tag_id", tagID),
			)
			if err != nil {
				return fmt.Errorf("failed to check existing association for portfolio %d: %w", portfolioID, err)
			}

			if len(existingAssociations) > 0 {
				continue // Association already exists, skip
			}

			// Create association
			portfolioTag := model.PortfolioTag{
				PortfolioID: portfolioID,
				TagID:       tagID,
			}

			_, err = repos.PortfolioTagRepo.Create(ctx, &portfolioTag)
			if err != nil {
				return fmt.Errorf("failed to create portfolio tag association for portfolio %d: %w", portfolioID, err)
			}
		}

		return nil
	})
}

// Helper methods for validation and business logic

func (s *TagService) validateCreateTagInput(input CreateTagInput) error {
	if len(strings.TrimSpace(input.Name)) == 0 {
		return errors.New("tag name is required")
	}
	if len(input.Name) > 50 {
		return errors.New("tag name must be 50 characters or less")
	}
	return nil
}

func (s *TagService) validateUpdateTagInput(input UpdateTagInput) error {
	if len(strings.TrimSpace(input.Name)) == 0 {
		return errors.New("tag name is required")
	}
	if len(input.Name) > 50 {
		return errors.New("tag name must be 50 characters or less")
	}
	return nil
}

func (s *TagService) validateTagAssociation(entityID, tagID int) error {
	if entityID <= 0 {
		return errors.New("entity ID must be positive")
	}
	if tagID <= 0 {
		return errors.New("tag ID must be positive")
	}
	return nil
}

func (s *TagService) normalizeTagName(name string) string {
	// Trim whitespace and convert to lowercase for consistency
	return strings.ToLower(strings.TrimSpace(name))
}
