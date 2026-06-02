package model

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/uptrace/bun"
)

// encryptionKey holds the raw key material set at startup via SetEncryptionKey.
// The value may be hex-encoded, base64-encoded, or raw 32-byte ASCII.
// getEncryptionKey() decodes it to the 32-byte AES-256 key.
var encryptionKey string

// SetEncryptionKey sets the AES-256 encryption key used by MarketDataCredential.Encrypt/Decrypt.
// Must be called during application startup. The key must be exactly 32 bytes.
func SetEncryptionKey(key string) {
	encryptionKey = key
}

// getEncryptionKey returns the decoded 32-byte AES-256 key.
// It tries hex, base64 (std & URL), then raw 32-byte ASCII for backward compatibility.
func getEncryptionKey() ([]byte, error) {
	raw := encryptionKey
	if raw == "" {
		raw = os.Getenv("ENCRYPTION_KEY")
	}
	if raw == "" {
		return nil, fmt.Errorf("ENCRYPTION_KEY is not set; call SetEncryptionKey during startup or set the ENCRYPTION_KEY environment variable")
	}
	return decodeEncryptionKey(raw)
}

// decodeEncryptionKey decodes a key string using the same algorithm as SecurityService:
// hex → base64 std → base64 URL → raw 32-byte ASCII.
func decodeEncryptionKey(raw string) ([]byte, error) {
	// Try hex first (most common for AES-256 keys)
	if decoded, err := hex.DecodeString(raw); err == nil && len(decoded) == 32 {
		return decoded, nil
	}
	// Try standard base64
	if decoded, err := base64.StdEncoding.DecodeString(raw); err == nil && len(decoded) == 32 {
		return decoded, nil
	}
	// Try URL-safe base64
	if decoded, err := base64.URLEncoding.DecodeString(raw); err == nil && len(decoded) == 32 {
		return decoded, nil
	}
	// Backward compatibility: raw 32-byte ASCII string
	if len(raw) == 32 {
		return []byte(raw), nil
	}
	return nil, fmt.Errorf("encryption key must decode to 32 bytes (got %d raw chars)", len(raw))
}

// MarketDataCredential stores a user-provided API key for a market data provider.
type MarketDataCredential struct {
	bun.BaseModel   `bun:"market_data_credential"`
	ID              string     `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID          string     `bun:"user_id"`                 // NULL for system-wide credentials
	IsSystem        bool       `bun:"is_system,default:false"` // True for admin-set system-wide keys
	Provider        string     `bun:"provider,notnull"`
	APIKey          string     `bun:"api_key,notnull"` // Encrypted at rest
	IsEnabled       bool       `bun:"is_enabled,notnull,default:true"`
	Priority        int        `bun:"priority,notnull,default:100"`
	LastValidatedAt *time.Time `bun:"last_validated_at"`
	CreatedAt       time.Time  `bun:"created_at,default:current_timestamp"`
	UpdatedAt       time.Time  `bun:"updated_at,default:current_timestamp"`
}

// Implement Entity interface
func (m MarketDataCredential) GetID() string             { return m.ID }
func (m *MarketDataCredential) SetID(id string)          { m.ID = id }
func (m MarketDataCredential) GetCreatedAt() time.Time   { return m.CreatedAt }
func (m *MarketDataCredential) SetCreatedAt(t time.Time) { m.CreatedAt = t }
func (m MarketDataCredential) GetUpdatedAt() time.Time   { return m.UpdatedAt }
func (m *MarketDataCredential) SetUpdatedAt(t time.Time) { m.UpdatedAt = t }

// Encrypt encrypts the APIKey before saving to the database using AES-256-GCM
func (m *MarketDataCredential) Encrypt() error {
	if m.APIKey == "" {
		return nil
	}

	key, err := getEncryptionKey()
	if err != nil {
		return err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return err
	}

	encrypted := gcm.Seal(nonce, nonce, []byte(m.APIKey), nil)
	m.APIKey = base64.StdEncoding.EncodeToString(encrypted)
	return nil
}

// Decrypt decrypts the APIKey after loading from the database
func (m *MarketDataCredential) Decrypt() error {
	if m.APIKey == "" {
		return nil
	}

	key, err := getEncryptionKey()
	if err != nil {
		return err
	}

	data, err := base64.StdEncoding.DecodeString(m.APIKey)
	if err != nil {
		// Might not be encrypted yet (legacy data), return as is
		return nil
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		// Not properly encrypted
		return nil
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return err
	}

	m.APIKey = string(plaintext)
	return nil
}
