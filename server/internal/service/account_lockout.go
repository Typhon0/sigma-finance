package service

import (
	"context"
	"fmt"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
)

// AccountLockoutService provides account lockout functionality
type AccountLockoutService interface {
	// CheckAccountLockout checks if an account is locked and handles failed login attempts
	CheckAccountLockout(ctx context.Context, userID string) error

	// HandleFailedLogin handles a failed login attempt and potentially locks the account
	HandleFailedLogin(ctx context.Context, userID, email, ipAddress, userAgent string) error

	// HandleSuccessfulLogin handles a successful login and resets failed attempts
	HandleSuccessfulLogin(ctx context.Context, userID, email, ipAddress, userAgent string) error

	// UnlockAccount manually unlocks an account
	UnlockAccount(ctx context.Context, userID, adminUserID string) error

	// GetLockedAccounts retrieves all currently locked accounts
	GetLockedAccounts(ctx context.Context) ([]model.User, error)

	// GetAccountsWithFailedLogins retrieves accounts with failed login attempts above threshold
	GetAccountsWithFailedLogins(ctx context.Context, threshold int) ([]model.User, error)
}

// AccountLockoutConfig holds configuration for account lockout behavior
type AccountLockoutConfig struct {
	MaxFailedAttempts int           // Maximum failed attempts before lockout (default: 5)
	LockoutDuration   time.Duration // Duration of lockout (default: 30 minutes)
	RateLimitWindow   time.Duration // Rate limit window (default: 15 minutes)
}

// DefaultAccountLockoutConfig returns default account lockout configuration
func DefaultAccountLockoutConfig() AccountLockoutConfig {
	return AccountLockoutConfig{
		MaxFailedAttempts: 5,
		LockoutDuration:   30 * time.Minute,
		RateLimitWindow:   15 * time.Minute,
	}
}

// accountLockoutService implements AccountLockoutService
type accountLockoutService struct {
	userRepo     repository.IUserRepository
	auditService AuditService
	rateLimiter  RateLimiter
	config       AccountLockoutConfig
}

// NewAccountLockoutService creates a new AccountLockoutService instance
func NewAccountLockoutService(
	userRepo repository.IUserRepository,
	auditService AuditService,
	rateLimiter RateLimiter,
	config AccountLockoutConfig,
) AccountLockoutService {
	return &accountLockoutService{
		userRepo:     userRepo,
		auditService: auditService,
		rateLimiter:  rateLimiter,
		config:       config,
	}
}

