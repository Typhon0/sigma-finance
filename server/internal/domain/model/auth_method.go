package model

import (
	"time"

	"github.com/uptrace/bun"
)

// AuthMethod represents an authentication method for a user
// This supports multiple authentication providers per user (local, external, etc.)
type AuthMethod struct {
	bun.BaseModel `bun:"table:sigma_finance.auth_method"`

	ID         string    `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID     string    `bun:"user_id,notnull,type:uuid"`
	Provider   string    `bun:"provider,notnull"`    // 'local', 'authentik', 'google', etc.
	ExternalID *string   `bun:"external_id"`         // ID from external provider
	Metadata   JSONB     `bun:"metadata,type:jsonb"` // Provider-specific data
	CreatedAt  time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`

	// Relations
	User *User `bun:"rel:belongs-to,join:user_id=id"`
}

// JSONB represents a JSON field in the database
type JSONB map[string]interface{}

// AuthProvider constants
const (
	AuthProviderLocal     = "local"
	AuthProviderAuthentik = "authentik"
	AuthProviderGoogle    = "google"
	AuthProviderGitHub    = "github"
)

// Validate performs validation of the auth method
func (am *AuthMethod) Validate() error {
	if am.UserID == "" {
		return NewValidationError("user_id", "User ID is required")
	}

	if am.Provider == "" {
		return NewValidationError("provider", "Provider is required")
	}

	// Validate provider is one of the supported types
	switch am.Provider {
	case AuthProviderLocal, AuthProviderAuthentik, AuthProviderGoogle, AuthProviderGitHub:
		// Valid provider
	default:
		return NewValidationError("provider", "Unsupported authentication provider")
	}

	// For external providers, external_id is required
	if am.Provider != AuthProviderLocal && (am.ExternalID == nil || *am.ExternalID == "") {
		return NewValidationError("external_id", "External ID is required for external providers")
	}

	// For local provider, external_id should be nil
	if am.Provider == AuthProviderLocal && am.ExternalID != nil {
		return NewValidationError("external_id", "External ID should not be set for local provider")
	}

	return nil
}

// IsLocal returns true if this is a local authentication method
func (am *AuthMethod) IsLocal() bool {
	return am.Provider == AuthProviderLocal
}

// IsExternal returns true if this is an external authentication method
func (am *AuthMethod) IsExternal() bool {
	return am.Provider != AuthProviderLocal
}

// ValidateProvider validates the authentication provider
func (am *AuthMethod) ValidateProvider() error {
	if am.Provider == "" {
		return NewValidationError("provider", "Provider is required")
	}

	// Validate provider is one of the supported types
	switch am.Provider {
	case AuthProviderLocal, AuthProviderAuthentik, AuthProviderGoogle, AuthProviderGitHub:
		// Valid provider
		return nil
	default:
		return NewValidationError("provider", "Unsupported authentication provider")
	}
}

// ValidateExternalID validates the external ID for external providers
func (am *AuthMethod) ValidateExternalID() error {
	// For external providers, external_id is required
	if am.Provider != AuthProviderLocal && (am.ExternalID == nil || *am.ExternalID == "") {
		return NewValidationError("external_id", "External ID is required for external providers")
	}

	// For local provider, external_id should be nil
	if am.Provider == AuthProviderLocal && am.ExternalID != nil {
		return NewValidationError("external_id", "External ID should not be set for local provider")
	}

	return nil
}
