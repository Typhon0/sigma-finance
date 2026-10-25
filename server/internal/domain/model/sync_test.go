package model_test

import (
	"testing"

	"sigma_finance/internal/domain/model"
)

func TestSyncCredential_ValidationAndEncryption(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	cred := &model.SyncCredential{
		UserID:   "user-123",
		Provider: "KRAKEN",
		RawData:  `{"apiKey":"test-key","apiSecret":"test-secret"}`,
	}
	if err := cred.Validate(); err != nil {
		t.Fatalf("validation failed: %v", err)
	}
	if err := cred.Encrypt(); err != nil {
		t.Fatalf("encryption failed: %v", err)
	}
	if cred.EncryptedData == "" || cred.EncryptedData == cred.RawData {
		t.Fatalf("expected EncryptedData to be encrypted cipher text")
	}
	decrypted, err := cred.Decrypt()
	if err != nil {
		t.Fatalf("decryption failed: %v", err)
	}
	if decrypted != cred.RawData {
		t.Fatalf("expected decrypted %s, got %s", cred.RawData, decrypted)
	}
}

func TestSyncCredential_ValidationErrors(t *testing.T) {
	// Missing provider
	c1 := &model.SyncCredential{
		UserID:  "user-123",
		RawData: `{"apiKey":"key"}`,
	}
	if err := c1.Validate(); err == nil {
		t.Fatalf("expected error for missing provider, got nil")
	}

	// Missing UserID when not system
	c2 := &model.SyncCredential{
		Provider: "KRAKEN",
		RawData:  `{"apiKey":"key"}`,
		IsSystem: false,
	}
	if err := c2.Validate(); err == nil {
		t.Fatalf("expected error for missing user ID on non-system credential, got nil")
	}

	// Missing data (both RawData and EncryptedData empty)
	c3 := &model.SyncCredential{
		UserID:   "user-123",
		Provider: "KRAKEN",
	}
	if err := c3.Validate(); err == nil {
		t.Fatalf("expected error for empty credential data, got nil")
	}

	// System credential with empty UserID is valid
	c4 := &model.SyncCredential{
		IsSystem: true,
		Provider: "SNAPTRADE",
		RawData:  `{"clientId":"id","consumerKey":"key"}`,
	}
	if err := c4.Validate(); err != nil {
		t.Fatalf("expected system credential to be valid, got: %v", err)
	}
	if c4.Status != model.SyncCredentialStatusActive {
		t.Fatalf("expected default status ACTIVE, got %s", c4.Status)
	}
}

func TestSyncCredential_EncryptionErrors(t *testing.T) {
	model.SetEncryptionKey("invalid-short-key")
	cred := &model.SyncCredential{
		UserID:   "user-123",
		Provider: "KRAKEN",
		RawData:  `{"apiKey":"key"}`,
	}
	if err := cred.Encrypt(); err == nil {
		t.Fatalf("expected encryption error with invalid key, got nil")
	}

	// Reset valid key
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	if err := cred.Encrypt(); err != nil {
		t.Fatalf("unexpected encryption error: %v", err)
	}

	// Corrupt encrypted data and attempt decryption
	cred.EncryptedData = "not-valid-base64-!@#$"
	if _, err := cred.Decrypt(); err == nil {
		t.Fatalf("expected decryption error with corrupt base64, got nil")
	}

	cred.EncryptedData = "YQ==" // "a", too short for nonce
	if _, err := cred.Decrypt(); err == nil {
		t.Fatalf("expected decryption error with truncated ciphertext, got nil")
	}
}

func TestSyncConnection_Validation(t *testing.T) {
	conn := &model.SyncConnection{
		UserID:                "user-123",
		PortfolioID:           "port-456",
		CredentialID:          "cred-789",
		Provider:              "KRAKEN",
		ExternalInstitutionID: "kraken",
		ExternalAccountID:     "acc-external-1",
		InstitutionName:       "Kraken Spot",
	}
	if err := conn.Validate(); err != nil {
		t.Fatalf("expected valid connection, got: %v", err)
	}
	if conn.SyncStatus != model.SyncConnectionStatusIdle {
		t.Fatalf("expected default sync status IDLE, got %s", conn.SyncStatus)
	}

	// Missing external account ID
	connInvalid := &model.SyncConnection{
		UserID:       "user-123",
		PortfolioID:  "port-456",
		CredentialID: "cred-789",
		Provider:     "KRAKEN",
	}
	if err := connInvalid.Validate(); err == nil {
		t.Fatalf("expected error for missing external account ID, got nil")
	}
}

func TestSyncRun_Validation(t *testing.T) {
	run := &model.SyncRun{
		ConnectionID: "conn-123",
	}
	if err := run.Validate(); err != nil {
		t.Fatalf("expected valid sync run, got: %v", err)
	}
	if run.Status != model.SyncRunStatusInProgress {
		t.Fatalf("expected default status IN_PROGRESS, got %s", run.Status)
	}

	runInvalid := &model.SyncRun{}
	if err := runInvalid.Validate(); err == nil {
		t.Fatalf("expected error for missing connection ID, got nil")
	}
}
