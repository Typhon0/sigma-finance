package service

import (
	"context"
	"fmt"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
)

// AuthenticationService provides core authentication business logic
type AuthenticationService interface {
	// User registration and login
	Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error)
	Login(ctx context.Context, req LoginRequest) (*AuthResponse, error)
	Logout(ctx context.Context, userID string, token string) error

	// Password management
	ResetPassword(ctx context.Context, email string) error
	ConfirmPasswordReset(ctx context.Context, token, newPassword string) error

	// Email verification
	VerifyEmail(ctx context.Context, token string) error
	ResendVerification(ctx context.Context, email string) error

	// Session management
	RefreshToken(ctx context.Context, refreshToken string) (*AuthResponse, error)
	ValidateSession(ctx context.Context, token string) (*SessionInfo, error)
	RevokeAllUserSessions(ctx context.Context, userID string) error
}

// AuthResponse represents the response from authentication operations
type AuthResponse struct {
	Token        string    `json:"token"`
	RefreshToken string    `json:"refreshToken"`
	ExpiresAt    time.Time `json:"expiresAt"`
	User         *UserInfo `json:"user"`
}

// LoginRequest represents a login request
type LoginRequest struct {
	Email     string `json:"email"`
	Password  string `json:"password"`
	IPAddress string `json:"ipAddress,omitempty"`
	UserAgent string `json:"userAgent,omitempty"`
}

// Validate performs validation of the login request
func (r *LoginRequest) Validate() error {
	if r.Email == "" {
		return NewAuthError(ErrInvalidInput, "Email is required", "email")
	}

	if r.Password == "" {
		return NewAuthError(ErrInvalidInput, "Password is required", "password")
	}

	return nil
}

