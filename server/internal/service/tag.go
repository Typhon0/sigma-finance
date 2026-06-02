package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"strings"
)

// ITagService defines the interface for tag management operations
type ITagService interface {
	GetByID(ctx context.Context, id string) (*model.Tag, error)
	FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Tag, error)
	FindAllByUserID(ctx context.Context, userID string) ([]model.Tag, error)
	FindByNameAndUserID(ctx context.Context, name string, userID string) (*model.Tag, error)
	CreateTag(ctx context.Context, input CreateTagInput) (*model.Tag, error)
	UpdateTag(ctx context.Context, id string, input UpdateTagInput) (*model.Tag, error)
	DeleteTag(ctx context.Context, id string) error
	TagAsset(ctx context.Context, assetID, tagID string) error
	UntagAsset(ctx context.Context, assetID, tagID string) error
	TagPortfolio(ctx context.Context, portfolioID, tagID string) error
	UntagPortfolio(ctx context.Context, portfolioID, tagID string) error
	GetAssetTags(ctx context.Context, assetID string) ([]model.Tag, error)
	GetPortfolioTags(ctx context.Context, portfolioID string) ([]model.Tag, error)
	GetTaggedAssets(ctx context.Context, tagID string) ([]model.Asset, error)
	GetTaggedPortfolios(ctx context.Context, tagID string) ([]model.Portfolio, error)
	GetTagUsageStatistics(ctx context.Context, tagID string) (TagUsageStats, error)
	FindOrCreateTag(ctx context.Context, name string, userID string) (*model.Tag, error)
	BulkTagAssets(ctx context.Context, assetIDs []string, tagID string) error
	BulkTagPortfolios(ctx context.Context, portfolioIDs []string, tagID string) error
	GetAssetsByTag(ctx context.Context, tagID string) ([]model.Asset, error)
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
	Name   string
	UserID string
}

type UpdateTagInput struct {
	Name string
}

// TagUsageStats represents usage statistics for a tag
type TagUsageStats struct {
	TagID           string
	TagName         string
	AssetCount      int
	PortfolioCount  int
	TotalUsageCount int
}

// GetByID retrieves a single tag by its ID
func (s *TagService) GetByID(ctx context.Context, id string) (*model.Tag, error) {
	return s.uow.Tag().GetByID(ctx, id)
}

// FindAll retrieves all tags with optional query options
func (s *TagService) FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Tag, error) {
	return s.uow.Tag().FindAllBy(ctx, opts...)
}

// FindByNameAndUserID retrieves a tag by its name scoped to a specific user
func (s *TagService) FindByNameAndUserID(ctx context.Context, name string, userID string) (*model.Tag, error) {
	return s.uow.Tag().FindOneBy(ctx, repository.ByColumn("name", name), repository.ByColumn("user_id", userID))
}

// FindAllByUserID retrieves all tags for a specific user
func (s *TagService) FindAllByUserID(ctx context.Context, userID string) ([]model.Tag, error) {
	return s.uow.Tag().FindAllBy(ctx, repository.ByColumn("user_id", userID))
}

// CreateTag creates a new tag with validation
func (s *TagService) CreateTag(ctx context.Context, input CreateTagInput) (*model.Tag, error) {
	log.Printf("[TagService] CreateTag: started user=%s name=%s", input.UserID, input.Name)
	// Validate input
	if err := s.validateCreateTagInput(input); err != nil {
		return nil, err
	}

	// Normalize tag name
	normalizedName := s.normalizeTagName(input.Name)

	// Check if tag already exists for this user
	_, err := s.FindByNameAndUserID(ctx, normalizedName, input.UserID)
	if err == nil {
		return nil, fmt.Errorf("tag with name '%s' already exists", normalizedName)
	}
	if !errors.Is(err, repository.ErrNotFound) {
		return nil, fmt.Errorf("failed to check existing tag: %w", err)
	}

	// Create tag
	newTag := model.Tag{
		Name:   normalizedName,
		UserID: input.UserID,
	}

	createdTag, err := s.uow.Tag().Create(ctx, &newTag)
	if err != nil {
		log.Printf("[TagService] CreateTag: ERROR creation failed user=%s name=%s: %v", input.UserID, normalizedName, err)
		return nil, fmt.Errorf("failed to create tag: %w", err)
	}
	log.Printf("[TagService] CreateTag: SUCCESS id=%s user=%s name=%s", createdTag.ID, input.UserID, normalizedName)
	return createdTag, nil
}

