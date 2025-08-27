package service

import (
	"context"
)

// AuthProvider defines the interface for authentication providers
// This allows for extensible authentication with different providers (local, external, etc.)
type AuthProvider interface {
	// Name returns the name of the authentication provider
	Name() string

	// ValidateCredentials validates user credentials and returns user information
	ValidateCredentials(ctx context.Context, credentials Credentials) (*UserInfo, error)

	// SupportsRegistration returns true if this provider supports user registration
	SupportsRegistration() bool

	// Register creates a new user account with this provider (if supported)
	Register(ctx context.Context, req RegisterRequest) (*UserInfo, error)
}

// Credentials is the base interface for all credential types
type Credentials interface {
	// Type returns the credential type identifier
	Type() string

	// Validate performs basic validation of the credentials
	Validate() error
}

// UserInfo represents user information returned by authentication providers
type UserInfo struct {
	ID            string                 `json:"id"`
	Email         string                 `json:"email"`
	Name          string                 `json:"name"`
	EmailVerified bool                   `json:"emailVerified"`
	ExternalID    *string                `json:"externalId,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// RegisterRequest represents a user registration request
type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password,omitempty"` // Optional for external providers
	Name     string `json:"name"`
}

// Validate performs validation of the registration request
func (r *RegisterRequest) Validate() error {
	if r.Email == "" {
		return NewAuthError(ErrInvalidInput, "Email is required", "email")
	}

	if r.Name == "" {
		return NewAuthError(ErrInvalidInput, "Name is required", "name")
	}

	return nil
}

// EmailPasswordCredentials represents email/password authentication credentials
type EmailPasswordCredentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Type returns the credential type
func (c *EmailPasswordCredentials) Type() string {
	return "email_password"
}

// Validate performs validation of email/password credentials
func (c *EmailPasswordCredentials) Validate() error {
	if c.Email == "" {
		return NewAuthError(ErrInvalidInput, "Email is required", "email")
	}

	if c.Password == "" {
		return NewAuthError(ErrInvalidInput, "Password is required", "password")
	}

	return nil
}

// ExternalTokenCredentials represents external provider token credentials
type ExternalTokenCredentials struct {
	Provider string `json:"provider"`
	Token    string `json:"token"`
}

// Type returns the credential type
func (c *ExternalTokenCredentials) Type() string {
	return "external_token"
}

// Validate performs validation of external token credentials
func (c *ExternalTokenCredentials) Validate() error {
	if c.Provider == "" {
		return NewAuthError(ErrInvalidInput, "Provider is required", "provider")
	}

	if c.Token == "" {
		return NewAuthError(ErrInvalidInput, "Token is required", "token")
	}

	return nil
}

// AuthError represents authentication-related errors
type AuthError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
}

func (e *AuthError) Error() string {
	return e.Message
}

// NewAuthError creates a new authentication error
func NewAuthError(code, message, field string) *AuthError {
	return &AuthError{
		Code:    code,
		Message: message,
		Field:   field,
	}
}

// Error codes for authentication
const (
	ErrInvalidCredentials = "INVALID_CREDENTIALS"
	ErrEmailAlreadyExists = "EMAIL_ALREADY_EXISTS"
	ErrEmailNotVerified   = "EMAIL_NOT_VERIFIED"
	ErrAccountLocked      = "ACCOUNT_LOCKED"
	ErrInvalidToken       = "INVALID_TOKEN"
	ErrTokenExpired       = "TOKEN_EXPIRED"
	ErrRateLimitExceeded  = "RATE_LIMIT_EXCEEDED"
	ErrWeakPassword       = "WEAK_PASSWORD"
	ErrInvalidEmail       = "INVALID_EMAIL"
	ErrInvalidInput       = "INVALID_INPUT"
	ErrProviderNotFound   = "PROVIDER_NOT_FOUND"
	ErrRegistrationFailed = "REGISTRATION_FAILED"
)
