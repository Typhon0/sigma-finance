package service

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
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
}

// JWTClaims represents the claims in a JWT token
type JWTClaims struct {
	UserID string `json:"user_id"`
	jwt.RegisteredClaims
}

// SecurityConfig holds configuration for the security service
type SecurityConfig struct {
	JWTPrivateKey string
	JWTPublicKey  string
	BCryptCost    int
}

// securityService implements SecurityService
type securityService struct {
	privateKey *rsa.PrivateKey
	publicKey  *rsa.PublicKey
	bcryptCost int
}

// NewSecurityService creates a new SecurityService instance
func NewSecurityService(config SecurityConfig) (SecurityService, error) {
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

	// Validate bcrypt cost
	bcryptCost := config.BCryptCost
	if bcryptCost < 12 {
		bcryptCost = 12 // Minimum cost factor as per requirements
	}

	return &securityService{
		privateKey: privateKey,
		publicKey:  publicKey,
		bcryptCost: bcryptCost,
	}, nil
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

// GenerateJWT generates a JWT token with RS256 signing
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
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "sigma-finance",
			Subject:   userID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)

	tokenString, err := token.SignedString(s.privateKey)
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
		// Verify the signing method
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.publicKey, nil
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
// This is a placeholder implementation - in production, this would use Redis or similar
func (s *securityService) CheckRateLimit(ctx context.Context, key string, limit int, window time.Duration) error {
	// TODO: Implement actual rate limiting with Redis or in-memory store
	// For now, this is a placeholder that always allows requests
	// This will be implemented in task 5: "Implement rate limiting and security middleware"
	return nil
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