// UpdateTag updates an existing tag
func (s *TagService) UpdateTag(ctx context.Context, id string, input UpdateTagInput) (*model.Tag, error) {
	// Validate input
	if err := s.validateUpdateTagInput(input); err != nil {
		return nil, err
	}

	// Get existing tag
	tagToUpdate, err := s.uow.Tag().GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Normalize tag name
	normalizedName := s.normalizeTagName(input.Name)

	// Check if another tag with the same name exists for this user (excluding current tag)
	existingTag, err := s.FindByNameAndUserID(ctx, normalizedName, tagToUpdate.UserID)
	if err == nil && existingTag.ID != tagToUpdate.ID {
		return nil, fmt.Errorf("tag with name '%s' already exists", normalizedName)
	}
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, fmt.Errorf("failed to check existing tag: %w", err)
	}

	// Apply updates
	tagToUpdate.Name = normalizedName

	// Save changes
	err = s.uow.Tag().Update(ctx, tagToUpdate)
	if err != nil {
		return nil, fmt.Errorf("failed to update tag: %w", err)
	}

	return tagToUpdate, nil
}

// DeleteTag removes a tag and all its associations
func (s *TagService) DeleteTag(ctx context.Context, id string) error {
	log.Printf("[TagService] DeleteTag: started id=%s", id)
	// Use Unit of Work to ensure atomicity
	err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
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
			err = uow.AssetTag().Remove(ctx, at.AssetID, at.TagID)
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
			err = uow.PortfolioTag().Remove(ctx, pt.PortfolioID, pt.TagID)
			if err != nil {
				return fmt.Errorf("failed to remove portfolio tag association: %w", err)
			}
		}

		// Delete the tag
		return uow.Tag().Delete(ctx, id)
	})
	if err != nil {
		log.Printf("[TagService] DeleteTag: ERROR id=%s: %v", id, err)
	} else {
		log.Printf("[TagService] DeleteTag: SUCCESS id=%s", id)
	}
	return err
}

// TagAsset associates a tag with an asset
func (s *TagService) TagAsset(ctx context.Context, assetID, tagID string) error {
	log.Printf("[TagService] TagAsset: started asset=%s tag=%s", assetID, tagID)
	// Validate inputs
	if err := s.validateTagAssociation(assetID, tagID); err != nil {
		return err
	}

	err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Verify asset exists
		if _, err := uow.Asset().GetByID(ctx, assetID); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("asset with ID %s not found", assetID)
			}
			return fmt.Errorf("failed to verify asset: %w", err)
		}

		// Verify tag exists
		if _, err := uow.Tag().GetByID(ctx, tagID); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("tag with ID %s not found", tagID)
			}
			return fmt.Errorf("failed to verify tag: %w", err)
		}

		// Check if association already exists
		existing, err := uow.AssetTag().FindByAssetID(ctx, assetID)
		if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("failed to check existing association: %w", err)
		}
		for _, at := range existing {
			if at.TagID == tagID {
				return nil // Association already exists
			}
		}

		// Create association
		return uow.AssetTag().Add(ctx, assetID, tagID)
	})
	if err != nil {
		log.Printf("[TagService] TagAsset: ERROR asset=%s tag=%s: %v", assetID, tagID, err)
	} else {
		log.Printf("[TagService] TagAsset: SUCCESS asset=%s tag=%s", assetID, tagID)
	}
	return err
}

// UntagAsset removes a tag association from an asset
func (s *TagService) UntagAsset(ctx context.Context, assetID, tagID string) error {
	log.Printf("[TagService] UntagAsset: started asset=%s tag=%s", assetID, tagID)
	// Validate inputs
	if err := s.validateTagAssociation(assetID, tagID); err != nil {
		return err
	}

	err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		return uow.AssetTag().Remove(ctx, assetID, tagID)
	})
	if err != nil {
		log.Printf("[TagService] UntagAsset: ERROR asset=%s tag=%s: %v", assetID, tagID, err)
	} else {
		log.Printf("[TagService] UntagAsset: SUCCESS asset=%s tag=%s", assetID, tagID)
	}
	return err
}

