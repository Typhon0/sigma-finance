package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// ISyncRepository defines persistence operations for account synchronization entities.
type ISyncRepository interface {
	CreateCredential(ctx context.Context, cred *model.SyncCredential) error
	GetCredentialByID(ctx context.Context, id string) (*model.SyncCredential, error)
	GetCredentialByProvider(ctx context.Context, userID string, provider string) (*model.SyncCredential, error)
	GetCredentialByPortfolioAndProvider(ctx context.Context, userID string, portfolioID string, provider string) (*model.SyncCredential, error)
	ListCredentialsByUser(ctx context.Context, userID string) ([]*model.SyncCredential, error)
	UpdateCredential(ctx context.Context, cred *model.SyncCredential) error
	DeleteCredential(ctx context.Context, id string) error
	CreateConnection(ctx context.Context, conn *model.SyncConnection) error
	GetConnectionByID(ctx context.Context, id string) (*model.SyncConnection, error)
	GetConnectionByAccountID(ctx context.Context, accountID string) (*model.SyncConnection, error)
	ListConnectionsByPortfolio(ctx context.Context, portfolioID string) ([]*model.SyncConnection, error)
	ListConnectionsByCredentialID(ctx context.Context, credentialID string) ([]*model.SyncConnection, error)
	UpdateConnection(ctx context.Context, conn *model.SyncConnection) error
	DeleteConnection(ctx context.Context, id string) error
	CreateSyncRun(ctx context.Context, run *model.SyncRun) error
	UpdateSyncRun(ctx context.Context, run *model.SyncRun) error
	GetSyncRunByID(ctx context.Context, id string) (*model.SyncRun, error)
	CreateAuthSession(ctx context.Context, session *model.SyncAuthSession) error
	GetAuthSessionByID(ctx context.Context, id string) (*model.SyncAuthSession, error)
	ListActiveAuthSessionsByProvider(ctx context.Context, userID string, provider string) ([]*model.SyncAuthSession, error)
	UpdateAuthSession(ctx context.Context, session *model.SyncAuthSession) error
	DeleteAuthSession(ctx context.Context, id string) error
	CreateRawEvent(ctx context.Context, event *model.SyncRawEvent) error
	ListRawEventsByConnection(ctx context.Context, connectionID string) ([]*model.SyncRawEvent, error)
}

// SyncRepository implements ISyncRepository using Bun ORM.
type SyncRepository struct {
	db bun.IDB
}

// NewSyncRepository creates a new SyncRepository.
func NewSyncRepository(db bun.IDB) *SyncRepository {
	return &SyncRepository{db: db}
}

// CreateCredential persists a new sync credential, storing encrypted data.
// Handles upsert if a credential already exists for (user_id, provider).
func (r *SyncRepository) CreateCredential(ctx context.Context, cred *model.SyncCredential) error {
	if cred.Status == "" {
		cred.Status = model.SyncCredentialStatusActive
	}
	now := time.Now()
	if cred.CreatedAt.IsZero() {
		cred.CreatedAt = now
	}
	if cred.UpdatedAt.IsZero() {
		cred.UpdatedAt = now
	}

	q := r.db.NewInsert().Model(cred)
	if cred.ID == "" {
		q = q.ExcludeColumn("id")
	}
	if cred.UserID != "" {
		if cred.PortfolioID != nil && *cred.PortfolioID != "" {
			q = q.On("CONFLICT (user_id, portfolio_id, provider) WHERE portfolio_id IS NOT NULL DO UPDATE").
				Set("encrypted_data = EXCLUDED.encrypted_data").
				Set("status = EXCLUDED.status").
				Set("updated_at = EXCLUDED.updated_at")
		} else {
			q = q.On("CONFLICT (user_id, provider) WHERE user_id IS NOT NULL AND portfolio_id IS NULL DO UPDATE").
				Set("encrypted_data = EXCLUDED.encrypted_data").
				Set("status = EXCLUDED.status").
				Set("updated_at = EXCLUDED.updated_at")
		}
	}

	return q.Returning("*").Scan(ctx)
}

