package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/uptrace/bun"
)

// IUserRepository defines the interface for user-specific repository operations
type IUserRepository interface {
	IRepository[model.User]
	// Authentication-specific methods
	GetByEmail(ctx context.Context, email string) (*model.User, error)
	GetByEmailWithAuthMethods(ctx context.Context, email string) (*model.User, error)
	GetByStringID(ctx context.Context, id string) (*model.User, error)
	UpdatePasswordHash(ctx context.Context, userID string, passwordHash string) error
	UpdateEmailVerified(ctx context.Context, userID string, verified bool) error
	UpdateLastLogin(ctx context.Context, userID string, loginTime time.Time, ipAddress string) error
	IncrementFailedLoginCount(ctx context.Context, userID string) error
	ResetFailedLoginCount(ctx context.Context, userID string) error
	LockAccount(ctx context.Context, userID string, lockUntil time.Time) error
	UnlockAccount(ctx context.Context, userID string) error
	GetLockedUsers(ctx context.Context) ([]model.User, error)
	GetUsersWithFailedLogins(ctx context.Context, threshold int) ([]model.User, error)
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

// GetByStringID retrieves a user by string ID (for authentication methods)
func (r *UserRepository) GetByStringID(ctx context.Context, id string) (*model.User, error) {
	user, err := r.FindOneBy(ctx, ByColumn("id", id))
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetByEmail retrieves a user by email address
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	user, err := r.FindOneBy(ctx, ByColumn("email", email))
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetByEmailWithAuthMethods retrieves a user by email with their authentication methods preloaded
func (r *UserRepository) GetByEmailWithAuthMethods(ctx context.Context, email string) (*model.User, error) {
	user, err := r.FindOneBy(ctx,
		ByColumn("email", email),
		WithPreload("AuthMethods"),
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// UpdatePasswordHash updates the password hash for a user
func (r *UserRepository) UpdatePasswordHash(ctx context.Context, userID string, passwordHash string) error {
	res, err := r.db.NewUpdate().
		Model((*model.User)(nil)).
		Set("password_hash = ?", passwordHash).
		Set("updated_at = ?", time.Now()).
		Where("id = ?", userID).
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

// UpdateEmailVerified updates the email verification status for a user
func (r *UserRepository) UpdateEmailVerified(ctx context.Context, userID string, verified bool) error {
	res, err := r.db.NewUpdate().
		Model((*model.User)(nil)).
		Set("email_verified = ?", verified).
		Set("updated_at = ?", time.Now()).
		Where("id = ?", userID).
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

// UpdateLastLogin updates the last login timestamp and IP address for a user
func (r *UserRepository) UpdateLastLogin(ctx context.Context, userID string, loginTime time.Time, ipAddress string) error {
	res, err := r.db.NewUpdate().
		Model((*model.User)(nil)).
		Set("last_login_at = ?", loginTime).
		Set("updated_at = ?", time.Now()).
		Where("id = ?", userID).
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

// IncrementFailedLoginCount increments the failed login count for a user
func (r *UserRepository) IncrementFailedLoginCount(ctx context.Context, userID string) error {
	// First get the current user to check failed login count
	user, err := r.GetByStringID(ctx, userID)
	if err != nil {
		return err
	}

	newCount := user.FailedLoginCount + 1
	var lockUntil *time.Time

	// Lock account for 30 minutes after 5 failed attempts
	if newCount >= 5 {
		lockTime := time.Now().Add(30 * time.Minute)
		lockUntil = &lockTime
	}

	query := r.db.NewUpdate().
		Model((*model.User)(nil)).
		Set("failed_login_count = ?", newCount).
		Set("updated_at = ?", time.Now())

	if lockUntil != nil {
		query = query.Set("locked_until = ?", *lockUntil)
	}

	res, err := query.Where("id = ?", userID).Exec(ctx)
	if err != nil {
		return err
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}

// ResetFailedLoginCount resets the failed login count and unlocks the account
func (r *UserRepository) ResetFailedLoginCount(ctx context.Context, userID string) error {
	res, err := r.db.NewUpdate().
		Model((*model.User)(nil)).
		Set("failed_login_count = ?", 0).
		Set("locked_until = ?", nil).
		Set("updated_at = ?", time.Now()).
		Where("id = ?", userID).
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

// LockAccount locks a user account until the specified time
func (r *UserRepository) LockAccount(ctx context.Context, userID string, lockUntil time.Time) error {
	res, err := r.db.NewUpdate().
		Model((*model.User)(nil)).
		Set("locked_until = ?", lockUntil).
		Set("updated_at = ?", time.Now()).
		Where("id = ?", userID).
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

// UnlockAccount unlocks a user account
func (r *UserRepository) UnlockAccount(ctx context.Context, userID string) error {
	res, err := r.db.NewUpdate().
		Model((*model.User)(nil)).
		Set("locked_until = ?", nil).
		Set("updated_at = ?", time.Now()).
		Where("id = ?", userID).
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

// GetLockedUsers retrieves all currently locked user accounts
func (r *UserRepository) GetLockedUsers(ctx context.Context) ([]model.User, error) {
	return r.FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("locked_until IS NOT NULL AND locked_until > ?", time.Now())
	})
}

// GetUsersWithFailedLogins retrieves users with failed login count above threshold
func (r *UserRepository) GetUsersWithFailedLogins(ctx context.Context, threshold int) ([]model.User, error) {
	return r.FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("failed_login_count >= ?", threshold)
	})
}