// CheckAccountLockout checks if an account is locked
func (a *accountLockoutService) CheckAccountLockout(ctx context.Context, userID string) error {
	user, err := a.userRepo.GetByStringID(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	if user.IsAccountLocked() {
		return NewAccountLockedError(user.LockedUntil)
	}

	return nil
}

// HandleFailedLogin handles a failed login attempt
func (a *accountLockoutService) HandleFailedLogin(ctx context.Context, userID, email, ipAddress, userAgent string) error {
	// Check rate limiting first
	loginKey := LoginRateLimitKey(email)
	if err := a.rateLimiter.CheckRateLimit(ctx, loginKey, a.config.MaxFailedAttempts, a.config.RateLimitWindow); err != nil {
		if IsRateLimitError(err) {
			// Log rate limit exceeded event
			if a.auditService != nil {
				event := CreateLoginEvent(&userID, email, ipAddress, userAgent, false, map[string]interface{}{
					"reason":      "rate_limit_exceeded",
					"rate_limit":  true,
					"lockout_key": loginKey,
				})
				a.auditService.LogAuthEvent(ctx, event)
			}
		}
		return err
	}

	// Increment failed login count in database
	if err := a.userRepo.IncrementFailedLoginCount(ctx, userID); err != nil {
		return fmt.Errorf("failed to increment failed login count: %w", err)
	}

	// Get updated user to check if account was locked
	user, err := a.userRepo.GetByStringID(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to get updated user: %w", err)
	}

	// Log the failed login attempt
	if a.auditService != nil {
		metadata := map[string]interface{}{
			"failed_login_count": user.FailedLoginCount,
			"account_locked":     user.IsAccountLocked(),
		}

		if user.IsAccountLocked() {
			metadata["locked_until"] = user.LockedUntil
		}

		event := CreateLoginEvent(&userID, email, ipAddress, userAgent, false, metadata)
		a.auditService.LogAuthEvent(ctx, event)

		// Log account lock event if account was just locked
		if user.IsAccountLocked() && user.FailedLoginCount == a.config.MaxFailedAttempts {
			lockEvent := CreateAccountLockEvent(&userID, email, ipAddress, userAgent, map[string]interface{}{
				"reason":           "max_failed_attempts",
				"failed_attempts":  user.FailedLoginCount,
				"lockout_duration": a.config.LockoutDuration.String(),
				"locked_until":     user.LockedUntil,
			})
			a.auditService.LogAuthEvent(ctx, lockEvent)
		}
	}

	// Return account locked error if account is now locked
	if user.IsAccountLocked() {
		return NewAccountLockedError(user.LockedUntil)
	}

	return nil
}

// HandleSuccessfulLogin handles a successful login and resets failed attempts
func (a *accountLockoutService) HandleSuccessfulLogin(ctx context.Context, userID, email, ipAddress, userAgent string) error {
	// Reset rate limiting for this email
	loginKey := LoginRateLimitKey(email)
	if err := a.rateLimiter.Reset(ctx, loginKey); err != nil {
		// Log error but don't fail the login
		// This is not critical for the login process
	}

	// Reset failed login count in database
	if err := a.userRepo.ResetFailedLoginCount(ctx, userID); err != nil {
		return fmt.Errorf("failed to reset failed login count: %w", err)
	}

	// Update last login timestamp
	if err := a.userRepo.UpdateLastLogin(ctx, userID, time.Now(), ipAddress); err != nil {
		// Log error but don't fail the login
		// This is not critical for the login process
	}

	// Log successful login event
	if a.auditService != nil {
		event := CreateLoginEvent(&userID, email, ipAddress, userAgent, true, map[string]interface{}{
			"failed_login_count_reset": true,
		})
		a.auditService.LogAuthEvent(ctx, event)
	}

	return nil
}

// UnlockAccount manually unlocks an account
func (a *accountLockoutService) UnlockAccount(ctx context.Context, userID, adminUserID string) error {
	// Get user to check if it exists and is locked
	user, err := a.userRepo.GetByStringID(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	if !user.IsAccountLocked() {
		return fmt.Errorf("account is not locked")
	}

	// Unlock the account
	if err := a.userRepo.UnlockAccount(ctx, userID); err != nil {
		return fmt.Errorf("failed to unlock account: %w", err)
	}

	// Reset failed login count
	if err := a.userRepo.ResetFailedLoginCount(ctx, userID); err != nil {
		return fmt.Errorf("failed to reset failed login count: %w", err)
	}

	// Reset rate limiting for this email
	loginKey := LoginRateLimitKey(user.Email)
	if err := a.rateLimiter.Reset(ctx, loginKey); err != nil {
		// Log error but don't fail the unlock
	}

	// Log account unlock event
	if a.auditService != nil {
		event := CreateAccountUnlockEvent(&userID, user.Email, "", "", map[string]interface{}{
			"admin_user_id": adminUserID,
			"manual_unlock": true,
		})
		a.auditService.LogAuthEvent(ctx, event)
	}

	return nil
}

// GetLockedAccounts retrieves all currently locked accounts
func (a *accountLockoutService) GetLockedAccounts(ctx context.Context) ([]model.User, error) {
	return a.userRepo.GetLockedUsers(ctx)
}

// GetAccountsWithFailedLogins retrieves accounts with failed login attempts above threshold
func (a *accountLockoutService) GetAccountsWithFailedLogins(ctx context.Context, threshold int) ([]model.User, error) {
	return a.userRepo.GetUsersWithFailedLogins(ctx, threshold)
}

// AccountLockedError represents an account locked error
type AccountLockedError struct {
	LockedUntil *time.Time
}

func (e *AccountLockedError) Error() string {
	if e.LockedUntil == nil {
		return "account is locked"
	}
	return fmt.Sprintf("account is locked until %v", e.LockedUntil.Format(time.RFC3339))
}

// NewAccountLockedError creates a new account locked error
func NewAccountLockedError(lockedUntil *time.Time) *AccountLockedError {
	return &AccountLockedError{
		LockedUntil: lockedUntil,
	}
}

// IsAccountLockedError checks if an error is an account locked error
func IsAccountLockedError(err error) bool {
	_, ok := err.(*AccountLockedError)
	return ok
}
