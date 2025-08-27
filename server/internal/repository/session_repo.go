package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/uptrace/bun"
)

// ISessionRepository defines the interface for session-specific repository operations
type ISessionRepository interface {
	IRepository[model.Session]
	// Session-specific methods
	GetByStringID(ctx context.Context, id string) (*model.Session, error)
	GetByToken(ctx context.Context, token string) (*model.Session, error)
	GetByRefreshToken(ctx context.Context, refreshToken string) (*model.Session, error)
	GetByUserID(ctx context.Context, userID string) ([]model.Session, error)
	GetActiveSessionsByUserID(ctx context.Context, userID string) ([]model.Session, error)
	RevokeSession(ctx context.Context, token string) error
	RevokeAllUserSessions(ctx context.Context, userID string) error
	RevokeExpiredSessions(ctx context.Context) (int, error)
	UpdateSessionExpiry(ctx context.Context, sessionID string, expiresAt time.Time) error
	GetExpiredSessions(ctx context.Context) ([]model.Session, error)
	RefreshSession(ctx context.Context, sessionID string, newToken, newRefreshToken string, expiresAt time.Time) error
}

// SessionRepository wraps the generic repository with session-specific functionality
type SessionRepository struct {
	*Repository[model.Session]
}

// NewSessionRepository creates a new session repository
func NewSessionRepository(db bun.IDB) *SessionRepository {
	return &SessionRepository{
		Repository: NewRepository[model.Session](db),
	}
}

// GetByStringID retrieves a session by string ID
func (r *SessionRepository) GetByStringID(ctx context.Context, id string) (*model.Session, error) {
	session, err := r.FindOneBy(ctx, ByColumn("id", id))
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// GetByToken retrieves a session by its token
func (r *SessionRepository) GetByToken(ctx context.Context, token string) (*model.Session, error) {
	session, err := r.FindOneBy(ctx, ByColumn("token", token))
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// GetByRefreshToken retrieves a session by its refresh token
func (r *SessionRepository) GetByRefreshToken(ctx context.Context, refreshToken string) (*model.Session, error) {
	session, err := r.FindOneBy(ctx, ByColumn("refresh_token", refreshToken))
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// GetByUserID retrieves all sessions for a specific user
func (r *SessionRepository) GetByUserID(ctx context.Context, userID string) ([]model.Session, error) {
	return r.FindAllBy(ctx,
		ByColumn("user_id", userID),
		WithOrder("created_at DESC"),
	)
}

// GetActiveSessionsByUserID retrieves all active (non-expired) sessions for a specific user
func (r *SessionRepository) GetActiveSessionsByUserID(ctx context.Context, userID string) ([]model.Session, error) {
	return r.FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("user_id = ? AND expires_at > ?", userID, time.Now()).
			Order("created_at DESC")
	})
}

// RevokeSession revokes a session by marking it as expired
func (r *SessionRepository) RevokeSession(ctx context.Context, token string) error {
	res, err := r.db.NewUpdate().
		Model((*model.Session)(nil)).
		Set("expires_at = ?", time.Now().Add(-1*time.Hour)). // Set to past time to expire it
		Where("token = ?", token).
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

// RevokeAllUserSessions revokes all sessions for a specific user
func (r *SessionRepository) RevokeAllUserSessions(ctx context.Context, userID string) error {
	_, err := r.db.NewUpdate().
		Model((*model.Session)(nil)).
		Set("expires_at = ?", time.Now().Add(-1*time.Hour)). // Set to past time to expire them
		Where("user_id = ?", userID).
		Exec(ctx)

	return err
}

// RevokeExpiredSessions removes expired sessions from the database
func (r *SessionRepository) RevokeExpiredSessions(ctx context.Context) (int, error) {
	res, err := r.db.NewDelete().
		Model((*model.Session)(nil)).
		Where("expires_at < ?", time.Now()).
		Exec(ctx)

	if err != nil {
		return 0, err
	}

	rowsAffected, _ := res.RowsAffected()
	return int(rowsAffected), nil
}

// UpdateSessionExpiry updates the expiration time of a session
func (r *SessionRepository) UpdateSessionExpiry(ctx context.Context, sessionID string, expiresAt time.Time) error {
	res, err := r.db.NewUpdate().
		Model((*model.Session)(nil)).
		Set("expires_at = ?", expiresAt).
		Where("id = ?", sessionID).
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

// GetExpiredSessions retrieves all expired sessions
func (r *SessionRepository) GetExpiredSessions(ctx context.Context) ([]model.Session, error) {
	return r.FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("expires_at < ?", time.Now()).
			Order("expires_at ASC")
	})
}

// CreateSession creates a new session with validation
func (r *SessionRepository) CreateSession(ctx context.Context, session *model.Session) (*model.Session, error) {
	// Validate the session before creating
	if err := session.Validate(); err != nil {
		return nil, err
	}

	return r.Create(ctx, session)
}

// RefreshSession updates the session tokens and expiration
func (r *SessionRepository) RefreshSession(ctx context.Context, sessionID string, newToken, newRefreshToken string, expiresAt time.Time) error {
	res, err := r.db.NewUpdate().
		Model((*model.Session)(nil)).
		Set("token = ?", newToken).
		Set("refresh_token = ?", newRefreshToken).
		Set("expires_at = ?", expiresAt).
		Where("id = ?", sessionID).
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
