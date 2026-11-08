package model

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/uptrace/bun"
)

// Sync Provider Constants
const (
	SyncProviderKraken        = "KRAKEN"
	SyncProviderSnapTrade     = "SNAPTRADE"
	SyncProviderGoCardless    = "GOCARDLESS"
	SyncProviderTradeRepublic = "TRADEREPUBLIC"
	SyncProviderEnableBanking = "ENABLEBANKING"
	SyncProviderWoob          = "WOOB"
	SyncProviderManual        = "MANUAL"
)

// SyncCredentialStatus represents the operational status of an external sync credential.
type SyncCredentialStatus string

const (
	SyncCredentialStatusActive  SyncCredentialStatus = "ACTIVE"
	SyncCredentialStatusExpired SyncCredentialStatus = "EXPIRED"
	SyncCredentialStatusInvalid SyncCredentialStatus = "INVALID"
	SyncCredentialStatusRevoked SyncCredentialStatus = "REVOKED"
)

func (s SyncCredentialStatus) IsValid() bool {
	switch s {
	case SyncCredentialStatusActive, SyncCredentialStatusExpired, SyncCredentialStatusInvalid, SyncCredentialStatusRevoked:
		return true
	}
	return false
}

// SyncConnectionStatus represents the operational status of an active sync connection.
type SyncConnectionStatus string

const (
	SyncConnectionStatusIdle    SyncConnectionStatus = "IDLE"
	SyncConnectionStatusSyncing SyncConnectionStatus = "SYNCING"
	SyncConnectionStatusSuccess SyncConnectionStatus = "SUCCESS"
	SyncConnectionStatusFailed  SyncConnectionStatus = "FAILED"
)

func (s SyncConnectionStatus) IsValid() bool {
	switch s {
	case SyncConnectionStatusIdle, SyncConnectionStatusSyncing, SyncConnectionStatusSuccess, SyncConnectionStatusFailed:
		return true
	}
	return false
}

// SyncRunStatus represents the status of a specific synchronization audit run.
type SyncRunStatus string

const (
	SyncRunStatusInProgress SyncRunStatus = "IN_PROGRESS"
	SyncRunStatusCompleted  SyncRunStatus = "COMPLETED"
	SyncRunStatusFailed     SyncRunStatus = "FAILED"
)

func (s SyncRunStatus) IsValid() bool {
	switch s {
	case SyncRunStatusInProgress, SyncRunStatusCompleted, SyncRunStatusFailed:
		return true
	}
	return false
}

// SyncCredential stores encrypted API keys, secrets, or tokens for an external financial provider.
type SyncCredential struct {
	bun.BaseModel `bun:"table:sigma_finance.sync_credentials,alias:sc"`

	ID            string               `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID        string               `bun:"user_id,nullzero,type:uuid"` // Nullable in DB for system-wide keys
	IsSystem      bool                 `bun:"is_system,notnull,default:false"`
	Provider      string               `bun:"provider,notnull"`
	EncryptedData string               `bun:"encrypted_data,notnull"`
	Status        SyncCredentialStatus `bun:"status,notnull,default:'ACTIVE'"`
	CreatedAt     time.Time            `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt     time.Time            `bun:"updated_at,nullzero,notnull,default:current_timestamp"`

	RawData string `bun:"-"` // Transient plaintext JSON payload for Encrypt / Decrypt

	// Relations
	User *User `bun:"rel:belongs-to,join:user_id=id"`
}

// Implement Entity interface
func (s SyncCredential) GetID() string             { return s.ID }
func (s *SyncCredential) SetID(id string)          { s.ID = id }
func (s SyncCredential) GetCreatedAt() time.Time   { return s.CreatedAt }
func (s *SyncCredential) SetCreatedAt(t time.Time) { s.CreatedAt = t }
func (s SyncCredential) GetUpdatedAt() time.Time   { return s.UpdatedAt }
func (s *SyncCredential) SetUpdatedAt(t time.Time) { s.UpdatedAt = t }

// Validate checks business rules for SyncCredential
func (s *SyncCredential) Validate() error {
	if strings.TrimSpace(s.Provider) == "" {
		return errors.New("provider is required")
	}
	if !s.IsSystem && strings.TrimSpace(s.UserID) == "" {
		return errors.New("user ID is required")
	}
	if strings.TrimSpace(s.RawData) == "" && strings.TrimSpace(s.EncryptedData) == "" {
		return errors.New("credential data is required")
	}
	if s.Status == "" {
		s.Status = SyncCredentialStatusActive
	} else if !s.Status.IsValid() {
		return fmt.Errorf("invalid credential status: %s", s.Status)
	}
	return nil
}

