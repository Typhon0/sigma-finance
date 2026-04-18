package repository

import (
	"context"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// IPortfolioTagRepository defines the interface for portfolio_tag data operations.
type IPortfolioTagRepository interface {
	Add(ctx context.Context, portfolioID, tagID string) error
	Remove(ctx context.Context, portfolioID, tagID string) error
	FindByPortfolioID(ctx context.Context, portfolioID string) ([]*model.PortfolioTag, error)
	FindByTagID(ctx context.Context, tagID string) ([]*model.PortfolioTag, error)
}

// PortfolioTagRepository implements IPortfolioTagRepository.
type PortfolioTagRepository struct {
	db bun.IDB
}

// NewPortfolioTagRepository creates a new PortfolioTagRepository.
func NewPortfolioTagRepository(db bun.IDB) *PortfolioTagRepository {
	return &PortfolioTagRepository{db: db}
}

// Add creates a new association between a portfolio and a tag.
func (r *PortfolioTagRepository) Add(ctx context.Context, portfolioID, tagID string) error {
	portfolioTag := &model.PortfolioTag{
		PortfolioID: portfolioID,
		TagID:       tagID,
	}
	_, err := r.db.NewInsert().Model(portfolioTag).Exec(ctx)
	return err
}

// Remove deletes an association between a portfolio and a tag.
func (r *PortfolioTagRepository) Remove(ctx context.Context, portfolioID, tagID string) error {
	_, err := r.db.NewDelete().
		Model((*model.PortfolioTag)(nil)).
		Where("portfolio_id = ? AND tag_id = ?", portfolioID, tagID).
		Exec(ctx)
	return err
}

// FindByPortfolioID finds all tags associated with a given portfolio.
func (r *PortfolioTagRepository) FindByPortfolioID(ctx context.Context, portfolioID string) ([]*model.PortfolioTag, error) {
	var portfolioTags []*model.PortfolioTag
	err := r.db.NewSelect().
		Model(&portfolioTags).
		Where("portfolio_id = ?", portfolioID).
		Scan(ctx)
	return portfolioTags, err
}

// FindByTagID finds all portfolios associated with a given tag.
func (r *PortfolioTagRepository) FindByTagID(ctx context.Context, tagID string) ([]*model.PortfolioTag, error) {
	var portfolioTags []*model.PortfolioTag
	err := r.db.NewSelect().
		Model(&portfolioTags).
		Where("tag_id = ?", tagID).
		Scan(ctx)
	return portfolioTags, err
}