// SessionInfo represents session information
type SessionInfo struct {
	UserID    string    `json:"userId"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// authenticationService implements AuthenticationService
type authenticationService struct {
	userRepo                   repository.IUserRepository
	sessionService             SessionService
	passwordResetTokenRepo     repository.IPasswordResetTokenRepository
	emailVerificationTokenRepo repository.IEmailVerificationTokenRepository
	securityService            SecurityService
	auditService               AuditService
	emailService               EmailService
	authProviders              map[string]AuthProvider
}

// AuthenticationServiceConfig holds configuration for the authentication service
type AuthenticationServiceConfig struct {
	JWTExpiration          time.Duration
	RefreshTokenExpiration time.Duration
	MaxFailedAttempts      int
	LockoutDuration        time.Duration
}

// DefaultAuthenticationServiceConfig returns default configuration
func DefaultAuthenticationServiceConfig() AuthenticationServiceConfig {
	return AuthenticationServiceConfig{
		JWTExpiration:          15 * time.Minute,   // Short-lived access tokens
		RefreshTokenExpiration: 7 * 24 * time.Hour, // 7 days for refresh tokens
		MaxFailedAttempts:      5,
		LockoutDuration:        30 * time.Minute,
	}
}

// NewAuthenticationService creates a new AuthenticationService instance
func NewAuthenticationService(
	userRepo repository.IUserRepository,
	sessionService SessionService,
	passwordResetTokenRepo repository.IPasswordResetTokenRepository,
	emailVerificationTokenRepo repository.IEmailVerificationTokenRepository,
	securityService SecurityService,
	auditService AuditService,
	emailService EmailService,
	authProviders []AuthProvider,
) AuthenticationService {
	// Convert providers slice to map for easy lookup
	providerMap := make(map[string]AuthProvider)
	for _, provider := range authProviders {
		providerMap[provider.Name()] = provider
	}

	return &authenticationService{
		userRepo:                   userRepo,
		sessionService:             sessionService,
		passwordResetTokenRepo:     passwordResetTokenRepo,
		emailVerificationTokenRepo: emailVerificationTokenRepo,
		securityService:            securityService,
		auditService:               auditService,
		emailService:               emailService,
		authProviders:              providerMap,
	}
}

// Register creates a new user account
func (a *authenticationService) Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error) {
	// Validate request
	if err := req.Validate(); err != nil {
		return nil, err
	}

	// Check rate limiting for registration
	rateLimitKey := RegistrationRateLimitKey("global") // Could use IP if available
	if err := a.securityService.CheckRateLimit(ctx, rateLimitKey, 3, time.Hour); err != nil {
		// Log security event
		a.auditService.LogSecurityEvent(ctx, "registration_rate_limit", "", "", map[string]interface{}{
			"email": req.Email,
		})
		return nil, NewAuthError(ErrRateLimitExceeded, "Too many registration attempts. Please try again later.", "")
	}

	// Check if user already exists
	existingUser, err := a.userRepo.GetByEmail(ctx, req.Email)
	if err == nil && existingUser != nil {
		// Log failed registration attempt
		event := CreateRegisterEvent(nil, req.Email, "", "", false, map[string]interface{}{
			"reason": "email_already_exists",
		})
		a.auditService.LogAuthEvent(ctx, event)

		return nil, NewAuthError(ErrEmailAlreadyExists, "An account with this email already exists", "email")
	}

	// Validate password strength
	if err := model.ValidatePassword(req.Password); err != nil {
		return nil, NewAuthError(ErrWeakPassword, err.Error(), "password")
	}

	// Hash password
	passwordHash, err := a.securityService.HashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user
	user := &model.User{
		Email:         req.Email,
		Name:          req.Name,
		PasswordHash:  &passwordHash,
		EmailVerified: false,
	}

	if err := user.Validate(); err != nil {
		return nil, err
	}

	createdUser, err := a.userRepo.Create(ctx, user)
	if err != nil {
		// Log failed registration
		event := CreateRegisterEvent(nil, req.Email, "", "", false, map[string]interface{}{
			"reason": "database_error",
		})
		a.auditService.LogAuthEvent(ctx, event)

		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Create local auth method
	authMethod := &model.AuthMethod{
		UserID:   createdUser.ID,
		Provider: model.AuthProviderLocal,
	}

	if err := authMethod.Validate(); err != nil {
		return nil, err
	}

	// Note: AuthMethod creation would be handled by a separate repository if needed

	// Generate email verification token
	verificationToken, err := a.securityService.GenerateSecureToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate verification token: %w", err)
	}

	emailVerificationToken := model.NewEmailVerificationToken(createdUser.ID, verificationToken)
	_, err = a.emailVerificationTokenRepo.Create(ctx, emailVerificationToken)
	if err != nil {
		return nil, fmt.Errorf("failed to create email verification token: %w", err)
	}

	// Send verification email
	if err := a.emailService.SendVerificationEmail(ctx, createdUser.Email, createdUser.Name, verificationToken); err != nil {
		// Log but don't fail registration if email fails
		a.auditService.LogSecurityEvent(ctx, "email_send_failed", "", "", map[string]interface{}{
			"email": createdUser.Email,
			"type":  "verification",
		})
	}

	// Log successful registration
	event := CreateRegisterEvent(&createdUser.ID, createdUser.Email, "", "", true, map[string]interface{}{
		"user_id": createdUser.ID,
	})
	a.auditService.LogAuthEvent(ctx, event)

	// Create session for the new user
	return a.createUserSession(ctx, createdUser, "", "")
}

// Login authenticates a user and creates a session
func (a *authenticationService) Login(ctx context.Context, req LoginRequest) (*AuthResponse, error) {
	// Validate request
	if err := req.Validate(); err != nil {
		return nil, err
	}

	// Check rate limiting for login attempts
	rateLimitKey := LoginRateLimitKey(req.Email)
	if err := a.securityService.CheckRateLimit(ctx, rateLimitKey, 5, 15*time.Minute); err != nil {
		// Log security event
		a.auditService.LogSecurityEvent(ctx, "login_rate_limit", req.IPAddress, req.UserAgent, map[string]interface{}{
			"email": req.Email,
		})
		return nil, NewAuthError(ErrRateLimitExceeded, "Too many login attempts. Please try again later.", "")
	}

	// Get user by email
	user, err := a.userRepo.GetByEmail(ctx, req.Email)
	if err != nil {
		// Log failed login attempt (don't reveal if email exists)
		event := CreateLoginEvent(nil, req.Email, req.IPAddress, req.UserAgent, false, map[string]interface{}{
			"reason": "invalid_credentials",
		})
		a.auditService.LogAuthEvent(ctx, event)

		return nil, NewAuthError(ErrInvalidCredentials, "Invalid email or password", "")
	}

	// Check if account is locked
	if user.IsAccountLocked() {
		event := CreateLoginEvent(&user.ID, user.Email, req.IPAddress, req.UserAgent, false, map[string]interface{}{
			"reason": "account_locked",
		})
		a.auditService.LogAuthEvent(ctx, event)

		return nil, NewAuthError(ErrAccountLocked, "Account is temporarily locked due to too many failed login attempts", "")
	}

	// Verify password
	if user.PasswordHash == nil {
		event := CreateLoginEvent(&user.ID, user.Email, req.IPAddress, req.UserAgent, false, map[string]interface{}{
			"reason": "no_password_set",
		})
		a.auditService.LogAuthEvent(ctx, event)

		return nil, NewAuthError(ErrInvalidCredentials, "Invalid email or password", "")
	}

	if err := a.securityService.VerifyPassword(req.Password, *user.PasswordHash); err != nil {
		// Increment failed login count
		a.userRepo.IncrementFailedLoginCount(ctx, user.ID)

		event := CreateLoginEvent(&user.ID, user.Email, req.IPAddress, req.UserAgent, false, map[string]interface{}{
			"reason": "invalid_password",
		})
		a.auditService.LogAuthEvent(ctx, event)

		return nil, NewAuthError(ErrInvalidCredentials, "Invalid email or password", "")
	}

	// Check if email is verified (optional based on requirements)
	if !user.EmailVerified {
		event := CreateLoginEvent(&user.ID, user.Email, req.IPAddress, req.UserAgent, false, map[string]interface{}{
			"reason": "email_not_verified",
		})
		a.auditService.LogAuthEvent(ctx, event)

		return nil, NewAuthError(ErrEmailNotVerified, "Please verify your email address before logging in", "")
	}

	// Reset failed login count on successful authentication
	a.userRepo.ResetFailedLoginCount(ctx, user.ID)

	// Update last login
	a.userRepo.UpdateLastLogin(ctx, user.ID, time.Now(), req.IPAddress)

	// Log successful login
	event := CreateLoginEvent(&user.ID, user.Email, req.IPAddress, req.UserAgent, true, map[string]interface{}{
		"user_id": user.ID,
	})
	a.auditService.LogAuthEvent(ctx, event)

	// Create session
	return a.createUserSession(ctx, user, req.IPAddress, req.UserAgent)
}

// Logout invalidates a user session
func (a *authenticationService) Logout(ctx context.Context, userID string, token string) error {
	// Revoke the session using SessionService
	return a.sessionService.RevokeSession(ctx, token)
}

// createUserSession creates a new session for a user
func (a *authenticationService) createUserSession(ctx context.Context, user *model.User, ipAddress, userAgent string) (*AuthResponse, error) {
	// Create session using SessionService
	session, err := a.sessionService.CreateSession(ctx, user.ID, ipAddress, userAgent)
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	// Extract JWT expiration from token (we need to validate it to get claims)
	claims, err := a.securityService.ValidateJWT(session.Token)
	if err != nil {
		return nil, fmt.Errorf("failed to validate generated token: %w", err)
	}

	return &AuthResponse{
		Token:        session.Token,
		RefreshToken: session.RefreshToken,
		ExpiresAt:    claims.ExpiresAt.Time,
		User: &UserInfo{
			ID:            user.ID,
			Email:         user.Email,
			Name:          user.Name,
			EmailVerified: user.EmailVerified,
		},
	}, nil
}

// ResetPassword initiates a password reset process
func (a *authenticationService) ResetPassword(ctx context.Context, email string) error {
	if email == "" {
		return NewAuthError(ErrInvalidInput, "Email is required", "email")
	}

	// Check rate limiting for password reset
	rateLimitKey := PasswordResetRateLimitKey(email)
	if err := a.securityService.CheckRateLimit(ctx, rateLimitKey, 3, time.Hour); err != nil {
		a.auditService.LogSecurityEvent(ctx, "password_reset_rate_limit", "", "", map[string]interface{}{
			"email": email,
		})
		return NewAuthError(ErrRateLimitExceeded, "Too many password reset attempts. Please try again later.", "")
	}

	// Get user by email
	user, err := a.userRepo.GetByEmail(ctx, email)
	if err != nil {
		// Don't reveal if email exists, but log the attempt
		event := CreatePasswordResetEvent(nil, email, "", "", false, map[string]interface{}{
			"reason": "user_not_found",
		})
		a.auditService.LogAuthEvent(ctx, event)

		// Return success to prevent email enumeration
		return nil
	}

	// Generate password reset token
	resetToken, err := a.securityService.GenerateSecureToken()
	if err != nil {
		return fmt.Errorf("failed to generate reset token: %w", err)
	}

	// Create password reset token
	passwordResetToken := model.NewPasswordResetToken(user.ID, resetToken)
	_, err = a.passwordResetTokenRepo.Create(ctx, passwordResetToken)
	if err != nil {
		return fmt.Errorf("failed to create password reset token: %w", err)
	}

	// Send password reset email
	if err := a.emailService.SendPasswordResetEmail(ctx, user.Email, user.Name, resetToken); err != nil {
		// Log but don't fail if email fails
		a.auditService.LogSecurityEvent(ctx, "email_send_failed", "", "", map[string]interface{}{
			"email": user.Email,
			"type":  "password_reset",
		})
	}

	// Log password reset request
	event := CreatePasswordResetEvent(&user.ID, user.Email, "", "", true, map[string]interface{}{
		"user_id": user.ID,
		"action":  "request",
	})
	a.auditService.LogAuthEvent(ctx, event)

	return nil
}

// ConfirmPasswordReset completes the password reset process
func (a *authenticationService) ConfirmPasswordReset(ctx context.Context, token, newPassword string) error {
	if token == "" {
		return NewAuthError(ErrInvalidInput, "Token is required", "token")
	}

	if newPassword == "" {
		return NewAuthError(ErrInvalidInput, "New password is required", "password")
	}

	// Validate password strength
	if err := model.ValidatePassword(newPassword); err != nil {
		return NewAuthError(ErrWeakPassword, err.Error(), "password")
	}

	// Get password reset token
	resetToken, err := a.passwordResetTokenRepo.GetByToken(ctx, token)
	if err != nil {
		return NewAuthError(ErrInvalidToken, "Invalid or expired reset token", "token")
	}

	// Check if token is valid
	if !resetToken.IsValid() {
		return NewAuthError(ErrTokenExpired, "Reset token has expired", "token")
	}

	// Get user
	user, err := a.userRepo.GetByStringID(ctx, resetToken.UserID)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	// Hash new password
	passwordHash, err := a.securityService.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update user password
	if err := a.userRepo.UpdatePasswordHash(ctx, user.ID, passwordHash); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Mark token as used
	resetToken.MarkAsUsed()
	if err := a.passwordResetTokenRepo.Update(ctx, resetToken); err != nil {
		return fmt.Errorf("failed to update reset token: %w", err)
	}

	// Revoke all user sessions for security
	if err := a.sessionService.RevokeAllUserSessions(ctx, user.ID); err != nil {
		// Log but don't fail
		a.auditService.LogSecurityEvent(ctx, "session_revoke_failed", "", "", map[string]interface{}{
			"user_id": user.ID,
		})
	}

	// Log password reset completion
	event := CreatePasswordResetEvent(&user.ID, user.Email, "", "", true, map[string]interface{}{
		"user_id": user.ID,
		"action":  "confirm",
	})
	a.auditService.LogAuthEvent(ctx, event)

	return nil
}

// VerifyEmail verifies a user's email address
func (a *authenticationService) VerifyEmail(ctx context.Context, token string) error {
	if token == "" {
		return NewAuthError(ErrInvalidInput, "Token is required", "token")
	}

	// Get email verification token
	verificationToken, err := a.emailVerificationTokenRepo.GetByToken(ctx, token)
	if err != nil {
		return NewAuthError(ErrInvalidToken, "Invalid or expired verification token", "token")
	}

	// Check if token is valid
	if !verificationToken.IsValid() {
		return NewAuthError(ErrTokenExpired, "Verification token has expired", "token")
	}

	// Get user
	user, err := a.userRepo.GetByStringID(ctx, verificationToken.UserID)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	// Update user email verification status
	if err := a.userRepo.UpdateEmailVerified(ctx, user.ID, true); err != nil {
		return fmt.Errorf("failed to update email verification: %w", err)
	}

	// Mark token as used
	verificationToken.MarkAsUsed()
	if err := a.emailVerificationTokenRepo.Update(ctx, verificationToken); err != nil {
		return fmt.Errorf("failed to update verification token: %w", err)
	}

	// Log email verification
	event := CreateEmailVerifyEvent(&user.ID, user.Email, "", "", true, map[string]interface{}{
		"user_id": user.ID,
	})
	a.auditService.LogAuthEvent(ctx, event)

	return nil
}

// ResendVerification resends email verification
func (a *authenticationService) ResendVerification(ctx context.Context, email string) error {
	if email == "" {
		return NewAuthError(ErrInvalidInput, "Email is required", "email")
	}

	// Check rate limiting for email verification
	rateLimitKey := EmailVerificationRateLimitKey(email)
	if err := a.securityService.CheckRateLimit(ctx, rateLimitKey, 3, time.Hour); err != nil {
		a.auditService.LogSecurityEvent(ctx, "email_verification_rate_limit", "", "", map[string]interface{}{
			"email": email,
		})
		return NewAuthError(ErrRateLimitExceeded, "Too many verification attempts. Please try again later.", "")
	}

	// Get user by email
	user, err := a.userRepo.GetByEmail(ctx, email)
	if err != nil {
		// Don't reveal if email exists
		return nil
	}

	// Check if already verified
	if user.EmailVerified {
		return NewAuthError(ErrInvalidInput, "Email is already verified", "email")
	}

	// Generate new verification token
	verificationToken, err := a.securityService.GenerateSecureToken()
	if err != nil {
		return fmt.Errorf("failed to generate verification token: %w", err)
	}

	// Create email verification token
	emailVerificationToken := model.NewEmailVerificationToken(user.ID, verificationToken)
	_, err = a.emailVerificationTokenRepo.Create(ctx, emailVerificationToken)
	if err != nil {
		return fmt.Errorf("failed to create email verification token: %w", err)
	}

	// Send verification email
	if err := a.emailService.SendVerificationEmail(ctx, user.Email, user.Name, verificationToken); err != nil {
		a.auditService.LogSecurityEvent(ctx, "email_send_failed", "", "", map[string]interface{}{
			"email": user.Email,
			"type":  "verification_resend",
		})
		return fmt.Errorf("failed to send verification email: %w", err)
	}

	// Log verification resend
	event := CreateEmailVerifyEvent(&user.ID, user.Email, "", "", true, map[string]interface{}{
		"user_id": user.ID,
		"action":  "resend",
	})
	a.auditService.LogAuthEvent(ctx, event)

	return nil
}

// RefreshToken refreshes an access token using a refresh token
func (a *authenticationService) RefreshToken(ctx context.Context, refreshToken string) (*AuthResponse, error) {
	// Refresh session using SessionService
	session, err := a.sessionService.RefreshSession(ctx, refreshToken)
	if err != nil {
		return nil, err
	}

	// Get user for response
	user, err := a.userRepo.GetByStringID(ctx, session.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Extract JWT expiration from token
	claims, err := a.securityService.ValidateJWT(session.Token)
	if err != nil {
		return nil, fmt.Errorf("failed to validate refreshed token: %w", err)
	}

	return &AuthResponse{
		Token:        session.Token,
		RefreshToken: session.RefreshToken,
		ExpiresAt:    claims.ExpiresAt.Time,
		User: &UserInfo{
			ID:            user.ID,
			Email:         user.Email,
			Name:          user.Name,
			EmailVerified: user.EmailVerified,
		},
	}, nil
}

// ValidateSession validates a JWT token and returns session information
func (a *authenticationService) ValidateSession(ctx context.Context, token string) (*SessionInfo, error) {
	// Validate session using SessionService
	session, err := a.sessionService.ValidateSession(ctx, token)
	if err != nil {
		return nil, err
	}

	// Get user for additional info
	user, err := a.userRepo.GetByStringID(ctx, session.UserID)
	if err != nil {
		return nil, NewAuthError(ErrInvalidToken, "Invalid token", "token")
	}

	// Extract JWT expiration from token
	claims, err := a.securityService.ValidateJWT(token)
	if err != nil {
		return nil, NewAuthError(ErrInvalidToken, "Invalid token", "token")
	}

	return &SessionInfo{
		UserID:    user.ID,
		Email:     user.Email,
		Name:      user.Name,
		ExpiresAt: claims.ExpiresAt.Time,
	}, nil
}

// RevokeAllUserSessions revokes all sessions for a user
func (a *authenticationService) RevokeAllUserSessions(ctx context.Context, userID string) error {
	// Revoke all sessions using SessionService
	return a.sessionService.RevokeAllUserSessions(ctx, userID)
}
