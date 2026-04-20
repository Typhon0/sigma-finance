package service

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"log"
	"sigma_finance/internal/config"
	"sigma_finance/internal/domain/model"
	coingeckoclient "sigma_finance/internal/infrastructure/coingecko"
	grpcclient "sigma_finance/internal/infrastructure/grpc"
	"sigma_finance/internal/repository"
	"time"
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
	Security       SecurityService
	MarketData     MarketDataService
	Performance    IPerformanceService
	Notification   *NotificationService
	Alert          *AlertService
	Monitoring     *MonitoringService
	Instrument     InstrumentService
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

	var discoveryClient InstrumentDiscoveryClient
	var cryptoDiscoveryClient InstrumentDiscoveryClient
	if cfg != nil && cfg.MarketData.YFinance.Host != "" {
		client, err := grpcclient.NewMarketDataClient(cfg.MarketData.YFinance.Host, cfg.MarketData.YFinance.Port)
		if err != nil {
			log.Printf("[ServiceContainer] WARNING: Failed to create instrument discovery client: %v", err)
		} else {
			discoveryClient = client
		}
	}
	if cfg != nil {
		cryptoDiscoveryClient = coingeckoclient.NewClient(cfg.MarketData.CoinGeckoAPIBaseURL, cfg.MarketData.CoinGeckoDemoAPIKey)
	}

	// Initialize security service with configuration
	securityConfig := SecurityConfig{
		JWTSecretKey: cfg.JWT.SecretKey,
		JWTAlgorithm: cfg.JWT.Algorithm,
		BCryptCost:   cfg.Security.BcryptCost,
		SymmetricKey: cfg.MarketData.EncryptionKey,
	}

	// If using RSA algorithms, generate keys (for now, we'll use HMAC)
	if cfg.JWT.Algorithm == "RS256" || cfg.JWT.Algorithm == "RS384" || cfg.JWT.Algorithm == "RS512" {
		privateKey, publicKey, err := generateRSAKeyPair()
		if err != nil {
			panic(fmt.Sprintf("Failed to generate RSA key pair: %v", err))
		}
		securityConfig.JWTPrivateKey = privateKey
		securityConfig.JWTPublicKey = publicKey
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

	marketDataService := NewMarketDataService(
		uow,
		uow.(*repository.UnitOfWork).GetDB(),
		repository.NewCandleRepository(uow.(*repository.UnitOfWork).GetDB()),
		uow.MarketDataCredential(),
		uow.AssetPrice(),
		uow.Asset(),
		securityService,
		rateLimiter,
		cfg,
	)
	fxRateService := NewFXRateService(uow, 60)

	container := &ServiceContainer{
		User:           NewUserService(uow),
		Portfolio:      NewPortfolioService(uow),
		Asset:          NewAssetService(uow.Asset()),
		Transaction:    NewTransactionService(uow),
		Watchlist:      NewWatchlistService(uow),
		Tag:            NewTagService(uow),
		Authentication: authService,
		Session:        sessionService,
		Email:          emailService,
		Security:       securityService,
		MarketData:     marketDataService,
		Performance: NewPerformanceService(
			uow.Performance(),
			uow.AssetPrice(),
			uow.Position(),
			fxRateService,
		),
		Notification: NewNotificationService(uow, emailService, cfg),
		Alert: NewAlertService(
			uow.Alert(),
			uow.Asset(),
			uow.Portfolio(),
			uow.AssetPrice(),
			uow.Performance(),
			NewNotificationService(uow, emailService, cfg),
		),
		Monitoring: NewMonitoringService(),
		Instrument: NewInstrumentService(uow, discoveryClient, cryptoDiscoveryClient, marketDataService),
	}

	if portfolioService, ok := container.Portfolio.(*PortfolioService); ok {
		portfolioService.SetMarketDataService(marketDataService)
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		if err := ensureFXRatesTable(ctx, uow.(*repository.UnitOfWork).GetDB()); err != nil {
			log.Printf("[ServiceContainer] Failed to ensure FX table: %v", err)
		}

		fxScheduler := NewFXScheduler(uow, fxRateService, "")
		if err := fxScheduler.Start(FXSchedulerModeStandard); err != nil {
			log.Printf("[ServiceContainer] Failed to start FX scheduler: %v", err)
		} else {
			if err := fxScheduler.RefreshNow(ctx); err != nil {
				log.Printf("[ServiceContainer] Initial FX refresh failed: %v", err)
			} else {
				log.Printf("[ServiceContainer] Initial FX refresh completed")
			}
		}

		log.Printf("[ServiceContainer] Starting initial price fetch...")
		if err := container.MarketData.UpdateAssetPrices(ctx); err != nil {
			log.Printf("[ServiceContainer] Initial price fetch failed: %v", err)
		} else {
			log.Printf("[ServiceContainer] Initial price fetch completed")
		}

		log.Printf("[ServiceContainer] Starting periodic price update scheduler (every 5 minutes)...")
		if err := container.MarketData.SchedulePriceUpdates(ctx, 5*time.Minute); err != nil {
			log.Printf("[ServiceContainer] Failed to start price scheduler: %v", err)
		}
	}()

	return container
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
