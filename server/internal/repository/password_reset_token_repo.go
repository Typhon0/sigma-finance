package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/uptrace/bun"
)

// IPasswordResetTokenRepository defines the interface for password reset token repository operations
type IPasswordResetTokenRepository interface {
	IRepository[model.PasswordResetToken]
	// Password reset token specific methods
	GetByToken(ctx context.Context, token string) (*model.PasswordResetToken, error)
	GetByUserID(ctx context.Context, userID string) ([]model.PasswordResetToken, error)
	GetValidTokenByUserID(ctx context.Context, userID string) (*model.PasswordResetToken, error)
	MarkTokenAsUsed(ctx context.Context, tokenID string) error
	DeleteExpiredTokens(ctx context.Context) (int, error)
	DeleteUsedTokens(ctx context.Context) (int, error)
	RevokeAllUserTokens(ctx context.Context, userID string) error
}

// PasswordResetTokenRepository wraps the generic repository with password reset token specific functionality
type PasswordResetTokenRepository struct {
	*Repository[model.PasswordResetToken]
}

// NewPasswordResetTokenRepository creates a new password reset token repository
func NewPasswordResetTokenRepository(db bun.IDB) *PasswordResetTokenRepository {
	return &PasswordResetTokenRepository{
		Repository: NewRepository[model.PasswordResetToken](db),
	}
}

// GetByStringID retrieves a password reset token by string ID
func (r *PasswordResetTokenRepository) GetByStringID(ctx context.Context, id string) (*model.PasswordResetToken, error) {
	token, err := r.FindOneBy(ctx, ByColumn("id", id))
	if err != nil {
		return nil, err
	}
	return &token, nil
}

// GetByToken retrieves a password reset token by its token value
func (r *PasswordResetTokenRepository) GetByToken(ctx context.Context, token string) (*model.PasswordResetToken, error) {
	resetToken, err := r.FindOneBy(ctx, ByColumn("token", token))
	if err != nil {
		return nil, err
	}
	return &resetToken, nil
}

// GetByUserID retrieves all password reset tokens for a specific user
func (r *PasswordResetTokenRepository) GetByUserID(ctx context.Context, userID string) ([]model.PasswordResetToken, error) {
	return r.FindAllBy(ctx,
		ByColumn("user_id", userID),
		WithOrder("created_at DESC"),
	)
}

// GetValidTokenByUserID retrieves the most recent valid (unused and not expired) token for a user
func (r *PasswordResetTokenRepository) GetValidTokenByUserID(ctx context.Context, userID string) (*model.PasswordResetToken, error) {
	token, err := r.FindOneBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("user_id = ? AND used = false AND expires_at > ?", userID, time.Now()).
			Order("created_at DESC").
			Limit(1)
	})
	if err != nil {
		return nil, err
	}
	return &token, nil
}

// MarkTokenAsUsed marks a password reset token as used
func (r *PasswordResetTokenRepository) MarkTokenAsUsed(ctx context.Context, tokenID string) error {
	res, err := r.db.NewUpdate().
		Model((*model.PasswordResetToken)(nil)).
		Set("used = ?", true).
		Where("id = ?", tokenID).
		Exec(ctx)

	if err != nil {
		return err
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}

// DeleteExpiredTokens removes all expired password reset tokens
func (r *PasswordResetTokenRepository) DeleteExpiredTokens(ctx context.Context) (int, error) {
	res, err := r.db.NewDelete().
		Model((*model.PasswordResetToken)(nil)).
		Where("expires_at < ?", time.Now()).
		Exec(ctx)

	if err != nil {
		return 0, err
	}

	rowsAffected, _ := res.RowsAffected()
	return int(rowsAffected), nil
}

// DeleteUsedTokens removes all used password reset tokens
func (r *PasswordResetTokenRepository) DeleteUsedTokens(ctx context.Context) (int, error) {
	res, err := r.db.NewDelete().
		Model((*model.PasswordResetToken)(nil)).
		Where("used = true").
		Exec(ctx)

	if err != nil {
		return 0, err
	}

	rowsAffected, _ := res.RowsAffected()
	return int(rowsAffected), nil
}

// RevokeAllUserTokens marks all password reset tokens for a user as used (effectively revoking them)
func (r *PasswordResetTokenRepository) RevokeAllUserTokens(ctx context.Context, userID string) error {
	_, err := r.db.NewUpdate().
		Model((*model.PasswordResetToken)(nil)).
		Set("used = ?", true).
		Where("user_id = ? AND used = false", userID).
		Exec(ctx)

	return err
}

// CreateToken creates a new password reset token with validation
func (r *PasswordResetTokenRepository) CreateToken(ctx context.Context, token *model.PasswordResetToken) (*model.PasswordResetToken, error) {
	// Validate the token before creating
	if err := token.Validate(); err != nil {
		return nil, err
	}

	return r.Create(ctx, token)
}

// GetValidToken retrieves a valid password reset token by its token value
func (r *PasswordResetTokenRepository) GetValidToken(ctx context.Context, token string) (*model.PasswordResetToken, error) {
	resetToken, err := r.FindOneBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("token = ? AND used = false AND expires_at > ?", token, time.Now())
	})
	if err != nil {
		return nil, err
	}
	return &resetToken, nil
}
