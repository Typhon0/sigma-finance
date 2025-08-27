package model

import (
	"encoding/json"
	"time"

	"github.com/uptrace/bun"
)

// AuthEvent represents an authentication event for audit logging
type AuthEvent struct {
	bun.BaseModel `bun:"table:sigma_finance.auth_event"`

	ID        string          `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID    *string         `bun:"user_id,type:uuid"`
	Email     string          `bun:"email"`
	Action    string          `bun:"action,notnull"`
	Success   bool            `bun:"success,notnull"`
	IPAddress string          `bun:"ip_address"`
	UserAgent string          `bun:"user_agent"`
	Metadata  json.RawMessage `bun:"metadata,type:jsonb"`
	CreatedAt time.Time       `bun:"created_at,nullzero,notnull,default:current_timestamp"`

	// Relations
	User *User `bun:"rel:belongs-to,join:user_id=id"`
}

// Authentication action constants
const (
	AuthActionLogin         = "login"
	AuthActionRegister      = "register"
	AuthActionLogout        = "logout"
	AuthActionPasswordReset = "password_reset"
	AuthActionEmailVerify   = "email_verify"
	AuthActionTokenRefresh  = "token_refresh"
	AuthActionAccountLock   = "account_lock"
	AuthActionAccountUnlock = "account_unlock"
)

// Validate performs validation of the auth event
func (ae *AuthEvent) Validate() error {
	if ae.Action == "" {
		return NewValidationError("action", "Action is required")
	}

	if ae.Email == "" {
		return NewValidationError("email", "Email is required")
	}

	validActions := map[string]bool{
		AuthActionLogin:         true,
		AuthActionRegister:      true,
		AuthActionLogout:        true,
		AuthActionPasswordReset: true,
		AuthActionEmailVerify:   true,
		AuthActionTokenRefresh:  true,
		AuthActionAccountLock:   true,
		AuthActionAccountUnlock: true,
	}

	if !validActions[ae.Action] {
		return NewValidationError("action", "Invalid action type")
	}

	return nil
}

// NewAuthEvent creates a new authentication event
func NewAuthEvent(userID *string, email, action string, success bool, ipAddress, userAgent string, metadata map[string]interface{}) *AuthEvent {
	var metadataJSON json.RawMessage
	if metadata != nil {
		if data, err := json.Marshal(metadata); err == nil {
			metadataJSON = data
		}
	}

	return &AuthEvent{
		UserID:    userID,
		Email:     email,
		Action:    action,
		Success:   success,
		IPAddress: ipAddress,
		UserAgent: userAgent,
		Metadata:  metadataJSON,
		CreatedAt: time.Now(),
	}
}
