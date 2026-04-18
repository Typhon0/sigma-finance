package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/uptrace/bun"
)

// IEmailVerificationTokenRepository defines the interface for email verification token repository operations
type IEmailVerificationTokenRepository interface {
	IRepository[model.EmailVerificationToken]
	// Email verification token specific methods
	GetByToken(ctx context.Context, token string) (*model.EmailVerificationToken, error)
	GetByUserID(ctx context.Context, userID string) ([]model.EmailVerificationToken, error)
	GetValidTokenByUserID(ctx context.Context, userID string) (*model.EmailVerificationToken, error)
	MarkTokenAsUsed(ctx context.Context, tokenID string) error
	DeleteExpiredTokens(ctx context.Context) (int, error)
	DeleteUsedTokens(ctx context.Context) (int, error)
	RevokeAllUserTokens(ctx context.Context, userID string) error
}

// EmailVerificationTokenRepository wraps the generic repository with email verification token specific functionality
type EmailVerificationTokenRepository struct {
	*Repository[model.EmailVerificationToken]
}

// NewEmailVerificationTokenRepository creates a new email verification token repository
func NewEmailVerificationTokenRepository(db bun.IDB) *EmailVerificationTokenRepository {
	return &EmailVerificationTokenRepository{
		Repository: NewRepository[model.EmailVerificationToken](db),
	}
}



// GetByToken retrieves an email verification token by its token value
func (r *EmailVerificationTokenRepository) GetByToken(ctx context.Context, token string) (*model.EmailVerificationToken, error) {
	return r.FindOneBy(ctx, ByColumn("token", token))
}

// GetByUserID retrieves all email verification tokens for a specific user
func (r *EmailVerificationTokenRepository) GetByUserID(ctx context.Context, userID string) ([]model.EmailVerificationToken, error) {
	return r.FindAllBy(ctx,
		ByColumn("user_id", userID),
		WithOrder("created_at DESC"),
	)
}

// GetValidTokenByUserID retrieves the most recent valid (unused and not expired) token for a user
func (r *EmailVerificationTokenRepository) GetValidTokenByUserID(ctx context.Context, userID string) (*model.EmailVerificationToken, error) {
	return r.FindOneBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("user_id = ? AND used = false AND expires_at > ?", userID, time.Now()).
			Order("created_at DESC").
			Limit(1)
	})
}

// MarkTokenAsUsed marks an email verification token as used
func (r *EmailVerificationTokenRepository) MarkTokenAsUsed(ctx context.Context, tokenID string) error {
	res, err := r.db.NewUpdate().
		Model((*model.EmailVerificationToken)(nil)).
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

// DeleteExpiredTokens removes all expired email verification tokens
func (r *EmailVerificationTokenRepository) DeleteExpiredTokens(ctx context.Context) (int, error) {
	res, err := r.db.NewDelete().
		Model((*model.EmailVerificationToken)(nil)).
		Where("expires_at < ?", time.Now()).
		Exec(ctx)

	if err != nil {
		return 0, err
	}

	rowsAffected, _ := res.RowsAffected()
	return int(rowsAffected), nil
}

// DeleteUsedTokens removes all used email verification tokens
func (r *EmailVerificationTokenRepository) DeleteUsedTokens(ctx context.Context) (int, error) {
	res, err := r.db.NewDelete().
		Model((*model.EmailVerificationToken)(nil)).
		Where("used = true").
		Exec(ctx)

	if err != nil {
		return 0, err
	}

	rowsAffected, _ := res.RowsAffected()
	return int(rowsAffected), nil
}

// RevokeAllUserTokens marks all email verification tokens for a user as used (effectively revoking them)
func (r *EmailVerificationTokenRepository) RevokeAllUserTokens(ctx context.Context, userID string) error {
	_, err := r.db.NewUpdate().
		Model((*model.EmailVerificationToken)(nil)).
		Set("used = ?", true).
		Where("user_id = ? AND used = false", userID).
		Exec(ctx)

	return err
}

// CreateToken creates a new email verification token with validation
func (r *EmailVerificationTokenRepository) CreateToken(ctx context.Context, token *model.EmailVerificationToken) (*model.EmailVerificationToken, error) {
	// Validate the token before creating
	if err := token.Validate(); err != nil {
		return nil, err
	}

	return r.Create(ctx, token)
}

// GetValidToken retrieves a valid email verification token by its token value
func (r *EmailVerificationTokenRepository) GetValidToken(ctx context.Context, token string) (*model.EmailVerificationToken, error) {
	return r.FindOneBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("token = ? AND used = false AND expires_at > ?", token, time.Now())
	})
}
