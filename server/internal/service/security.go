package service

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// SecurityService provides cryptographic and security utilities
type SecurityService interface {
	// Password operations
	HashPassword(password string) (string, error)
	VerifyPassword(password, hash string) error

	// JWT operations
	GenerateJWT(userID string, expiresAt time.Time) (string, error)
	ValidateJWT(token string) (*JWTClaims, error)

	// Secure token generation
	GenerateSecureToken() (string, error)

	// Rate limiting
	CheckRateLimit(ctx context.Context, key string, limit int, window time.Duration) error
	ResetRateLimit(ctx context.Context, key string) error
	GetRateLimitAttempts(ctx context.Context, key string) (int, error)

	// Symmetric encryption (AES-256-GCM) for sensitive secrets
	EncryptString(plaintext string) (string, error)
	DecryptString(ciphertext string) (string, error)
}

// JWTClaims represents the claims in a JWT token
type JWTClaims struct {
	UserID string `json:"user_id"`
	jwt.RegisteredClaims
}

// SecurityConfig holds configuration for the security service
type SecurityConfig struct {
	JWTSecretKey  string // For HMAC algorithms
	JWTPrivateKey string // For RSA algorithms
	JWTPublicKey  string // For RSA algorithms
	JWTAlgorithm  string // Algorithm to use (HS256, RS256, etc.)
	BCryptCost    int
	SymmetricKey  string // base64 encoded 32 bytes
}

// securityService implements SecurityService
type securityService struct {
	secretKey   []byte          // For HMAC algorithms
	privateKey  *rsa.PrivateKey // For RSA algorithms
	publicKey   *rsa.PublicKey  // For RSA algorithms
	algorithm   string
	bcryptCost  int
	rateLimiter RateLimiter
	symmKey     []byte
}

// NewSecurityService creates a new SecurityService instance
func NewSecurityService(config SecurityConfig, rateLimiter RateLimiter) (SecurityService, error) {
	// Validate bcrypt cost
	bcryptCost := config.BCryptCost
	if bcryptCost < 12 {
		bcryptCost = 12 // Minimum cost factor as per requirements
	}

	service := &securityService{
		algorithm:   config.JWTAlgorithm,
		bcryptCost:  bcryptCost,
		rateLimiter: rateLimiter,
	}

	// Load symmetric key if provided
	keyStr := config.SymmetricKey
	if keyStr == "" {
		keyStr = os.Getenv("ENCRYPTION_KEY")
	}
	if keyStr != "" {
		keyStr = strings.TrimSpace(keyStr)
		var decoded []byte
		log.Printf("[DEBUG] Loading symmetric key, input length: %d", len(keyStr))
		// Try hex first (most common for AES-256)
		decoded, err := hex.DecodeString(keyStr)
		if err != nil {
			// Try base64
			decoded, err = base64.StdEncoding.DecodeString(keyStr)
			if err != nil {
				// Try URL base64
				decoded, err = base64.URLEncoding.DecodeString(keyStr)
				if err != nil {
					// Try raw string
					decoded = []byte(keyStr)
				}
			}
		}
		log.Printf("[DEBUG] Decoded key length: %d", len(decoded))
		if len(decoded) != 32 {
			return nil, fmt.Errorf("symmetric key must be 32 bytes after decoding, got %d", len(decoded))
		}
		service.symmKey = decoded
	}

	// Configure JWT signing based on algorithm
	switch config.JWTAlgorithm {
	case "HS256", "HS384", "HS512":
		// HMAC algorithms use a secret key
		if config.JWTSecretKey == "" {
			return nil, fmt.Errorf("JWT secret key is required for HMAC algorithms")
		}
		service.secretKey = []byte(config.JWTSecretKey)

	case "RS256", "RS384", "RS512":
		// RSA algorithms use public/private key pairs
		if config.JWTPrivateKey == "" || config.JWTPublicKey == "" {
			return nil, fmt.Errorf("JWT private and public keys are required for RSA algorithms")
		}

		// Parse private key
		privateKeyBlock, _ := pem.Decode([]byte(config.JWTPrivateKey))
		if privateKeyBlock == nil {
			return nil, fmt.Errorf("failed to decode private key PEM")
		}

		privateKey, err := x509.ParsePKCS1PrivateKey(privateKeyBlock.Bytes)
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %w", err)
		}

		// Parse public key
		publicKeyBlock, _ := pem.Decode([]byte(config.JWTPublicKey))
		if publicKeyBlock == nil {
			return nil, fmt.Errorf("failed to decode public key PEM")
		}

		publicKeyInterface, err := x509.ParsePKIXPublicKey(publicKeyBlock.Bytes)
		if err != nil {
			return nil, fmt.Errorf("failed to parse public key: %w", err)
		}

		publicKey, ok := publicKeyInterface.(*rsa.PublicKey)
		if !ok {
			return nil, fmt.Errorf("public key is not RSA")
		}

		service.privateKey = privateKey
		service.publicKey = publicKey

	default:
		return nil, fmt.Errorf("unsupported JWT algorithm: %s", config.JWTAlgorithm)
	}

	return service, nil
}

