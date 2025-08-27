package service

import (
	"context"
	"sigma_finance/internal/config"
	"testing"
)

// TestEmailServiceIntegration tests that the email service can be created and used
func TestEmailServiceIntegration(t *testing.T) {
	// Test mock email service
	mockService := NewMockEmailService()
	ctx := context.Background()

	err := mockService.SendVerificationEmail(ctx, "test@example.com", "Test User", "token123")
	if err != nil {
		t.Fatalf("Mock email service failed: %v", err)
	}

	sentEmails := mockService.GetSentEmails()
	if len(sentEmails) != 1 {
		t.Fatalf("Expected 1 sent email, got %d", len(sentEmails))
	}

	// Test SMTP email service creation
	cfg := &config.EmailConfig{
		SMTPHost:     "localhost",
		SMTPPort:     587,
		SMTPUsername: "test@example.com",
		SMTPPassword: "password",
		FromEmail:    "noreply@example.com",
		FromName:     "Test Service",
		BaseURL:      "https://example.com",
	}

	smtpService := NewSMTPEmailService(cfg)
	if smtpService == nil {
		t.Fatal("Failed to create SMTP email service")
	}

	t.Log("Email service integration test passed")
}