// Encrypt encrypts the RawData using AES-256-GCM and stores base64 ciphertext in EncryptedData.
func (s *SyncCredential) Encrypt() error {
	if s.RawData == "" {
		if s.EncryptedData != "" {
			return nil
		}
		return errors.New("raw credential data is empty")
	}

	key, err := getEncryptionKey()
	if err != nil {
		return err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return fmt.Errorf("failed to create cipher block: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(s.RawData), nil)
	s.EncryptedData = base64.StdEncoding.EncodeToString(ciphertext)
	return nil
}

// Decrypt decrypts EncryptedData using AES-256-GCM and returns the plaintext JSON payload.
func (s *SyncCredential) Decrypt() (string, error) {
	if s.EncryptedData == "" {
		if s.RawData != "" {
			return s.RawData, nil
		}
		return "", errors.New("encrypted credential data is empty")
	}

	key, err := getEncryptionKey()
	if err != nil {
		return "", err
	}

	data, err := base64.StdEncoding.DecodeString(s.EncryptedData)
	if err != nil {
		return "", fmt.Errorf("failed to decode encrypted data: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher block: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt ciphertext: %w", err)
	}

	s.RawData = string(plaintext)
	return s.RawData, nil
}

// SyncConnection represents an active linkage between a user's portfolio and an external institution.
type SyncConnection struct {
	bun.BaseModel `bun:"table:sigma_finance.sync_connections,alias:sconn"`

	ID                    string               `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID                string               `bun:"user_id,notnull,type:uuid"`
	PortfolioID           string               `bun:"portfolio_id,notnull,type:uuid"`
	CredentialID          string               `bun:"credential_id,notnull,type:uuid"`
	AccountID             *string              `bun:"account_id,type:uuid"`
	Provider              string               `bun:"provider,notnull"`
	ExternalInstitutionID string               `bun:"external_institution_id,notnull"`
	ExternalAccountID     string               `bun:"external_account_id,notnull"`
	CashAccountID         *string              `bun:"cash_account_id"`
	InstitutionName       string               `bun:"institution_name,notnull"`
	SyncStatus            SyncConnectionStatus `bun:"sync_status,notnull,default:'IDLE'"`
	LastSyncAt            *time.Time           `bun:"last_sync_at"`
	LastError             *string              `bun:"last_error"`
	Metadata              json.RawMessage      `bun:"metadata,type:jsonb"`
	ProviderMetadata      json.RawMessage      `bun:"provider_metadata,type:jsonb"`
	CreatedAt             time.Time            `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt             time.Time            `bun:"updated_at,nullzero,notnull,default:current_timestamp"`

	// Relations
	User       *User           `bun:"rel:belongs-to,join:user_id=id"`
	Portfolio  *Portfolio      `bun:"rel:belongs-to,join:portfolio_id=id"`
	Credential *SyncCredential `bun:"rel:belongs-to,join:credential_id=id"`
	Account    *Account        `bun:"rel:belongs-to,join:account_id=id"`
	SyncRuns   []*SyncRun      `bun:"rel:has-many,join:id=connection_id"`
}

// Implement Entity interface
func (s SyncConnection) GetID() string             { return s.ID }
func (s *SyncConnection) SetID(id string)          { s.ID = id }
func (s SyncConnection) GetCreatedAt() time.Time   { return s.CreatedAt }
func (s *SyncConnection) SetCreatedAt(t time.Time) { s.CreatedAt = t }
func (s SyncConnection) GetUpdatedAt() time.Time   { return s.UpdatedAt }
func (s *SyncConnection) SetUpdatedAt(t time.Time) { s.UpdatedAt = t }

// Validate checks business rules for SyncConnection
func (s *SyncConnection) Validate() error {
	if strings.TrimSpace(s.UserID) == "" {
		return errors.New("user ID is required")
	}
	if strings.TrimSpace(s.PortfolioID) == "" {
		return errors.New("portfolio ID is required")
	}
	if strings.TrimSpace(s.CredentialID) == "" {
		return errors.New("credential ID is required")
	}
	if strings.TrimSpace(s.Provider) == "" {
		return errors.New("provider is required")
	}
	if strings.TrimSpace(s.ExternalAccountID) == "" {
		return errors.New("external account ID is required")
	}
	if s.SyncStatus == "" {
		s.SyncStatus = SyncConnectionStatusIdle
	} else if !s.SyncStatus.IsValid() {
		return fmt.Errorf("invalid sync connection status: %s", s.SyncStatus)
	}
	return nil
}

// SyncRun records an execution audit log and status tracker for a sync run.
type SyncRun struct {
	bun.BaseModel `bun:"table:sigma_finance.sync_runs,alias:sr"`

	ID            string        `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	ConnectionID  string        `bun:"connection_id,notnull,type:uuid"`
	Status        SyncRunStatus `bun:"status,notnull,default:'IN_PROGRESS'"`
	ItemsImported int           `bun:"items_imported,notnull,default:0"`
	ItemsUpdated  int           `bun:"items_updated,notnull,default:0"`
	ErrorMessage  *string       `bun:"error_message"`
	StartedAt     time.Time     `bun:"started_at,nullzero,notnull,default:current_timestamp"`
	CompletedAt   *time.Time    `bun:"completed_at"`

	// Relations
	Connection *SyncConnection `bun:"rel:belongs-to,join:connection_id=id"`
}

// Implement Entity interface
func (r SyncRun) GetID() string             { return r.ID }
func (r *SyncRun) SetID(id string)          { r.ID = id }
func (r SyncRun) GetCreatedAt() time.Time   { return r.StartedAt }
func (r *SyncRun) SetCreatedAt(t time.Time) { r.StartedAt = t }
func (r SyncRun) GetUpdatedAt() time.Time   { return time.Time{} }
func (r *SyncRun) SetUpdatedAt(time.Time)   {}

// Validate checks business rules for SyncRun
func (r *SyncRun) Validate() error {
	if strings.TrimSpace(r.ConnectionID) == "" {
		return errors.New("connection ID is required")
	}
	if r.Status == "" {
		r.Status = SyncRunStatusInProgress
	} else if !r.Status.IsValid() {
		return fmt.Errorf("invalid sync run status: %s", r.Status)
	}
	return nil
}

// SyncAuthSessionStatus represents the state of a multi-step login session.
type SyncAuthSessionStatus string

const (
	SyncAuthSessionStatusWaitingForConfirmation SyncAuthSessionStatus = "WAITING_FOR_CONFIRMATION"
	SyncAuthSessionStatusApproved               SyncAuthSessionStatus = "APPROVED"
	SyncAuthSessionStatusRejected               SyncAuthSessionStatus = "REJECTED"
	SyncAuthSessionStatusExpired                SyncAuthSessionStatus = "EXPIRED"
	SyncAuthSessionStatusCompleted              SyncAuthSessionStatus = "COMPLETED"
)

func (s SyncAuthSessionStatus) IsValid() bool {
	switch s {
	case SyncAuthSessionStatusWaitingForConfirmation, SyncAuthSessionStatusApproved,
		SyncAuthSessionStatusRejected, SyncAuthSessionStatusExpired, SyncAuthSessionStatusCompleted:
		return true
	}
	return false
}

// SyncAuthSession stores encrypted, temporary authorization state during multi-step logins.
type SyncAuthSession struct {
	bun.BaseModel `bun:"table:sigma_finance.sync_auth_sessions,alias:sas"`

	ID                   string                `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID               string                `bun:"user_id,notnull,type:uuid"`
	PortfolioID          string                `bun:"portfolio_id,notnull,type:uuid"`
	Provider             string                `bun:"provider,notnull"`
	Status               SyncAuthSessionStatus `bun:"status,notnull,default:'WAITING_FOR_CONFIRMATION'"`
	EncryptedProcessInfo string                `bun:"encrypted_process_info,notnull"`
	ExpiresAt            time.Time             `bun:"expires_at,notnull"`
	CreatedAt            time.Time             `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt            time.Time             `bun:"updated_at,nullzero,notnull,default:current_timestamp"`

	RawProcessInfo string `bun:"-"` // Transient plaintext process ID for Encrypt/Decrypt
}

// Implement Entity interface
func (s SyncAuthSession) GetID() string             { return s.ID }
func (s *SyncAuthSession) SetID(id string)          { s.ID = id }
func (s SyncAuthSession) GetCreatedAt() time.Time   { return s.CreatedAt }
func (s *SyncAuthSession) SetCreatedAt(t time.Time) { s.CreatedAt = t }
func (s SyncAuthSession) GetUpdatedAt() time.Time   { return s.UpdatedAt }
func (s *SyncAuthSession) SetUpdatedAt(t time.Time) { s.UpdatedAt = t }

// Encrypt encrypts the RawProcessInfo using AES-256-GCM.
func (s *SyncAuthSession) Encrypt() error {
	if s.RawProcessInfo == "" {
		if s.EncryptedProcessInfo != "" {
			return nil
		}
		return errors.New("raw process info is empty")
	}

	key, err := getEncryptionKey()
	if err != nil {
		return err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return fmt.Errorf("failed to create cipher block: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(s.RawProcessInfo), nil)
	s.EncryptedProcessInfo = base64.StdEncoding.EncodeToString(ciphertext)
	return nil
}

// Decrypt decrypts EncryptedProcessInfo using AES-256-GCM.
func (s *SyncAuthSession) Decrypt() (string, error) {
	if s.EncryptedProcessInfo == "" {
		if s.RawProcessInfo != "" {
			return s.RawProcessInfo, nil
		}
		return "", errors.New("encrypted process info is empty")
	}

	key, err := getEncryptionKey()
	if err != nil {
		return "", err
	}

	ciphertext, err := base64.StdEncoding.DecodeString(s.EncryptedProcessInfo)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64 ciphertext: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher block: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, actualCiphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, actualCiphertext, nil)
	if err != nil {
		return "", fmt.Errorf("decryption failed: %w", err)
	}

	s.RawProcessInfo = string(plaintext)
	return s.RawProcessInfo, nil
}

// ProviderMetadata represents versioned non-sensitive metadata for external providers.
// Stored strictly in sync_connections.provider_metadata.
// Invariant: NEVER store credentials, session cookies, PINs or WAF tokens here.
type ProviderMetadata struct {
	Version                   int               `json:"version"`
	CashAccountID             string            `json:"cash_account_id,omitempty"`
	TimelineTransactionCursor string            `json:"timeline_transaction_cursor,omitempty"`
	TimelineActivityCursor    string            `json:"timeline_activity_cursor,omitempty"`
	ProductType               string            `json:"product_type,omitempty"`
	Jurisdiction              string            `json:"jurisdiction,omitempty"`
	AccountAccessType         string            `json:"account_access_type,omitempty"`
	CustomProperties          map[string]string `json:"custom_properties,omitempty"`
}

// GetProviderMetadata parses and returns typed ProviderMetadata from SyncConnection.
func (s *SyncConnection) GetProviderMetadata() ProviderMetadata {
	if len(s.ProviderMetadata) == 0 {
		meta := ProviderMetadata{Version: 1}
		if s.CashAccountID != nil {
			meta.CashAccountID = *s.CashAccountID
		}
		return meta
	}
	var meta ProviderMetadata
	if err := json.Unmarshal(s.ProviderMetadata, &meta); err != nil {
		meta = ProviderMetadata{Version: 1}
	}
	if meta.Version == 0 {
		meta.Version = 1
	}
	if meta.CashAccountID == "" && s.CashAccountID != nil {
		meta.CashAccountID = *s.CashAccountID
	}
	return meta
}

// SetProviderMetadata serializes ProviderMetadata into SyncConnection.
func (s *SyncConnection) SetProviderMetadata(meta ProviderMetadata) error {
	if meta.Version == 0 {
		meta.Version = 1
	}
	if meta.CashAccountID != "" {
		s.CashAccountID = &meta.CashAccountID
	}
	b, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	s.ProviderMetadata = b
	return nil
}

// SyncRawEvent stores raw unknown or unmapped provider events for audit, review, and replay.
type SyncRawEvent struct {
	bun.BaseModel `bun:"table:sigma_finance.sync_raw_events,alias:sre"`

	ID              string          `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	ConnectionID    string          `bun:"connection_id,notnull,type:uuid"`
	Provider        string          `bun:"provider,notnull"`
	SourceStream    string          `bun:"source_stream,notnull"`
	ExternalEventID string          `bun:"external_event_id,notnull"`
	EventType       string          `bun:"event_type,notnull"`
	Status          string          `bun:"status"`
	RawPayload      json.RawMessage `bun:"raw_payload,notnull,type:jsonb"`
	OccurredAt      *time.Time      `bun:"occurred_at"`
	CreatedAt       time.Time       `bun:"created_at,nullzero,notnull,default:current_timestamp"`

	// Relations
	Connection *SyncConnection `bun:"rel:belongs-to,join:connection_id=id"`
}

func (s SyncRawEvent) GetID() string             { return s.ID }
func (s *SyncRawEvent) SetID(id string)          { s.ID = id }
func (s SyncRawEvent) GetCreatedAt() time.Time   { return s.CreatedAt }
func (s *SyncRawEvent) SetCreatedAt(t time.Time) { s.CreatedAt = t }