// TagPortfolio associates a tag with a portfolio
func (s *TagService) TagPortfolio(ctx context.Context, portfolioID, tagID string) error {
	// Validate inputs
	if err := s.validateTagAssociation(portfolioID, tagID); err != nil {
		return err
	}

	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Verify portfolio exists
		if _, err := uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("portfolio with ID %s not found", portfolioID)
			}
			return fmt.Errorf("failed to verify portfolio: %w", err)
		}

		// Verify tag exists
		if _, err := uow.Tag().GetByID(ctx, tagID); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("tag with ID %s not found", tagID)
			}
			return fmt.Errorf("failed to verify tag: %w", err)
		}

		// Check if association already exists
		existing, err := uow.PortfolioTag().FindByPortfolioID(ctx, portfolioID)
		if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("failed to check existing association: %w", err)
		}
		for _, pt := range existing {
			if pt.TagID == tagID {
				return nil // Association already exists
			}
		}

		// Create association
		return uow.PortfolioTag().Add(ctx, portfolioID, tagID)
	})
}

// UntagPortfolio removes a tag association from a portfolio
func (s *TagService) UntagPortfolio(ctx context.Context, portfolioID, tagID string) error {
	// Validate inputs
	if err := s.validateTagAssociation(portfolioID, tagID); err != nil {
		return err
	}

	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		return uow.PortfolioTag().Remove(ctx, portfolioID, tagID)
	})
}

// GetAssetTags retrieves all tags for a given asset
func (s *TagService) GetAssetTags(ctx context.Context, assetID string) ([]model.Tag, error) {
	assetTags, err := s.uow.AssetTag().FindByAssetID(ctx, assetID)
	if err != nil {
		return nil, fmt.Errorf("failed to get asset tags: %w", err)
	}

	if len(assetTags) == 0 {
		return []model.Tag{}, nil
	}

	var tags []model.Tag
	for _, at := range assetTags {
		tag, err := s.uow.Tag().GetByID(ctx, at.TagID)
		if err != nil {
			return nil, fmt.Errorf("failed to get tag %s: %w", at.TagID, err)
		}
		tags = append(tags, *tag)
	}

	return tags, nil
}

// GetPortfolioTags retrieves all tags for a given portfolio
func (s *TagService) GetPortfolioTags(ctx context.Context, portfolioID string) ([]model.Tag, error) {
	portfolioTags, err := s.uow.PortfolioTag().FindByPortfolioID(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to get portfolio tags: %w", err)
	}

	if len(portfolioTags) == 0 {
		return []model.Tag{}, nil
	}

	var tags []model.Tag
	for _, pt := range portfolioTags {
		tag, err := s.uow.Tag().GetByID(ctx, pt.TagID)
		if err != nil {
			return nil, fmt.Errorf("failed to get tag %s: %w", pt.TagID, err)
		}
		tags = append(tags, *tag)
	}

	return tags, nil
}

// GetTaggedAssets retrieves all assets with a given tag
func (s *TagService) GetTaggedAssets(ctx context.Context, tagID string) ([]model.Asset, error) {
	assetTags, err := s.uow.AssetTag().FindByTagID(ctx, tagID)
	if err != nil {
		return nil, fmt.Errorf("failed to get asset tags: %w", err)
	}

	if len(assetTags) == 0 {
		return []model.Asset{}, nil
	}

	var assets []model.Asset
	for _, at := range assetTags {
		asset, err := s.uow.Asset().GetByID(ctx, at.AssetID)
		if err != nil {
			return nil, fmt.Errorf("failed to get asset %s: %w", at.AssetID, err)
		}
		assets = append(assets, *asset)
	}

	return assets, nil
}

// GetTaggedPortfolios retrieves all portfolios with a given tag
func (s *TagService) GetTaggedPortfolios(ctx context.Context, tagID string) ([]model.Portfolio, error) {
	portfolioTags, err := s.uow.PortfolioTag().FindByTagID(ctx, tagID)
	if err != nil {
		return nil, fmt.Errorf("failed to get portfolio tags: %w", err)
	}

	if len(portfolioTags) == 0 {
		return []model.Portfolio{}, nil
	}

	var portfolios []model.Portfolio
	for _, pt := range portfolioTags {
		portfolio, err := s.uow.Portfolio().GetByID(ctx, pt.PortfolioID)
		if err != nil {
			return nil, fmt.Errorf("failed to get portfolio %s: %w", pt.PortfolioID, err)
		}
		portfolios = append(portfolios, *portfolio)
	}

	return portfolios, nil
}

