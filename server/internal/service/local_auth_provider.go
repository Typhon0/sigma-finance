package service

import (
	"context"
	"log"

	"sigma_finance/internal/domain/model"

	"github.com/google/uuid"
)

// LocalAuthProvider implements authentication using email/password stored locally
type LocalAuthProvider struct {
	userRepo        UserRepository
	securityService SecurityService
}

// UserRepository defines the interface for user data access
type UserRepository interface {
	GetByEmail(ctx context.Context, email string) (*model.User, error)
	Create(ctx context.Context, user *model.User) error
	Update(ctx context.Context, user *model.User) error
}

// NewLocalAuthProvider creates a new local authentication provider
func NewLocalAuthProvider(userRepo UserRepository, securityService SecurityService) *LocalAuthProvider {
	return &LocalAuthProvider{
		userRepo:        userRepo,
		securityService: securityService,
	}
}

// Name returns the provider name
func (p *LocalAuthProvider) Name() string {
	return model.AuthProviderLocal
}

// SupportsRegistration returns true as local provider supports registration
func (p *LocalAuthProvider) SupportsRegistration() bool {
	return true
}

// ValidateCredentials validates email/password credentials against local database
func (p *LocalAuthProvider) ValidateCredentials(ctx context.Context, credentials Credentials) (*UserInfo, error) {
	// Validate credentials type
	emailPassCreds, ok := credentials.(*EmailPasswordCredentials)
	if !ok {
		return nil, NewAuthError(ErrInvalidInput, "Invalid credential type for local provider", "credentials")
	}

	// Validate credential format
	if err := emailPassCreds.Validate(); err != nil {
		return nil, err
	}

	// Get user by email
	user, err := p.userRepo.GetByEmail(ctx, emailPassCreds.Email)
	if err != nil {
		// Don't reveal whether email exists or not for security
		return nil, NewAuthError(ErrInvalidCredentials, "Invalid email or password", "")
	}

	// Check if account is locked
	if user.IsAccountLocked() {
		return nil, NewAuthError(ErrAccountLocked, "Account is temporarily locked due to too many failed login attempts", "")
	}

	// Verify password
	if user.PasswordHash == nil {
		// User exists but has no password (external auth only)
		return nil, NewAuthError(ErrInvalidCredentials, "Invalid email or password", "")
	}

	err = p.securityService.VerifyPassword(emailPassCreds.Password, *user.PasswordHash)
	if err != nil {
		// Increment failed login count (this may lock the account on the 5th attempt)
		user.IncrementFailedLoginCount()
		if updateErr := p.userRepo.Update(ctx, user); updateErr != nil {
			// Log error but don't expose it to user
			log.Printf("[LocalAuthProvider] ValidateCredentials: failed to update user failed login count: %v", updateErr)
		}

		// Check if the account was just locked by this failed attempt
		if user.IsAccountLocked() {
			return nil, NewAuthError(ErrAccountLocked, "Account is temporarily locked due to too many failed login attempts", "")
		}

		return nil, NewAuthError(ErrInvalidCredentials, "Invalid email or password", "")
	}

	// Reset failed login count on successful authentication
	user.ResetFailedLoginCount()
	user.UpdateLastLogin()
	if err := p.userRepo.Update(ctx, user); err != nil {
		// Log error but don't fail authentication
		log.Printf("[LocalAuthProvider] ValidateCredentials: failed to update user login info: %v", err)
	}

	// Return user info
	return &UserInfo{
		ID:                  user.ID,
		Email:               user.Email,
		Name:                user.Name,
		EmailVerified:       user.EmailVerified,
		DisplayCurrency:     string(user.DisplayCurrency),
		ThemePreference:     string(user.ThemePreference),
		ThemeBaseColor:      string(user.ThemeBaseColor),
		ThemeAccentColor:    string(user.ThemeAccentColor),
		ThemeFontPreference: string(user.ThemeFontPreference),
		ThemeHeadingFont:    string(user.ThemeHeadingFont),
		ThemeMenuAccent:     string(user.ThemeMenuAccent),
		ThemeMenuColor:      string(user.ThemeMenuColor),
		ThemeStyle:          string(user.ThemeStyle),
		ThemeRadius:         user.ThemeRadius,
		ThemeRTL:            user.ThemeRTL,
		ExternalID:          nil, // Local provider doesn't have external ID
		Metadata:            nil,
	}, nil
}

