package model

import "fmt"

// ValidationError represents a validation error for a specific field
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func (e ValidationError) Error() string {
	return fmt.Sprintf("validation error for field '%s': %s", e.Field, e.Message)
}

// NewValidationError creates a new validation error
func NewValidationError(field, message string) *ValidationError {
	return &ValidationError{
		Field:   field,
		Message: message,
	}
}

// AuthError represents authentication-related errors
type AuthError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e AuthError) Error() string {
	return fmt.Sprintf("auth error [%s]: %s", e.Code, e.Message)
}

// NewAuthError creates a new authentication error
func NewAuthError(code, message string) *AuthError {
	return &AuthError{
		Code:    code,
		Message: message,
	}
}

// Common authentication error codes
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
)
