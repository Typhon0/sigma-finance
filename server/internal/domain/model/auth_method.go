package model

import (
	"encoding/json"
	"time"

	"github.com/uptrace/bun"
)

// AuthMethod represents different authentication methods for a user
type AuthMethod struct {
	bun.BaseModel `bun:"table:sigma_finance.auth_method"`

	ID         string          `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID     string          `bun:"user_id,notnull,type:uuid"`
	Provider   string          `bun:"provider,notnull"`
	ExternalID *string         `bun:"external_id"`
	Metadata   json.RawMessage `bun:"metadata,type:jsonb"`
	CreatedAt  time.Time       `bun:"created_at,nullzero,notnull,default:current_timestamp"`

	// Relations
	User *User `bun:"rel:belongs-to,join:user_id=id"`
}

// AuthProvider constants
const (
	AuthProviderLocal     = "local"
	AuthProviderAuthentik = "authentik"
	AuthProviderGoogle    = "google"
	AuthProviderGitHub    = "github"
)

// ValidateProvider validates the authentication provider
func (am *AuthMethod) ValidateProvider() error {
	validProviders := map[string]bool{
		AuthProviderLocal:     true,
		AuthProviderAuthentik: true,
		AuthProviderGoogle:    true,
		AuthProviderGitHub:    true,
	}

	if !validProviders[am.Provider] {
		return NewValidationError("provider", "Invalid authentication provider")
	}

	return nil
}

// ValidateExternalID validates external ID requirements based on provider
func (am *AuthMethod) ValidateExternalID() error {
	// Local provider should not have external ID
	if am.Provider == AuthProviderLocal && am.ExternalID != nil {
		return NewValidationError("external_id", "Local provider should not have external ID")
	}

	// External providers should have external ID
	if am.Provider != AuthProviderLocal && am.ExternalID == nil {
		return NewValidationError("external_id", "External provider requires external ID")
	}

	return nil
}

// Validate performs full validation of the auth method
func (am *AuthMethod) Validate() error {
	if err := am.ValidateProvider(); err != nil {
		return err
	}

	if err := am.ValidateExternalID(); err != nil {
		return err
	}

	if am.UserID == "" {
		return NewValidationError("user_id", "User ID is required")
	}

	return nil
}
