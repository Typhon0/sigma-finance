package service

import (
	"context"
	"fmt"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
)

// SessionService provides session management functionality
type SessionService interface {
	// Session lifecycle management
	CreateSession(ctx context.Context, userID string, ipAddress, userAgent string) (*model.Session, error)
	ValidateSession(ctx context.Context, token string) (*model.Session, error)
	RefreshSession(ctx context.Context, refreshToken string) (*model.Session, error)
	RevokeSession(ctx context.Context, token string) error
	RevokeAllUserSessions(ctx context.Context, userID string) error

	// Session queries
	GetUserSessions(ctx context.Context, userID string) ([]model.Session, error)
	GetActiveUserSessions(ctx context.Context, userID string) ([]model.Session, error)

	// Session maintenance
	CleanupExpiredSessions(ctx context.Context) (int, error)
	ExtendSession(ctx context.Context, sessionID string, duration time.Duration) error
}

// SessionServiceConfig holds configuration for the session service
type SessionServiceConfig struct {
	JWTExpiration          time.Duration
	RefreshTokenExpiration time.Duration
	MaxSessionsPerUser     int
}

// DefaultSessionServiceConfig returns default configuration
func DefaultSessionServiceConfig() SessionServiceConfig {
	return SessionServiceConfig{
		JWTExpiration:          15 * time.Minute,   // Short-lived access tokens
		RefreshTokenExpiration: 7 * 24 * time.Hour, // 7 days for refresh tokens
		MaxSessionsPerUser:     10,                 // Maximum concurrent sessions per user
	}
}

// sessionService implements SessionService
type sessionService struct {
	sessionRepo     repository.ISessionRepository
	userRepo        repository.IUserRepository
	securityService SecurityService
	auditService    AuditService
	config          SessionServiceConfig
}

// NewSessionService creates a new SessionService instance
func NewSessionService(
	sessionRepo repository.ISessionRepository,
	userRepo repository.IUserRepository,
	securityService SecurityService,
	auditService AuditService,
	config SessionServiceConfig,
) SessionService {
	return &sessionService{
		sessionRepo:     sessionRepo,
		userRepo:        userRepo,
		securityService: securityService,
		auditService:    auditService,
		config:          config,
	}
}

// CreateSession creates a new session for a user
func (s *sessionService) CreateSession(ctx context.Context, userID string, ipAddress, userAgent string) (*model.Session, error) {
	if userID == "" {
		return nil, fmt.Errorf("user ID is required")
	}

	// Verify user exists
	user, err := s.userRepo.GetByStringID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Check if user account is locked
	if user.IsAccountLocked() {
		return nil, NewAuthError(ErrAccountLocked, "Account is locked", "")
	}

	// Generate JWT token
	expiresAt := time.Now().Add(s.config.JWTExpiration)
	token, err := s.securityService.GenerateJWT(userID, expiresAt)
	if err != nil {
		return nil, fmt.Errorf("failed to generate JWT token: %w", err)
	}

	// Generate refresh token
	refreshToken, err := s.securityService.GenerateSecureToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Check session limit per user
	activeSessions, err := s.sessionRepo.GetActiveSessionsByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get active sessions: %w", err)
	}

	// If user has too many sessions, revoke the oldest ones
	if len(activeSessions) >= s.config.MaxSessionsPerUser {
		sessionsToRevoke := len(activeSessions) - s.config.MaxSessionsPerUser + 1
		for i := 0; i < sessionsToRevoke && i < len(activeSessions); i++ {
			if err := s.sessionRepo.RevokeSession(ctx, activeSessions[len(activeSessions)-1-i].Token); err != nil {
				// Log but don't fail session creation
				s.auditService.LogSecurityEvent(ctx, "session_revoke_failed", ipAddress, userAgent, map[string]interface{}{
					"user_id":    userID,
					"session_id": activeSessions[len(activeSessions)-1-i].ID,
				})
			}
		}
	}

	// Create session
	session := &model.Session{
		UserID:       userID,
		Token:        token,
		RefreshToken: refreshToken,
		ExpiresAt:    time.Now().Add(s.config.RefreshTokenExpiration),
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
	}

	if err := session.Validate(); err != nil {
		return nil, err
	}

	createdSession, err := s.sessionRepo.Create(ctx, session)
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	// Log session creation
	event := model.NewAuthEvent(&userID, user.Email, model.AuthActionLogin, true, ipAddress, userAgent, map[string]interface{}{
		"user_id":    userID,
		"session_id": createdSession.ID,
	})
	s.auditService.LogAuthEvent(ctx, event)

	return createdSession, nil
}

