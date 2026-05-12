package model

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"time"

	"github.com/uptrace/bun"
)

func getEncryptionKey() string {
	key := os.Getenv("ENCRYPTION_KEY")
	if key == "" {
		key = "0123456789abcdef0123456789abcdef"
	}
	return key
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

	key := getEncryptionKey()

	if len(key) != 32 {
		return errors.New("encryption key must be exactly 32 bytes for AES-256")
	}

	block, err := aes.NewCipher([]byte(key))
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

	key := getEncryptionKey()

	if len(key) != 32 {
		return errors.New("encryption key must be exactly 32 bytes for AES-256")
	}

	data, err := base64.StdEncoding.DecodeString(m.APIKey)
	if err != nil {
		// Might not be encrypted yet (legacy data), return as is
		return nil
	}

	block, err := aes.NewCipher([]byte(key))
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
