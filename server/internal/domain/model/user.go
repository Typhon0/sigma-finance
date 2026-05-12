package model

import (
	"context"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/uptrace/bun"
)

type UserRole string

const (
	UserRoleUser  UserRole = "USER"
	UserRoleAdmin UserRole = "ADMIN"
)

func (r UserRole) normalize() UserRole {
	normalized := strings.ToUpper(strings.TrimSpace(string(r)))
	if normalized == "" {
		return UserRoleUser
	}
	return UserRole(normalized)
}

func (r UserRole) IsValid() bool {
	switch r.normalize() {
	case UserRoleUser, UserRoleAdmin:
		return true
	default:
		return false
	}
}

type User struct {
	bun.BaseModel `bun:"table:sigma_finance.user"`

	ID                  string              `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	Email               string              `bun:"email,unique,notnull"`
	Role                UserRole            `bun:"role,type:varchar(20),notnull,default:USER"`
	EmailVerified       bool                `bun:"email_verified,default:false"`
	Name                string              `bun:"name"`
	PasswordHash        *string             `bun:"password_hash"`
	AuthMethods         []AuthMethod        `bun:"rel:has-many,join:id=user_id"`
	CreatedAt           time.Time           `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt           time.Time           `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
	LastLoginAt         *time.Time          `bun:"last_login_at"`
	FailedLoginCount    int                 `bun:"failed_login_count,default:0"`
	LockedUntil         *time.Time          `bun:"locked_until"`
	DisplayCurrency     Currency            `bun:"display_currency,type:varchar(3),default:USD"`
	ThemePreference     ThemePreference     `bun:"theme_preference,type:varchar(10),default:system"`
	ThemeBaseColor      ThemeBaseColor      `bun:"theme_base_color,type:varchar(20),default:neutral"`
	ThemeAccentColor    ThemeAccentColor    `bun:"theme_accent_color,type:varchar(20),default:zinc"`
	ThemeFontPreference ThemeFontPreference `bun:"theme_font_preference,type:varchar(30),default:inter"`
	ThemeHeadingFont    ThemeHeadingFont    `bun:"theme_heading_font,type:varchar(30),default:inherit"`
	ThemeMenuAccent     ThemeMenuAccent     `bun:"theme_menu_accent,type:varchar(10),default:subtle"`
	ThemeMenuColor      ThemeMenuColor      `bun:"theme_menu_color,type:varchar(30),default:default"`
	ThemeStyle          ThemeStyle          `bun:"theme_style,type:varchar(10),default:vega"`
	ThemeRadius         float64             `bun:"theme_radius,type:numeric(3,2),default:0.625"`
	ThemeRTL            bool                `bun:"theme_rtl,default:false"`
}

func (u *User) normalizeRole() {
	u.Role = u.Role.normalize()
}

func (u *User) IsAdmin() bool {
	return u.Role.normalize() == UserRoleAdmin
}

func (u *User) BeforeAppendModel(_ context.Context, query bun.Query) error {
	switch query.(type) {
	case *bun.InsertQuery, *bun.UpdateQuery:
		u.normalizeRole()
	}
	return nil
}

// ValidateEmail validates the email format
func (u *User) ValidateEmail() error {
	if u.Email == "" {
		return NewValidationError("email", "Email is required")
	}

	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(u.Email) {
		return NewValidationError("email", "Invalid email format")
	}

	return nil
}

// ValidateName validates the user name
func (u *User) ValidateName() error {
	if u.Name != "" {
		u.Name = strings.TrimSpace(u.Name)
		if len(u.Name) > 255 {
			return NewValidationError("name", "Name must be less than 255 characters")
		}
	}
	return nil
}

// IsAccountLocked checks if the account is currently locked
func (u *User) IsAccountLocked() bool {
	if u.LockedUntil == nil {
		return false
	}
	return time.Now().Before(*u.LockedUntil)
}

// IncrementFailedLoginCount increments the failed login count and locks account if needed
func (u *User) IncrementFailedLoginCount() {
	u.FailedLoginCount++

	// Lock account for 30 minutes after 5 failed attempts
	if u.FailedLoginCount >= 5 {
		lockUntil := time.Now().Add(30 * time.Minute)
		u.LockedUntil = &lockUntil
	}
}

// ResetFailedLoginCount resets the failed login count and unlocks account
func (u *User) ResetFailedLoginCount() {
	u.FailedLoginCount = 0
	u.LockedUntil = nil
}

// UpdateLastLogin updates the last login timestamp
func (u *User) UpdateLastLogin() {
	now := time.Now()
	u.LastLoginAt = &now
}

// ValidatePassword validates password strength requirements
func ValidatePassword(password string) error {
	if len(password) < 8 {
		return NewValidationError("password", "Password must be at least 8 characters long")
	}

	if len(password) > 128 {
		return NewValidationError("password", "Password must be less than 128 characters long")
	}

	var (
		hasUpper   = false
		hasLower   = false
		hasNumber  = false
		hasSpecial = false
	)

	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsNumber(char):
			hasNumber = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}

	if !hasUpper {
		return NewValidationError("password", "Password must contain at least one uppercase letter")
	}

	if !hasLower {
		return NewValidationError("password", "Password must contain at least one lowercase letter")
	}

	if !hasNumber {
		return NewValidationError("password", "Password must contain at least one number")
	}

	if !hasSpecial {
		return NewValidationError("password", "Password must contain at least one special character")
	}

	return nil
}

// Validate performs full validation of the user model
func (u *User) Validate() error {
	u.normalizeRole()
	if !u.Role.IsValid() {
		return NewValidationError("role", "Role must be one of USER or ADMIN")
	}

	if err := u.ValidateEmail(); err != nil {
		return err
	}

	if err := u.ValidateName(); err != nil {
		return err
	}

	return nil
}
