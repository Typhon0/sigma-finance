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
	GetAssetsByTag(ctx context.Context, tagID int) ([]model.Asset, error)
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
	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Verify tag exists
		_, err := uow.Tag().GetByID(ctx, id)
		if err != nil {
			return err
		}

		// Remove all asset tag associations
		assetTags, err := uow.AssetTag().FindByTagID(ctx, id)
		if err != nil {
			return fmt.Errorf("failed to get asset tags: %w", err)
		}
		for _, at := range assetTags {
			err = uow.AssetTag().Remove(ctx, uint(at.AssetID), uint(at.TagID))
			if err != nil {
				return fmt.Errorf("failed to remove asset tag association: %w", err)
			}
		}

		// Remove all portfolio tag associations
		portfolioTags, err := uow.PortfolioTag().FindByTagID(ctx, id)
		if err != nil {
			return fmt.Errorf("failed to get portfolio tags: %w", err)
		}

		for _, pt := range portfolioTags {
			err = uow.PortfolioTag().Remove(ctx, uint(pt.PortfolioID), uint(pt.TagID))
			if err != nil {
				return fmt.Errorf("failed to remove portfolio tag association: %w", err)
			}
		}

		// Delete the tag
		return uow.Tag().Delete(ctx, id)
	})
}

// TagAsset associates a tag with an asset
func (s *TagService) TagAsset(ctx context.Context, assetID, tagID int) error {
	// Validate inputs
	if err := s.validateTagAssociation(assetID, tagID); err != nil {
		return err
	}

	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Verify asset exists
		if _, err := uow.Asset().GetByID(ctx, uint(assetID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("asset with ID %d not found", assetID)
			}
			return fmt.Errorf("failed to verify asset: %w", err)
		}

		// Verify tag exists
		if _, err := uow.Tag().GetByID(ctx, uint(tagID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("tag with ID %d not found", tagID)
			}
			return fmt.Errorf("failed to verify tag: %w", err)
		}

		// Check if association already exists
		existing, err := uow.AssetTag().FindByAssetID(ctx, uint(assetID))
		if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("failed to check existing association: %w", err)
		}
		for _, at := range existing {
			if at.TagID == tagID {
				return nil // Association already exists
			}
		}

		// Create association
		return uow.AssetTag().Add(ctx, uint(assetID), uint(tagID))
	})
}

// UntagAsset removes a tag association from an asset
func (s *TagService) UntagAsset(ctx context.Context, assetID, tagID int) error {
	// Validate inputs
	if err := s.validateTagAssociation(assetID, tagID); err != nil {
		return err
	}

	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		return uow.AssetTag().Remove(ctx, uint(assetID), uint(tagID))
	})
}

// TagPortfolio associates a tag with a portfolio
func (s *TagService) TagPortfolio(ctx context.Context, portfolioID, tagID int) error {
	// Validate inputs
	if err := s.validateTagAssociation(portfolioID, tagID); err != nil {
		return err
	}

	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Verify portfolio exists
		if _, err := uow.Portfolio().GetByID(ctx, uint(portfolioID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("portfolio with ID %d not found", portfolioID)
			}
			return fmt.Errorf("failed to verify portfolio: %w", err)
		}

		// Verify tag exists
		if _, err := uow.Tag().GetByID(ctx, uint(tagID)); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("tag with ID %d not found", tagID)
			}
			return fmt.Errorf("failed to verify tag: %w", err)
		}

		// Check if association already exists
		existing, err := uow.PortfolioTag().FindByPortfolioID(ctx, uint(portfolioID))
		if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("failed to check existing association: %w", err)
		}
		for _, pt := range existing {
			if pt.TagID == tagID {
				return nil // Association already exists
			}
		}

		// Create association
		return uow.PortfolioTag().Add(ctx, uint(portfolioID), uint(tagID))
	})
}

// UntagPortfolio removes a tag association from a portfolio
func (s *TagService) UntagPortfolio(ctx context.Context, portfolioID, tagID int) error {
	// Validate inputs
	if err := s.validateTagAssociation(portfolioID, tagID); err != nil {
		return err
	}

	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		return uow.PortfolioTag().Remove(ctx, uint(portfolioID), uint(tagID))
	})
}