// GetTagUsageStatistics calculates usage statistics for a tag
func (s *TagService) GetTagUsageStatistics(ctx context.Context, tagID string) (TagUsageStats, error) {
	tag, err := s.uow.Tag().GetByID(ctx, tagID)
	if err != nil {
		return TagUsageStats{}, fmt.Errorf("failed to get tag: %w", err)
	}

	assetTags, err := s.uow.AssetTag().FindByTagID(ctx, tagID)
	if err != nil {
		return TagUsageStats{}, fmt.Errorf("failed to count asset tags: %w", err)
	}
	assetCount := len(assetTags)

	portfolioTags, err := s.uow.PortfolioTag().FindByTagID(ctx, tagID)
	if err != nil {
		return TagUsageStats{}, fmt.Errorf("failed to count portfolio tags: %w", err)
	}
	portfolioCount := len(portfolioTags)

	stats := TagUsageStats{
		TagID:           tag.ID,
		TagName:         tag.Name,
		AssetCount:      assetCount,
		PortfolioCount:  portfolioCount,
		TotalUsageCount: assetCount + portfolioCount,
	}

	return stats, nil
}

// FindOrCreateTag finds a tag by name or creates it if it doesn't exist
func (s *TagService) FindOrCreateTag(ctx context.Context, name string, userID string) (*model.Tag, error) {
	normalizedName := s.normalizeTagName(name)
	tag, err := s.FindByNameAndUserID(ctx, normalizedName, userID)
	if err == nil {
		return tag, nil // Tag found
	}
	if !errors.Is(err, repository.ErrNotFound) {
		return nil, fmt.Errorf("failed to find tag: %w", err)
	}

	// Tag not found, create it
	return s.CreateTag(ctx, CreateTagInput{Name: normalizedName, UserID: userID})
}

// BulkTagAssets associates a tag with multiple assets
func (s *TagService) BulkTagAssets(ctx context.Context, assetIDs []string, tagID string) error {
	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Verify tag exists
		if _, err := uow.Tag().GetByID(ctx, tagID); err != nil {
			return fmt.Errorf("tag with ID %s not found", tagID)
		}

		for _, assetID := range assetIDs {
			// Verify asset exists
			if _, err := uow.Asset().GetByID(ctx, assetID); err != nil {
				return fmt.Errorf("asset with ID %s not found", assetID)
			}

			// Check if association already exists
			existing, err := uow.AssetTag().FindByAssetID(ctx, assetID)
			if err != nil && !errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("failed to check existing association for asset %s: %w", assetID, err)
			}

			alreadyExists := false
			for _, at := range existing {
				if at.TagID == tagID {
					alreadyExists = true
					break
				}
			}

			if !alreadyExists {
				if err := uow.AssetTag().Add(ctx, assetID, tagID); err != nil {
					return fmt.Errorf("failed to tag asset %s: %w", assetID, err)
				}
			}
		}
		return nil
	})
}

// BulkTagPortfolios associates a tag with multiple portfolios
func (s *TagService) BulkTagPortfolios(ctx context.Context, portfolioIDs []string, tagID string) error {
	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Verify tag exists
		if _, err := uow.Tag().GetByID(ctx, tagID); err != nil {
			return fmt.Errorf("tag with ID %s not found", tagID)
		}

		for _, portfolioID := range portfolioIDs {
			// Verify portfolio exists
			if _, err := uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
				return fmt.Errorf("portfolio with ID %s not found", portfolioID)
			}

			// Check if association already exists
			existing, err := uow.PortfolioTag().FindByPortfolioID(ctx, portfolioID)
			if err != nil && !errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("failed to check existing association for portfolio %s: %w", portfolioID, err)
			}

			alreadyExists := false
			for _, pt := range existing {
				if pt.TagID == tagID {
					alreadyExists = true
					break
				}
			}

			if !alreadyExists {
				if err := uow.PortfolioTag().Add(ctx, portfolioID, tagID); err != nil {
					return fmt.Errorf("failed to tag portfolio %s: %w", portfolioID, err)
				}
			}
		}
		return nil
	})
}

// GetAssetsByTag retrieves all assets associated with a given tag.
func (s *TagService) GetAssetsByTag(ctx context.Context, tagID string) ([]model.Asset, error) {
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
func (s *TagService) validateTagAssociation(entityID, tagID string) error {
	if entityID == "" || tagID == "" {
		return errors.New("entity ID and tag ID must not be empty")
	}
	return nil
}

// normalizeTagName converts a tag name to a consistent format
func (s *TagService) normalizeTagName(name string) string {
	return strings.ToLower(strings.TrimSpace(name))
}