// GetCredentialByID retrieves a sync credential by primary key.
func (r *SyncRepository) GetCredentialByID(ctx context.Context, id string) (*model.SyncCredential, error) {
	var cred model.SyncCredential
	err := r.db.NewSelect().Model(&cred).Where("sc.id = ?", id).Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || isInvalidIDError(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &cred, nil
}

// GetCredentialByProvider retrieves a sync credential for a provider.
// If userID is provided, it first searches for a user-specific credential,
// falling back to a system-wide credential if none exists.
// If userID is empty, it searches strictly for a system-wide credential.
func (r *SyncRepository) GetCredentialByProvider(ctx context.Context, userID string, provider string) (*model.SyncCredential, error) {
	var cred model.SyncCredential
	q := r.db.NewSelect().Model(&cred)

	if userID == "" {
		q = q.Where("sc.is_system = TRUE AND sc.provider = ?", provider)
	} else {
		q = q.Where("(sc.user_id = ? OR (sc.is_system = TRUE AND sc.user_id IS NULL)) AND sc.provider = ?", userID, provider).
			OrderExpr("sc.is_system ASC").
			Limit(1)
	}

	err := q.Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || isInvalidIDError(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &cred, nil
}

// GetCredentialByPortfolioAndProvider retrieves a sync credential specifically for a portfolio,
// falling back to user-level global credential, and then system credential.
func (r *SyncRepository) GetCredentialByPortfolioAndProvider(ctx context.Context, userID string, portfolioID string, provider string) (*model.SyncCredential, error) {
	var cred model.SyncCredential
	q := r.db.NewSelect().Model(&cred)

	if userID == "" {
		q = q.Where("sc.is_system = TRUE AND sc.provider = ?", provider)
	} else if portfolioID != "" {
		q = q.Where("((sc.user_id = ? AND sc.portfolio_id = ?) OR (sc.user_id = ? AND sc.portfolio_id IS NULL) OR (sc.is_system = TRUE AND sc.user_id IS NULL)) AND sc.provider = ?", userID, portfolioID, userID, provider).
			OrderExpr("CASE WHEN sc.portfolio_id = ? THEN 1 WHEN sc.user_id = ? AND sc.portfolio_id IS NULL THEN 2 ELSE 3 END ASC", portfolioID, userID).
			Limit(1)
	} else {
		q = q.Where("(sc.user_id = ? OR (sc.is_system = TRUE AND sc.user_id IS NULL)) AND sc.provider = ?", userID, provider).
			OrderExpr("sc.is_system ASC").
			Limit(1)
	}

	err := q.Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || isInvalidIDError(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &cred, nil
}

// ListConnectionsByCredentialID retrieves all sync connections associated with a specific credential.
func (r *SyncRepository) ListConnectionsByCredentialID(ctx context.Context, credentialID string) ([]*model.SyncConnection, error) {
	var conns []*model.SyncConnection
	err := r.db.NewSelect().
		Model(&conns).
		Relation("Credential").
		Relation("Account").
		Where("sconn.credential_id = ?", credentialID).
		Order("sconn.created_at ASC").
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return conns, nil
}

// ListCredentialsByUser retrieves all credentials for a given user, including system credentials.
func (r *SyncRepository) ListCredentialsByUser(ctx context.Context, userID string) ([]*model.SyncCredential, error) {
	var creds []*model.SyncCredential
	err := r.db.NewSelect().
		Model(&creds).
		Where("sc.user_id = ? OR (sc.is_system = TRUE AND sc.user_id IS NULL)", userID).
		Order("sc.created_at DESC").
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return creds, nil
}

// UpdateCredential updates an existing sync credential in the database.
func (r *SyncRepository) UpdateCredential(ctx context.Context, cred *model.SyncCredential) error {
	cred.UpdatedAt = time.Now()
	res, err := r.db.NewUpdate().Model(cred).WherePK().Exec(ctx)
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteCredential removes a credential by ID.
func (r *SyncRepository) DeleteCredential(ctx context.Context, id string) error {
	res, err := r.db.NewDelete().Model((*model.SyncCredential)(nil)).Where("id = ?", id).Exec(ctx)
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// CreateConnection links a portfolio to an external provider account.
func (r *SyncRepository) CreateConnection(ctx context.Context, conn *model.SyncConnection) error {
	if conn.SyncStatus == "" {
		conn.SyncStatus = model.SyncConnectionStatusIdle
	}
	now := time.Now()
	if conn.CreatedAt.IsZero() {
		conn.CreatedAt = now
	}
	if conn.UpdatedAt.IsZero() {
		conn.UpdatedAt = now
	}

	var err error
	if conn.ID == "" {
		err = r.db.NewInsert().Model(conn).ExcludeColumn("id").Returning("*").Scan(ctx)
	} else {
		err = r.db.NewInsert().Model(conn).Returning("*").Scan(ctx)
	}
	return err
}

// GetConnectionByID retrieves a sync connection by ID, including its associated credential and account.
func (r *SyncRepository) GetConnectionByID(ctx context.Context, id string) (*model.SyncConnection, error) {
	var conn model.SyncConnection
	err := r.db.NewSelect().
		Model(&conn).
		Relation("Credential").
		Relation("Account").
		Where("sconn.id = ?", id).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || isInvalidIDError(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &conn, nil
}

// GetConnectionByAccountID retrieves a sync connection by associated account ID.
func (r *SyncRepository) GetConnectionByAccountID(ctx context.Context, accountID string) (*model.SyncConnection, error) {
	var conn model.SyncConnection
	err := r.db.NewSelect().
		Model(&conn).
		Relation("Credential").
		Relation("Account").
		Where("sconn.account_id = ?", accountID).
		Limit(1).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || isInvalidIDError(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &conn, nil
}

// ListConnectionsByPortfolio retrieves all active sync connections for a portfolio.
func (r *SyncRepository) ListConnectionsByPortfolio(ctx context.Context, portfolioID string) ([]*model.SyncConnection, error) {
	var conns []*model.SyncConnection
	err := r.db.NewSelect().
		Model(&conns).
		Relation("Credential").
		Relation("Account").
		Where("sconn.portfolio_id = ?", portfolioID).
		Order("sconn.created_at ASC").
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return conns, nil
}

// UpdateConnection updates status and sync metadata for an existing connection.
func (r *SyncRepository) UpdateConnection(ctx context.Context, conn *model.SyncConnection) error {
	conn.UpdatedAt = time.Now()
	res, err := r.db.NewUpdate().Model(conn).WherePK().Exec(ctx)
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteConnection removes a sync connection by ID.
func (r *SyncRepository) DeleteConnection(ctx context.Context, id string) error {
	res, err := r.db.NewDelete().Model((*model.SyncConnection)(nil)).Where("id = ?", id).Exec(ctx)
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// CreateSyncRun creates an audit run entry tracking execution progress and status.
func (r *SyncRepository) CreateSyncRun(ctx context.Context, run *model.SyncRun) error {
	if run.Status == "" {
		run.Status = model.SyncRunStatusInProgress
	}
	if run.StartedAt.IsZero() {
		run.StartedAt = time.Now()
	}

	var err error
	if run.ID == "" {
		err = r.db.NewInsert().Model(run).ExcludeColumn("id").Returning("*").Scan(ctx)
	} else {
		err = r.db.NewInsert().Model(run).Returning("*").Scan(ctx)
	}
	return err
}

// UpdateSyncRun updates progress counters, error messages, and completion status for a run.
func (r *SyncRepository) UpdateSyncRun(ctx context.Context, run *model.SyncRun) error {
	res, err := r.db.NewUpdate().Model(run).WherePK().Exec(ctx)
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// GetSyncRunByID retrieves a sync execution record by its primary key.
func (r *SyncRepository) GetSyncRunByID(ctx context.Context, id string) (*model.SyncRun, error) {
	var run model.SyncRun
	err := r.db.NewSelect().
		Model(&run).
		Relation("Connection").
		Where("sr.id = ?", id).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || isInvalidIDError(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &run, nil
}

// CreateAuthSession persists a new temporary multi-step authentication session.
func (r *SyncRepository) CreateAuthSession(ctx context.Context, session *model.SyncAuthSession) error {
	now := time.Now()
	if session.CreatedAt.IsZero() {
		session.CreatedAt = now
	}
	if session.UpdatedAt.IsZero() {
		session.UpdatedAt = now
	}

	var err error
	if session.ID == "" {
		err = r.db.NewInsert().Model(session).ExcludeColumn("id").Returning("*").Scan(ctx)
	} else {
		err = r.db.NewInsert().Model(session).Returning("*").Scan(ctx)
	}
	return err
}

// GetAuthSessionByID retrieves an authentication session by primary key.
func (r *SyncRepository) GetAuthSessionByID(ctx context.Context, id string) (*model.SyncAuthSession, error) {
	var session model.SyncAuthSession
	err := r.db.NewSelect().Model(&session).Where("sas.id = ?", id).Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || isInvalidIDError(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &session, nil
}

// ListActiveAuthSessionsByProvider returns non-expired pending auth sessions for a user and provider.
func (r *SyncRepository) ListActiveAuthSessionsByProvider(ctx context.Context, userID string, provider string) ([]*model.SyncAuthSession, error) {
	var sessions []*model.SyncAuthSession
	err := r.db.NewSelect().Model(&sessions).
		Where("sas.user_id = ? AND sas.provider = ? AND sas.status = ? AND sas.expires_at > ?",
			userID, provider, model.SyncAuthSessionStatusWaitingForConfirmation, time.Now()).
		Order("sas.created_at DESC").
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return sessions, nil
}

// UpdateAuthSession updates status and timestamps on an authorization session.
func (r *SyncRepository) UpdateAuthSession(ctx context.Context, session *model.SyncAuthSession) error {
	session.UpdatedAt = time.Now()
	res, err := r.db.NewUpdate().Model(session).WherePK().Exec(ctx)
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteAuthSession removes an expired or completed authorization session.
func (r *SyncRepository) DeleteAuthSession(ctx context.Context, id string) error {
	_, err := r.db.NewDelete().Model((*model.SyncAuthSession)(nil)).Where("id = ?", id).Exec(ctx)
	return err
}

// CreateRawEvent persists a raw provider event idempotently using (connection_id, source_stream, external_event_id).
func (r *SyncRepository) CreateRawEvent(ctx context.Context, event *model.SyncRawEvent) error {
	now := time.Now()
	if event.CreatedAt.IsZero() {
		event.CreatedAt = now
	}
	_, err := r.db.NewInsert().Model(event).
		On("CONFLICT (connection_id, source_stream, external_event_id) DO UPDATE").
		Set("status = EXCLUDED.status").
		Set("raw_payload = EXCLUDED.raw_payload").
		Exec(ctx)
	return err
}

// ListRawEventsByConnection retrieves recorded raw provider events for a connection.
func (r *SyncRepository) ListRawEventsByConnection(ctx context.Context, connectionID string) ([]*model.SyncRawEvent, error) {
	var events []*model.SyncRawEvent
	err := r.db.NewSelect().Model(&events).
		Where("sre.connection_id = ?", connectionID).
		OrderExpr("sre.occurred_at DESC NULLS LAST, sre.created_at DESC").
		Scan(ctx)
	return events, err
}