// GetAssetTags retrieves all tags for a given asset
func (s *TagService) GetAssetTags(ctx context.Context, assetID int) ([]model.Tag, error) {
	assetTags, err := s.uow.AssetTag().FindByAssetID(ctx, uint(assetID))
	if err != nil {
		return nil, fmt.Errorf("failed to get asset tags: %w", err)
	}

	if len(assetTags) == 0 {
		return []model.Tag{}, nil
	}

	tagIDs := make([]uint, len(assetTags))
	for i, at := range assetTags {
		tagIDs[i] = uint(at.TagID)
	}

	// This is not efficient, but it's the best we can do without a proper join
	var tags []model.Tag
	for _, tagID := range tagIDs {
		tag, err := s.uow.Tag().GetByID(ctx, tagID)
		if err != nil {
			return nil, fmt.Errorf("failed to get tag %d: %w", tagID, err)
		}
		tags = append(tags, tag)
	}

	return tags, nil
}

// GetPortfolioTags retrieves all tags for a given portfolio
func (s *TagService) GetPortfolioTags(ctx context.Context, portfolioID int) ([]model.Tag, error) {
	portfolioTags, err := s.uow.PortfolioTag().FindByPortfolioID(ctx, uint(portfolioID))
	if err != nil {
		return nil, fmt.Errorf("failed to get portfolio tags: %w", err)
	}

	if len(portfolioTags) == 0 {
		return []model.Tag{}, nil
	}

	tagIDs := make([]uint, len(portfolioTags))
	for i, pt := range portfolioTags {
		tagIDs[i] = uint(pt.TagID)
	}

	var tags []model.Tag
	for _, tagID := range tagIDs {
		tag, err := s.uow.Tag().GetByID(ctx, tagID)
		if err != nil {
			return nil, fmt.Errorf("failed to get tag %d: %w", tagID, err)
		}
		tags = append(tags, tag)
	}

	return tags, nil
}

// GetTaggedAssets retrieves all assets with a given tag
func (s *TagService) GetTaggedAssets(ctx context.Context, tagID int) ([]model.Asset, error) {
	assetTags, err := s.uow.AssetTag().FindByTagID(ctx, uint(tagID))
	if err != nil {
		return nil, fmt.Errorf("failed to get asset tags: %w", err)
	}

	if len(assetTags) == 0 {
		return []model.Asset{}, nil
	}

	assetIDs := make([]uint, len(assetTags))
	for i, at := range assetTags {
		assetIDs[i] = uint(at.AssetID)
	}

	var assets []model.Asset
	for _, assetID := range assetIDs {
		asset, err := s.uow.Asset().GetByID(ctx, assetID)
		if err != nil {
			return nil, fmt.Errorf("failed to get asset %d: %w", assetID, err)
		}
		assets = append(assets, asset)
	}

	return assets, nil
}

// GetTaggedPortfolios retrieves all portfolios with a given tag
func (s *TagService) GetTaggedPortfolios(ctx context.Context, tagID int) ([]model.Portfolio, error) {
	portfolioTags, err := s.uow.PortfolioTag().FindByTagID(ctx, uint(tagID))
	if err != nil {
		return nil, fmt.Errorf("failed to get portfolio tags: %w", err)
	}

	if len(portfolioTags) == 0 {
		return []model.Portfolio{}, nil
	}

	portfolioIDs := make([]uint, len(portfolioTags))
	for i, pt := range portfolioTags {
		portfolioIDs[i] = uint(pt.PortfolioID)
	}

	var portfolios []model.Portfolio
	for _, portfolioID := range portfolioIDs {
		portfolio, err := s.uow.Portfolio().GetByID(ctx, portfolioID)
		if err != nil {
			return nil, fmt.Errorf("failed to get portfolio %d: %w", portfolioID, err)
		}
		portfolios = append(portfolios, portfolio)
	}

	return portfolios, nil
}

// GetTagUsageStatistics calculates usage statistics for a tag
func (s *TagService) GetTagUsageStatistics(ctx context.Context, tagID int) (TagUsageStats, error) {
	tag, err := s.uow.Tag().GetByID(ctx, uint(tagID))
	if err != nil {
		return TagUsageStats{}, fmt.Errorf("failed to get tag: %w", err)
	}

	assetTags, err := s.uow.AssetTag().FindByTagID(ctx, uint(tagID))
	if err != nil {
		return TagUsageStats{}, fmt.Errorf("failed to count asset tags: %w", err)
	}
	assetCount := len(assetTags)

	portfolioTags, err := s.uow.PortfolioTag().FindByTagID(ctx, uint(tagID))
	if err != nil {
		return TagUsageStats{}, fmt.Errorf("failed to count portfolio tags: %w", err)
	}
	portfolioCount := len(portfolioTags)

	stats := TagUsageStats{
		TagID:           int(tag.ID),
		TagName:         tag.Name,
		AssetCount:      assetCount,
		PortfolioCount:  portfolioCount,
		TotalUsageCount: assetCount + portfolioCount,
	}

	return stats, nil
}

