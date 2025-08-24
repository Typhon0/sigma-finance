package repository

import (
	"context"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// IUserRepository defines the interface for user-specific repository operations
type IUserRepository interface {
	IRepository[model.User]
}

// UserRepository wraps the generic repository with user-specific functionality
type UserRepository struct {
	*Repository[model.User]
}

// NewUserRepository creates a new user repository
func NewUserRepository(db bun.IDB) *UserRepository {
	return &UserRepository{
		Repository: NewRepository[model.User](db),
	}
}

// GetByID overrides the generic GetByID to use the correct primary key column
func (r *UserRepository) GetByID(ctx context.Context, id uint) (model.User, error) {
	return r.FindOneBy(ctx, ByColumn("user_id", id))
}

// Delete overrides the generic Delete to use the correct primary key column
func (r *UserRepository) Delete(ctx context.Context, id uint) error {
	res, err := r.db.NewDelete().Model((*model.User)(nil)).Where("user_id = ?", id).Exec(ctx)
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}
