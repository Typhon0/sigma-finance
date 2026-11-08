package enablebanking

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	defaultIssuer   = "enablebanking.com"
	defaultAudience = "api.enablebanking.com"
	defaultTTL      = 1 * time.Hour
)

// ParseRSAPrivateKey parses an RSA private key from PEM bytes (PKCS#1 or PKCS#8).
func ParseRSAPrivateKey(pemBytes []byte) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, errors.New("failed to decode PEM block: invalid private key format")
	}

	// Try PKCS#1
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}

	// Try PKCS#8
	parsedKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err == nil {
		if rsaKey, ok := parsedKey.(*rsa.PrivateKey); ok {
			return rsaKey, nil
		}
		return nil, errors.New("parsed PKCS#8 key is not an RSA private key")
	}

	return nil, fmt.Errorf("failed to parse RSA private key (tried PKCS#1 and PKCS#8): %w", err)
}

// GenerateJWT creates a signed RS256 JWT for Enable Banking API requests.
func GenerateJWT(applicationID string, privateKeyPEM string, ttl time.Duration, now time.Time) (string, error) {
	if strings.TrimSpace(applicationID) == "" {
		return "", errors.New("application ID is required")
	}
	if strings.TrimSpace(privateKeyPEM) == "" {
		return "", errors.New("private key PEM is required")
	}

	key, err := ParseRSAPrivateKey([]byte(privateKeyPEM))
	if err != nil {
		return "", fmt.Errorf("invalid RSA private key: %w", err)
	}

	if ttl <= 0 {
		ttl = defaultTTL
	}
	if ttl > 24*time.Hour {
		ttl = 24 * time.Hour
	}

	claims := jwt.MapClaims{
		"iss": defaultIssuer,
		"aud": defaultAudience,
		"iat": now.Unix(),
		"exp": now.Add(ttl).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = applicationID
	token.Header["typ"] = "JWT"

	signedString, err := token.SignedString(key)
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT: %w", err)
	}

	return signedString, nil
}

// GenerateRSAKeyPair generates a new 2048-bit RSA key pair.
// Returns the PKCS#8 private key PEM and a self-signed X.509 certificate PEM.
func GenerateRSAKeyPair() (string, string, error) {
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate rsa key: %w", err)
	}

	privBytes, err := x509.MarshalPKCS8PrivateKey(privKey)
	if err != nil {
		return "", "", fmt.Errorf("failed to marshal pkcs8 private key: %w", err)
	}
	privPEM := string(pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: privBytes,
	}))

	serialNumberLimit := new(big.Int).Lsh(big.NewInt(1), 128)
	serialNumber, err := rand.Int(rand.Reader, serialNumberLimit)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate serial number: %w", err)
	}

	template := x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			Organization: []string{"Sigma Finance"},
			CommonName:   "Enable Banking Client",
		},
		NotBefore:             time.Now().Add(-1 * time.Hour),
		NotAfter:              time.Now().Add(10 * 365 * 24 * time.Hour),
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		BasicConstraintsValid: true,
	}

	certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &privKey.PublicKey, privKey)
	if err != nil {
		return "", "", fmt.Errorf("failed to create certificate: %w", err)
	}

	certPEM := string(pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: certDER,
	}))

	return privPEM, certPEM, nil
}