// Register creates a new user account with email/password
func (p *LocalAuthProvider) Register(ctx context.Context, req RegisterRequest) (*UserInfo, error) {
	// Validate registration request
	if err := req.Validate(); err != nil {
		return nil, err
	}

	// Validate password is provided for local registration
	if req.Password == "" {
		return nil, NewAuthError(ErrInvalidInput, "Password is required for local registration", "password")
	}

	// Validate password strength
	if err := model.ValidatePassword(req.Password); err != nil {
		if validationErr, ok := err.(*model.ValidationError); ok {
			return nil, NewAuthError(ErrWeakPassword, validationErr.Message, validationErr.Field)
		}
		return nil, NewAuthError(ErrWeakPassword, err.Error(), "password")
	}

	// Check if user already exists
	existingUser, err := p.userRepo.GetByEmail(ctx, req.Email)
	if err == nil && existingUser != nil {
		return nil, NewAuthError(ErrEmailAlreadyExists, "An account with this email already exists", "email")
	}

	// Hash password
	passwordHash, err := p.securityService.HashPassword(req.Password)
	if err != nil {
		return nil, NewAuthError(ErrRegistrationFailed, "Failed to process registration", "")
	}

	// Create new user
	user := &model.User{
		ID:                  uuid.New().String(),
		Email:               req.Email,
		Name:                req.Name,
		PasswordHash:        &passwordHash,
		EmailVerified:       false, // Email verification required
		FailedLoginCount:    0,
		DisplayCurrency:     model.CurrencyUSD,
		ThemePreference:     model.DefaultThemePreference,
		ThemeBaseColor:      model.DefaultThemeBaseColor,
		ThemeAccentColor:    model.DefaultThemeAccentColor,
		ThemeFontPreference: model.DefaultThemeFontPreference,
		ThemeHeadingFont:    model.DefaultThemeHeadingFont,
		ThemeMenuAccent:     model.DefaultThemeMenuAccent,
		ThemeMenuColor:      model.DefaultThemeMenuColor,
		ThemeStyle:          model.DefaultThemeStyle,
		ThemeRadius:         model.DefaultThemeRadius,
		ThemeRTL:            model.DefaultThemeRTL,
	}

	// Validate user model
	if err := user.Validate(); err != nil {
		if validationErr, ok := err.(*model.ValidationError); ok {
			return nil, NewAuthError(ErrInvalidInput, validationErr.Message, validationErr.Field)
		}
		return nil, NewAuthError(ErrInvalidInput, err.Error(), "")
	}

	// Save user to database
	if err := p.userRepo.Create(ctx, user); err != nil {
		return nil, NewAuthError(ErrRegistrationFailed, "Failed to create user account", "")
	}

	// Return user info
	return &UserInfo{
		ID:                  user.ID,
		Email:               user.Email,
		Name:                user.Name,
		EmailVerified:       user.EmailVerified,
		DisplayCurrency:     string(model.CurrencyUSD),
		ThemePreference:     string(model.DefaultThemePreference),
		ThemeBaseColor:      string(model.DefaultThemeBaseColor),
		ThemeAccentColor:    string(model.DefaultThemeAccentColor),
		ThemeFontPreference: string(model.DefaultThemeFontPreference),
		ThemeHeadingFont:    string(model.DefaultThemeHeadingFont),
		ThemeMenuAccent:     string(model.DefaultThemeMenuAccent),
		ThemeMenuColor:      string(model.DefaultThemeMenuColor),
		ThemeStyle:          string(model.DefaultThemeStyle),
		ThemeRadius:         model.DefaultThemeRadius,
		ThemeRTL:            model.DefaultThemeRTL,
		ExternalID:          nil,
		Metadata:            nil,
	}, nil
}