// ValidateSession validates a JWT token and returns the session
func (s *sessionService) ValidateSession(ctx context.Context, token string) (*model.Session, error) {
	if token == "" {
		return nil, NewAuthError(ErrInvalidInput, "Token is required", "token")
	}

	// Validate JWT token
	claims, err := s.securityService.ValidateJWT(token)
	if err != nil {
		fmt.Printf("DEBUG: JWT validation failed: %v\n", err)
		return nil, NewAuthError(ErrInvalidToken, "Invalid token", "token")
	}

	// Get session from database
	session, err := s.sessionRepo.GetByToken(ctx, token)
	if err != nil {
		return nil, NewAuthError(ErrInvalidToken, "Session not found", "token")
	}

	// Check if session is expired
	if session.IsExpired() {
		return nil, NewAuthError(ErrTokenExpired, "Session has expired", "token")
	}

	// Verify user still exists and is not locked
	user, err := s.userRepo.GetByStringID(ctx, claims.UserID)
	if err != nil {
		return nil, NewAuthError(ErrInvalidToken, "Invalid token", "token")
	}

	if user.IsAccountLocked() {
		return nil, NewAuthError(ErrAccountLocked, "Account is locked", "")
	}

	return session, nil
}

// RefreshSession refreshes a session using a refresh token
func (s *sessionService) RefreshSession(ctx context.Context, refreshToken string) (*model.Session, error) {
	if refreshToken == "" {
		return nil, NewAuthError(ErrInvalidInput, "Refresh token is required", "refreshToken")
	}

	// Get session by refresh token
	session, err := s.sessionRepo.GetByRefreshToken(ctx, refreshToken)
	if err != nil {
		return nil, NewAuthError(ErrInvalidToken, "Invalid refresh token", "refreshToken")
	}

	// Check if session is expired
	if session.IsExpired() {
		return nil, NewAuthError(ErrTokenExpired, "Refresh token has expired", "refreshToken")
	}

	// Get user to verify account status
	user, err := s.userRepo.GetByStringID(ctx, session.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if user.IsAccountLocked() {
		return nil, NewAuthError(ErrAccountLocked, "Account is locked", "")
	}

	// Generate new tokens
	expiresAt := time.Now().Add(s.config.JWTExpiration)
	newToken, err := s.securityService.GenerateJWT(session.UserID, expiresAt)
	if err != nil {
		return nil, fmt.Errorf("failed to generate JWT token: %w", err)
	}

	newRefreshToken, err := s.securityService.GenerateSecureToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Update session with new tokens
	newSessionExpiry := time.Now().Add(s.config.RefreshTokenExpiration)
	if err := s.sessionRepo.RefreshSession(ctx, session.ID, newToken, newRefreshToken, newSessionExpiry); err != nil {
		return nil, fmt.Errorf("failed to refresh session: %w", err)
	}

	// Get updated session
	updatedSession, err := s.sessionRepo.GetByStringID(ctx, session.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get updated session: %w", err)
	}

	// Log token refresh
	event := model.NewAuthEvent(&session.UserID, user.Email, model.AuthActionTokenRefresh, true, session.IPAddress, session.UserAgent, map[string]interface{}{
		"user_id":    session.UserID,
		"session_id": session.ID,
	})
	s.auditService.LogAuthEvent(ctx, event)

	return updatedSession, nil
}

// RevokeSession revokes a session by token
func (s *sessionService) RevokeSession(ctx context.Context, token string) error {
	if token == "" {
		return NewAuthError(ErrInvalidInput, "Token is required", "token")
	}

	// Get session to log user info
	session, err := s.sessionRepo.GetByToken(ctx, token)
	if err != nil {
		// Session might not exist, but that's okay for revocation
		return nil
	}

	// Revoke the session
	if err := s.sessionRepo.RevokeSession(ctx, token); err != nil {
		return fmt.Errorf("failed to revoke session: %w", err)
	}

	// Get user for audit logging
	user, err := s.userRepo.GetByStringID(ctx, session.UserID)
	if err != nil {
		// Log without user info if user not found
		event := model.NewAuthEvent(&session.UserID, "", model.AuthActionLogout, true, session.IPAddress, session.UserAgent, map[string]interface{}{
			"user_id":    session.UserID,
			"session_id": session.ID,
		})
		s.auditService.LogAuthEvent(ctx, event)
		return nil
	}

	// Log logout event
	event := model.NewAuthEvent(&session.UserID, user.Email, model.AuthActionLogout, true, session.IPAddress, session.UserAgent, map[string]interface{}{
		"user_id":    session.UserID,
		"session_id": session.ID,
	})
	s.auditService.LogAuthEvent(ctx, event)

	return nil
}

// RevokeAllUserSessions revokes all sessions for a user
func (s *sessionService) RevokeAllUserSessions(ctx context.Context, userID string) error {
	if userID == "" {
		return NewAuthError(ErrInvalidInput, "User ID is required", "userID")
	}

	// Get user for audit logging
	user, err := s.userRepo.GetByStringID(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	// Revoke all sessions
	if err := s.sessionRepo.RevokeAllUserSessions(ctx, userID); err != nil {
		return fmt.Errorf("failed to revoke user sessions: %w", err)
	}

	// Log session revocation
	event := model.NewAuthEvent(&userID, user.Email, "sessions_revoked", true, "", "", map[string]interface{}{
		"user_id": userID,
	})
	s.auditService.LogAuthEvent(ctx, event)

	return nil
}

// GetUserSessions returns all sessions for a user
func (s *sessionService) GetUserSessions(ctx context.Context, userID string) ([]model.Session, error) {
	if userID == "" {
		return nil, NewAuthError(ErrInvalidInput, "User ID is required", "userID")
	}

	sessions, err := s.sessionRepo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user sessions: %w", err)
	}

	return sessions, nil
}

// GetActiveUserSessions returns all active sessions for a user
func (s *sessionService) GetActiveUserSessions(ctx context.Context, userID string) ([]model.Session, error) {
	if userID == "" {
		return nil, NewAuthError(ErrInvalidInput, "User ID is required", "userID")
	}

	sessions, err := s.sessionRepo.GetActiveSessionsByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get active user sessions: %w", err)
	}

	return sessions, nil
}

