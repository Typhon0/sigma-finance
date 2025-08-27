package service

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"sigma_finance/internal/config"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
)

// ServiceContainer holds all service instances
type ServiceContainer struct {
	User           IUserService
	Portfolio      IPortfolioService
	Asset          IAssetService
	Transaction    ITransactionService
	Watchlist      IWatchlistService
	Tag            ITagService
	Authentication AuthenticationService
	Session        SessionService
	Email          EmailService
}

// NewServiceContainer creates a new service container with all services initialized
func NewServiceContainer(uow repository.IUnitOfWork, cfg *config.Config) *ServiceContainer {
	// Initialize email service
	var emailService EmailService
	if cfg != nil && cfg.Email.SMTPHost != "" {
		emailService = NewSMTPEmailService(&cfg.Email)
	} else {
		// Use mock email service for development/testing
		emailService = NewMockEmailService()
	}

	// Initialize rate limiter
	rateLimiter := NewInMemoryRateLimiter()

	// Initialize security service with generated RSA keys
	privateKey, publicKey, err := generateRSAKeyPair()
	if err != nil {
		panic(fmt.Sprintf("Failed to generate RSA key pair: %v", err))
	}

	securityConfig := SecurityConfig{
		JWTPrivateKey: privateKey,
		JWTPublicKey:  publicKey,
		BCryptCost:    12,
	}

	securityService, err := NewSecurityService(securityConfig, rateLimiter)
	if err != nil {
		panic(fmt.Sprintf("Failed to initialize security service: %v", err))
	}

	// Initialize audit service
	auditService := NewAuditService(uow.AuthEvent())

	// Initialize authentication providers
	userRepoAdapter := &userRepositoryAdapter{repo: uow.User()}
	localAuthProvider := NewLocalAuthProvider(userRepoAdapter, securityService)
	authProviders := []AuthProvider{localAuthProvider}

	// Initialize session service
	sessionConfig := DefaultSessionServiceConfig()
	sessionService := NewSessionService(
		uow.Session(),
		uow.User(),
		securityService,
		auditService,
		sessionConfig,
	)

	// Initialize authentication service
	authService := NewAuthenticationService(
		uow.User(),
		sessionService,
		uow.PasswordResetToken(),
		uow.EmailVerificationToken(),
		securityService,
		auditService,
		emailService,
		authProviders,
	)

	return &ServiceContainer{
		User:           NewUserService(uow),
		Portfolio:      NewPortfolioService(uow),
		Asset:          NewAssetService(uow),
		Transaction:    NewTransactionService(uow),
		Watchlist:      NewWatchlistService(uow),
		Tag:            NewTagService(uow),
		Authentication: authService,
		Session:        sessionService,
		Email:          emailService,
	}
}

// generateRSAKeyPair generates a new RSA key pair for JWT signing
func generateRSAKeyPair() (privateKeyPEM, publicKeyPEM string, err error) {
	// Generate RSA private key
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate private key: %w", err)
	}

	// Encode private key to PEM
	privateKeyBytes := x509.MarshalPKCS1PrivateKey(privateKey)
	privateKeyPEM = string(pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: privateKeyBytes,
	}))

	// Encode public key to PEM
	publicKeyBytes, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	if err != nil {
		return "", "", fmt.Errorf("failed to marshal public key: %w", err)
	}

	publicKeyPEM = string(pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: publicKeyBytes,
	}))

	return privateKeyPEM, publicKeyPEM, nil
}

// userRepositoryAdapter adapts IUserRepository to UserRepository interface
type userRepositoryAdapter struct {
	repo repository.IUserRepository
}

func (a *userRepositoryAdapter) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	return a.repo.GetByEmail(ctx, email)
}

func (a *userRepositoryAdapter) Create(ctx context.Context, user *model.User) error {
	_, err := a.repo.Create(ctx, user)
	return err
}

func (a *userRepositoryAdapter) Update(ctx context.Context, user *model.User) error {
	return a.repo.Update(ctx, user)
}