// FindOrCreateTag finds a tag by name or creates it if it doesn't exist
func (s *TagService) FindOrCreateTag(ctx context.Context, name string) (model.Tag, error) {
	normalizedName := s.normalizeTagName(name)
	tag, err := s.FindByName(ctx, normalizedName)
	if err == nil {
		return tag, nil // Tag found
	}
	if !errors.Is(err, repository.ErrNotFound) {
		return model.Tag{}, fmt.Errorf("failed to find tag: %w", err)
	}

	// Tag not found, create it
	return s.CreateTag(ctx, CreateTagInput{Name: normalizedName})
}

// BulkTagAssets associates a tag with multiple assets
func (s *TagService) BulkTagAssets(ctx context.Context, assetIDs []int, tagID int) error {
	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Verify tag exists
		if _, err := uow.Tag().GetByID(ctx, uint(tagID)); err != nil {
			return fmt.Errorf("tag with ID %d not found", tagID)
		}

		for _, assetID := range assetIDs {
			// Verify asset exists
			if _, err := uow.Asset().GetByID(ctx, uint(assetID)); err != nil {
				return fmt.Errorf("asset with ID %d not found", assetID)
			}

			// Check if association already exists
			existing, err := uow.AssetTag().FindByAssetID(ctx, uint(assetID))
			if err != nil && !errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("failed to check existing association for asset %d: %w", assetID, err)
			}

			alreadyExists := false
			for _, at := range existing {
				if at.TagID == tagID {
					alreadyExists = true
					break
				}
			}

			if !alreadyExists {
				if err := uow.AssetTag().Add(ctx, uint(assetID), uint(tagID)); err != nil {
					return fmt.Errorf("failed to tag asset %d: %w", assetID, err)
				}
			}
		}
		return nil
	})
}

// BulkTagPortfolios associates a tag with multiple portfolios
func (s *TagService) BulkTagPortfolios(ctx context.Context, portfolioIDs []int, tagID int) error {
	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Verify tag exists
		if _, err := uow.Tag().GetByID(ctx, uint(tagID)); err != nil {
			return fmt.Errorf("tag with ID %d not found", tagID)
		}

		for _, portfolioID := range portfolioIDs {
			// Verify portfolio exists
			if _, err := uow.Portfolio().GetByID(ctx, uint(portfolioID)); err != nil {
				return fmt.Errorf("portfolio with ID %d not found", portfolioID)
			}

			// Check if association already exists
			existing, err := uow.PortfolioTag().FindByPortfolioID(ctx, uint(portfolioID))
			if err != nil && !errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("failed to check existing association for portfolio %d: %w", portfolioID, err)
			}

			alreadyExists := false
			for _, pt := range existing {
				if pt.TagID == tagID {
					alreadyExists = true
					break
				}
			}

			if !alreadyExists {
				if err := uow.PortfolioTag().Add(ctx, uint(portfolioID), uint(tagID)); err != nil {
					return fmt.Errorf("failed to tag portfolio %d: %w", portfolioID, err)
				}
			}
		}
		return nil
	})
}

// GetAssetsByTag retrieves all assets associated with a given tag.
func (s *TagService) GetAssetsByTag(ctx context.Context, tagID int) ([]model.Asset, error) {
	return s.GetTaggedAssets(ctx, tagID)
}

// --- Private helper methods ---

// validateCreateTagInput validates the input for creating a tag
func (s *TagService) validateCreateTagInput(input CreateTagInput) error {
	if strings.TrimSpace(input.Name) == "" {
		return errors.New("tag name cannot be empty")
	}
	return nil
}

// validateUpdateTagInput validates the input for updating a tag
func (s *TagService) validateUpdateTagInput(input UpdateTagInput) error {
	if strings.TrimSpace(input.Name) == "" {
		return errors.New("tag name cannot be empty")
	}
	return nil
}

// validateTagAssociation validates IDs for tag associations
func (s *TagService) validateTagAssociation(entityID, tagID int) error {
	if entityID <= 0 || tagID <= 0 {
		return errors.New("asset ID and tag ID must be positive integers")
	}
	return nil
}

// normalizeTagName converts a tag name to a consistent format
func (s *TagService) normalizeTagName(name string) string {
	return strings.ToLower(strings.TrimSpace(name))
}