// CleanupExpiredSessions removes expired sessions from the database
func (s *sessionService) CleanupExpiredSessions(ctx context.Context) (int, error) {
	count, err := s.sessionRepo.RevokeExpiredSessions(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup expired sessions: %w", err)
	}

	// Log cleanup operation
	s.auditService.LogSecurityEvent(ctx, "session_cleanup", "", "", map[string]interface{}{
		"expired_sessions_count": count,
	})

	return count, nil
}

// ExtendSession extends the expiration time of a session
func (s *sessionService) ExtendSession(ctx context.Context, sessionID string, duration time.Duration) error {
	if sessionID == "" {
		return NewAuthError(ErrInvalidInput, "Session ID is required", "sessionID")
	}

	if duration <= 0 {
		return NewAuthError(ErrInvalidInput, "Duration must be positive", "duration")
	}

	// Get session to verify it exists
	session, err := s.sessionRepo.GetByStringID(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to get session: %w", err)
	}

	// Calculate new expiration time
	newExpiresAt := time.Now().Add(duration)

	// Update session expiry
	if err := s.sessionRepo.UpdateSessionExpiry(ctx, sessionID, newExpiresAt); err != nil {
		return fmt.Errorf("failed to extend session: %w", err)
	}

	// Log session extension
	event := model.NewAuthEvent(&session.UserID, "", "session_extended", true, session.IPAddress, session.UserAgent, map[string]interface{}{
		"user_id":            session.UserID,
		"session_id":         sessionID,
		"new_expires_at":     newExpiresAt,
		"extension_duration": duration.String(),
	})
	s.auditService.LogAuthEvent(ctx, event)

	return nil
}
