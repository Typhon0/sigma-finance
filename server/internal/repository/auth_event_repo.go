package repository

import (
	"context"
	"time"

	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// AuthEventRepository provides data access for authentication events
type AuthEventRepository interface {
	// Create creates a new authentication event
	Create(ctx context.Context, event *model.AuthEvent) error

	// GetByID retrieves an authentication event by ID
	GetByID(ctx context.Context, id string) (*model.AuthEvent, error)

	// GetByUserID retrieves authentication events for a specific user
	GetByUserID(ctx context.Context, userID string, limit int, offset int) ([]*model.AuthEvent, error)

	// GetByEmail retrieves authentication events for a specific email
	GetByEmail(ctx context.Context, email string, limit int, offset int) ([]*model.AuthEvent, error)

	// GetByIPAddress retrieves authentication events for a specific IP address
	GetByIPAddress(ctx context.Context, ipAddress string, since time.Time, limit int) ([]*model.AuthEvent, error)

	// GetByAction retrieves authentication events by action type
	GetByAction(ctx context.Context, action string, since time.Time, limit int) ([]*model.AuthEvent, error)

	// GetFailedLoginAttempts retrieves failed login attempts for an email within a time window
	GetFailedLoginAttempts(ctx context.Context, email string, since time.Time) ([]*model.AuthEvent, error)

	// GetSuspiciousActivity retrieves suspicious authentication activity
	GetSuspiciousActivity(ctx context.Context, since time.Time, limit int) ([]*model.AuthEvent, error)

	// DeleteOldEvents deletes authentication events older than the specified time
	DeleteOldEvents(ctx context.Context, olderThan time.Time) (int64, error)
}

// authEventRepository implements AuthEventRepository
type authEventRepository struct {
	db *bun.DB
}

// NewAuthEventRepository creates a new AuthEventRepository instance
func NewAuthEventRepository(db *bun.DB) AuthEventRepository {
	return &authEventRepository{
		db: db,
	}
}

// Create creates a new authentication event
func (r *authEventRepository) Create(ctx context.Context, event *model.AuthEvent) error {
	if err := event.Validate(); err != nil {
		return err
	}

	_, err := r.db.NewInsert().Model(event).Exec(ctx)
	return err
}

// GetByID retrieves an authentication event by ID
func (r *authEventRepository) GetByID(ctx context.Context, id string) (*model.AuthEvent, error) {
	event := &model.AuthEvent{}
	err := r.db.NewSelect().
		Model(event).
		Where("id = ?", id).
		Scan(ctx)

	if err != nil {
		return nil, err
	}

	return event, nil
}

// GetByUserID retrieves authentication events for a specific user
func (r *authEventRepository) GetByUserID(ctx context.Context, userID string, limit int, offset int) ([]*model.AuthEvent, error) {
	var events []*model.AuthEvent

	err := r.db.NewSelect().
		Model(&events).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Scan(ctx)

	if err != nil {
		return nil, err
	}

	return events, nil
}

// GetByEmail retrieves authentication events for a specific email
func (r *authEventRepository) GetByEmail(ctx context.Context, email string, limit int, offset int) ([]*model.AuthEvent, error) {
	var events []*model.AuthEvent

	err := r.db.NewSelect().
		Model(&events).
		Where("email = ?", email).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Scan(ctx)

	if err != nil {
		return nil, err
	}

	return events, nil
}

// GetByIPAddress retrieves authentication events for a specific IP address
func (r *authEventRepository) GetByIPAddress(ctx context.Context, ipAddress string, since time.Time, limit int) ([]*model.AuthEvent, error) {
	var events []*model.AuthEvent

	err := r.db.NewSelect().
		Model(&events).
		Where("ip_address = ?", ipAddress).
		Where("created_at >= ?", since).
		Order("created_at DESC").
		Limit(limit).
		Scan(ctx)

	if err != nil {
		return nil, err
	}

	return events, nil
}

// GetByAction retrieves authentication events by action type
func (r *authEventRepository) GetByAction(ctx context.Context, action string, since time.Time, limit int) ([]*model.AuthEvent, error) {
	var events []*model.AuthEvent

	err := r.db.NewSelect().
		Model(&events).
		Where("action = ?", action).
		Where("created_at >= ?", since).
		Order("created_at DESC").
		Limit(limit).
		Scan(ctx)

	if err != nil {
		return nil, err
	}

	return events, nil
}

// GetFailedLoginAttempts retrieves failed login attempts for an email within a time window
func (r *authEventRepository) GetFailedLoginAttempts(ctx context.Context, email string, since time.Time) ([]*model.AuthEvent, error) {
	var events []*model.AuthEvent

	err := r.db.NewSelect().
		Model(&events).
		Where("email = ?", email).
		Where("action = ?", model.AuthActionLogin).
		Where("success = ?", false).
		Where("created_at >= ?", since).
		Order("created_at DESC").
		Scan(ctx)

	if err != nil {
		return nil, err
	}

	return events, nil
}

// GetSuspiciousActivity retrieves suspicious authentication activity
func (r *authEventRepository) GetSuspiciousActivity(ctx context.Context, since time.Time, limit int) ([]*model.AuthEvent, error) {
	var events []*model.AuthEvent

	// Query for failed login attempts, account locks, and other suspicious activities
	err := r.db.NewSelect().
		Model(&events).
		Where("created_at >= ?", since).
		Where("(success = ? AND action IN (?, ?)) OR action IN (?, ?)",
			false,
			model.AuthActionLogin,
			model.AuthActionPasswordReset,
			model.AuthActionAccountLock,
			model.AuthActionAccountUnlock).
		Order("created_at DESC").
		Limit(limit).
		Scan(ctx)

	if err != nil {
		return nil, err
	}

	return events, nil
}

// DeleteOldEvents deletes authentication events older than the specified time
func (r *authEventRepository) DeleteOldEvents(ctx context.Context, olderThan time.Time) (int64, error) {
	result, err := r.db.NewDelete().
		Model((*model.AuthEvent)(nil)).
		Where("created_at < ?", olderThan).
		Exec(ctx)

	if err != nil {
		return 0, err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	return rowsAffected, nil
}
