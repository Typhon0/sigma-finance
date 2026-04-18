package model

import (
	"time"

	"github.com/uptrace/bun"
)

// PasswordResetToken represents a token for password reset functionality
type PasswordResetToken struct {
	bun.BaseModel `bun:"table:sigma_finance.password_reset_token"`

	ID        string    `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID    string    `bun:"user_id,notnull,type:uuid"`
	Token     string    `bun:"token,unique,notnull"`
	ExpiresAt time.Time `bun:"expires_at,notnull"`
	Used      bool      `bun:"used,default:false"`
	CreatedAt time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`

	// Relations
	User *User `bun:"rel:belongs-to,join:user_id=id"`
}

// Implement Entity interface
func (prt PasswordResetToken) GetID() string             { return prt.ID }
func (prt *PasswordResetToken) SetID(id string)          { prt.ID = id }
func (prt PasswordResetToken) GetCreatedAt() time.Time   { return prt.CreatedAt }
func (prt *PasswordResetToken) SetCreatedAt(t time.Time) { prt.CreatedAt = t }
func (prt PasswordResetToken) GetUpdatedAt() time.Time   { return prt.CreatedAt } // PasswordResetTokens usually aren't updated
func (prt *PasswordResetToken) SetUpdatedAt(t time.Time) {}

// IsExpired checks if the token has expired
func (prt *PasswordResetToken) IsExpired() bool {
	return time.Now().After(prt.ExpiresAt)
}

// IsValid checks if the token is valid (not expired and not used)
func (prt *PasswordResetToken) IsValid() bool {
	return !prt.IsExpired() && !prt.Used
}

// MarkAsUsed marks the token as used
func (prt *PasswordResetToken) MarkAsUsed() {
	prt.Used = true
}

// Validate performs validation of the password reset token
func (prt *PasswordResetToken) Validate() error {
	if prt.UserID == "" {
		return NewValidationError("user_id", "User ID is required")
	}

	if prt.Token == "" {
		return NewValidationError("token", "Token is required")
	}

	if prt.ExpiresAt.IsZero() {
		return NewValidationError("expires_at", "Expiration time is required")
	}

	return nil
}

// DefaultPasswordResetTokenExpiration is the default expiration time for password reset tokens (1 hour)
const DefaultPasswordResetTokenExpiration = time.Hour

// NewPasswordResetToken creates a new password reset token with default expiration
func NewPasswordResetToken(userID, token string) *PasswordResetToken {
	return &PasswordResetToken{
		UserID:    userID,
		Token:     token,
		ExpiresAt: time.Now().Add(DefaultPasswordResetTokenExpiration),
		Used:      false,
	}
}
