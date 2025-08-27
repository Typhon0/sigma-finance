package service

import (
	"context"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
)

// AuditService provides audit logging functionality
type AuditService interface {
	// LogAuthEvent logs an authentication event
	LogAuthEvent(ctx context.Context, event *model.AuthEvent) error

	// LogSecurityEvent logs a security-related event
	LogSecurityEvent(ctx context.Context, eventType, ipAddress, userAgent string, metadata map[string]interface{}) error

	// GetAuthEvents retrieves authentication events for a user
	GetAuthEvents(ctx context.Context, userID string, limit int, offset int) ([]*model.AuthEvent, error)

	// GetSecurityEvents retrieves security events by IP or time range
	GetSecurityEvents(ctx context.Context, ipAddress string, since time.Time, limit int) ([]*model.AuthEvent, error)
}

// auditService implements AuditService
type auditService struct {
	authEventRepo repository.AuthEventRepository
}

// NewAuditService creates a new AuditService instance
func NewAuditService(authEventRepo repository.AuthEventRepository) AuditService {
	return &auditService{
		authEventRepo: authEventRepo,
	}
}

// LogAuthEvent logs an authentication event
func (a *auditService) LogAuthEvent(ctx context.Context, event *model.AuthEvent) error {
	if err := event.Validate(); err != nil {
		return err
	}

	return a.authEventRepo.Create(ctx, event)
}

// LogSecurityEvent logs a security-related event
func (a *auditService) LogSecurityEvent(ctx context.Context, eventType, ipAddress, userAgent string, metadata map[string]interface{}) error {
	event := model.NewAuthEvent(
		nil, // No user ID for security events
		"",  // No email for security events
		eventType,
		false, // Security events are typically failures
		ipAddress,
		userAgent,
		metadata,
	)

	return a.authEventRepo.Create(ctx, event)
}

// GetAuthEvents retrieves authentication events for a user
func (a *auditService) GetAuthEvents(ctx context.Context, userID string, limit int, offset int) ([]*model.AuthEvent, error) {
	return a.authEventRepo.GetByUserID(ctx, userID, limit, offset)
}

// GetSecurityEvents retrieves security events by IP or time range
func (a *auditService) GetSecurityEvents(ctx context.Context, ipAddress string, since time.Time, limit int) ([]*model.AuthEvent, error) {
	return a.authEventRepo.GetByIPAddress(ctx, ipAddress, since, limit)
}

// Helper functions for creating common auth events

// CreateLoginEvent creates a login authentication event
func CreateLoginEvent(userID *string, email, ipAddress, userAgent string, success bool, metadata map[string]interface{}) *model.AuthEvent {
	return model.NewAuthEvent(userID, email, model.AuthActionLogin, success, ipAddress, userAgent, metadata)
}

// CreateRegisterEvent creates a registration authentication event
func CreateRegisterEvent(userID *string, email, ipAddress, userAgent string, success bool, metadata map[string]interface{}) *model.AuthEvent {
	return model.NewAuthEvent(userID, email, model.AuthActionRegister, success, ipAddress, userAgent, metadata)
}

// CreateLogoutEvent creates a logout authentication event
func CreateLogoutEvent(userID *string, email, ipAddress, userAgent string, success bool, metadata map[string]interface{}) *model.AuthEvent {
	return model.NewAuthEvent(userID, email, model.AuthActionLogout, success, ipAddress, userAgent, metadata)
}

// CreatePasswordResetEvent creates a password reset authentication event
func CreatePasswordResetEvent(userID *string, email, ipAddress, userAgent string, success bool, metadata map[string]interface{}) *model.AuthEvent {
	return model.NewAuthEvent(userID, email, model.AuthActionPasswordReset, success, ipAddress, userAgent, metadata)
}

// CreateEmailVerifyEvent creates an email verification authentication event
func CreateEmailVerifyEvent(userID *string, email, ipAddress, userAgent string, success bool, metadata map[string]interface{}) *model.AuthEvent {
	return model.NewAuthEvent(userID, email, model.AuthActionEmailVerify, success, ipAddress, userAgent, metadata)
}

// CreateAccountLockEvent creates an account lock authentication event
func CreateAccountLockEvent(userID *string, email, ipAddress, userAgent string, metadata map[string]interface{}) *model.AuthEvent {
	return model.NewAuthEvent(userID, email, model.AuthActionAccountLock, true, ipAddress, userAgent, metadata)
}

// CreateAccountUnlockEvent creates an account unlock authentication event
func CreateAccountUnlockEvent(userID *string, email, ipAddress, userAgent string, metadata map[string]interface{}) *model.AuthEvent {
	return model.NewAuthEvent(userID, email, model.AuthActionAccountUnlock, true, ipAddress, userAgent, metadata)
}