// HashPassword hashes a password using bcrypt with cost factor 12
func (s *securityService) HashPassword(password string) (string, error) {
	if len(password) == 0 {
		return "", fmt.Errorf("password cannot be empty")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), s.bcryptCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash password: %w", err)
	}

	return string(hash), nil
}

// VerifyPassword verifies a password against its hash
func (s *securityService) VerifyPassword(password, hash string) error {
	if len(password) == 0 {
		return fmt.Errorf("password cannot be empty")
	}

	if len(hash) == 0 {
		return fmt.Errorf("hash cannot be empty")
	}

	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	if err != nil {
		return fmt.Errorf("password verification failed: %w", err)
	}

	return nil
}

// GenerateJWT generates a JWT token with the configured signing method
func (s *securityService) GenerateJWT(userID string, expiresAt time.Time) (string, error) {
	if len(userID) == 0 {
		return "", fmt.Errorf("userID cannot be empty")
	}

	if expiresAt.Before(time.Now()) {
		return "", fmt.Errorf("expiration time cannot be in the past")
	}

	claims := JWTClaims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.NewString(), // jti — ensures uniqueness across tokens for same user/second
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "sigma-finance",
			Subject:   userID,
		},
	}

	// Choose signing method based on algorithm
	var signingMethod jwt.SigningMethod
	var signingKey interface{}

	switch s.algorithm {
	case "HS256":
		signingMethod = jwt.SigningMethodHS256
		signingKey = s.secretKey
	case "HS384":
		signingMethod = jwt.SigningMethodHS384
		signingKey = s.secretKey
	case "HS512":
		signingMethod = jwt.SigningMethodHS512
		signingKey = s.secretKey
	case "RS256":
		signingMethod = jwt.SigningMethodRS256
		signingKey = s.privateKey
	case "RS384":
		signingMethod = jwt.SigningMethodRS384
		signingKey = s.privateKey
	case "RS512":
		signingMethod = jwt.SigningMethodRS512
		signingKey = s.privateKey
	default:
		return "", fmt.Errorf("unsupported JWT algorithm: %s", s.algorithm)
	}

	token := jwt.NewWithClaims(signingMethod, claims)

	tokenString, err := token.SignedString(signingKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT token: %w", err)
	}

	return tokenString, nil
}

// ValidateJWT validates a JWT token and returns the claims
func (s *securityService) ValidateJWT(tokenString string) (*JWTClaims, error) {
	if len(tokenString) == 0 {
		return nil, fmt.Errorf("token cannot be empty")
	}

	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Verify the signing method matches our algorithm
		switch s.algorithm {
		case "HS256", "HS384", "HS512":
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v, expected HMAC", token.Header["alg"])
			}
			return s.secretKey, nil
		case "RS256", "RS384", "RS512":
			if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v, expected RSA", token.Header["alg"])
			}
			return s.publicKey, nil
		default:
			return nil, fmt.Errorf("unsupported JWT algorithm: %s", s.algorithm)
		}
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse JWT token: %w", err)
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid JWT token")
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok {
		return nil, fmt.Errorf("invalid JWT claims")
	}

	return claims, nil
}

// EncryptString encrypts plaintext with AES-256-GCM returning base64(nonce||ciphertext)
func (s *securityService) EncryptString(plaintext string) (string, error) {
	if s.symmKey == nil {
		return "", errors.New("symmetric key not configured")
	}
	block, err := aes.NewCipher(s.symmKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ct := gcm.Seal(nil, nonce, []byte(plaintext), nil)
	out := append(nonce, ct...)
	return base64.StdEncoding.EncodeToString(out), nil
}

// DecryptString decrypts base64(nonce||ciphertext) returning plaintext
func (s *securityService) DecryptString(ciphertext string) (string, error) {
	if s.symmKey == nil {
		return "", errors.New("symmetric key not configured")
	}
	raw, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(s.symmKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", errors.New("ciphertext too short")
	}
	nonce := raw[:gcm.NonceSize()]
	ct := raw[gcm.NonceSize():]
	pt, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", err
	}
	return string(pt), nil
}

// GenerateSecureToken generates a cryptographically secure random token
func (s *securityService) GenerateSecureToken() (string, error) {
	// Generate 32 bytes of random data (256 bits)
	bytes := make([]byte, 32)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", fmt.Errorf("failed to generate secure token: %w", err)
	}

	// Encode as base64 URL-safe string
	return base64.URLEncoding.EncodeToString(bytes), nil
}

// CheckRateLimit checks if a rate limit has been exceeded
func (s *securityService) CheckRateLimit(ctx context.Context, key string, limit int, window time.Duration) error {
	return s.rateLimiter.CheckRateLimit(ctx, key, limit, window)
}

// ResetRateLimit clears the rate limit for a specific key
func (s *securityService) ResetRateLimit(ctx context.Context, key string) error {
	return s.rateLimiter.Reset(ctx, key)
}

// GetRateLimitAttempts returns the current number of attempts for a key
func (s *securityService) GetRateLimitAttempts(ctx context.Context, key string) (int, error) {
	return s.rateLimiter.GetAttempts(ctx, key)
}

// GenerateRSAKeyPair generates a new RSA key pair for JWT signing
// This is a utility function for testing and initial setup
func GenerateRSAKeyPair() (privateKeyPEM, publicKeyPEM string, err error) {
	// Generate private key
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
