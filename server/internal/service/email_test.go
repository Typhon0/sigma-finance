package service

import (
	"context"
	"sigma_finance/internal/config"
	"strings"
	"testing"
)

func TestMockEmailService_SendVerificationEmail(t *testing.T) {
	mockService := NewMockEmailService()
	ctx := context.Background()

	email := "test@example.com"
	name := "Test User"
	token := "verification-token-123"

	err := mockService.SendVerificationEmail(ctx, email, name, token)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	sentEmails := mockService.GetSentEmails()
	if len(sentEmails) != 1 {
		t.Fatalf("Expected 1 sent email, got %d", len(sentEmails))
	}

	sentEmail := sentEmails[0]
	if sentEmail.Type != "verification" {
		t.Errorf("Expected type 'verification', got '%s'", sentEmail.Type)
	}
	if sentEmail.Email != email {
		t.Errorf("Expected email '%s', got '%s'", email, sentEmail.Email)
	}
	if sentEmail.Name != name {
		t.Errorf("Expected name '%s', got '%s'", name, sentEmail.Name)
	}
	if sentEmail.Token != token {
		t.Errorf("Expected token '%s', got '%s'", token, sentEmail.Token)
	}
}

func TestMockEmailService_SendPasswordResetEmail(t *testing.T) {
	mockService := NewMockEmailService()
	ctx := context.Background()

	email := "test@example.com"
	name := "Test User"
	token := "reset-token-456"

	err := mockService.SendPasswordResetEmail(ctx, email, name, token)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	sentEmails := mockService.GetSentEmails()
	if len(sentEmails) != 1 {
		t.Fatalf("Expected 1 sent email, got %d", len(sentEmails))
	}

	sentEmail := sentEmails[0]
	if sentEmail.Type != "password_reset" {
		t.Errorf("Expected type 'password_reset', got '%s'", sentEmail.Type)
	}
	if sentEmail.Email != email {
		t.Errorf("Expected email '%s', got '%s'", email, sentEmail.Email)
	}
	if sentEmail.Name != name {
		t.Errorf("Expected name '%s', got '%s'", name, sentEmail.Name)
	}
	if sentEmail.Token != token {
		t.Errorf("Expected token '%s', got '%s'", token, sentEmail.Token)
	}
}

func TestMockEmailService_SendWelcomeEmail(t *testing.T) {
	mockService := NewMockEmailService()
	ctx := context.Background()

	email := "test@example.com"
	name := "Test User"

	err := mockService.SendWelcomeEmail(ctx, email, name)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	sentEmails := mockService.GetSentEmails()
	if len(sentEmails) != 1 {
		t.Fatalf("Expected 1 sent email, got %d", len(sentEmails))
	}

	sentEmail := sentEmails[0]
	if sentEmail.Type != "welcome" {
		t.Errorf("Expected type 'welcome', got '%s'", sentEmail.Type)
	}
	if sentEmail.Email != email {
		t.Errorf("Expected email '%s', got '%s'", email, sentEmail.Email)
	}
	if sentEmail.Name != name {
		t.Errorf("Expected name '%s', got '%s'", name, sentEmail.Name)
	}
	if sentEmail.Token != "" {
		t.Errorf("Expected empty token, got '%s'", sentEmail.Token)
	}
}

func TestMockEmailService_ClearSentEmails(t *testing.T) {
	mockService := NewMockEmailService()
	ctx := context.Background()

	// Send some emails
	mockService.SendVerificationEmail(ctx, "test1@example.com", "User 1", "token1")
	mockService.SendPasswordResetEmail(ctx, "test2@example.com", "User 2", "token2")

	sentEmails := mockService.GetSentEmails()
	if len(sentEmails) != 2 {
		t.Fatalf("Expected 2 sent emails, got %d", len(sentEmails))
	}

	// Clear emails
	mockService.ClearSentEmails()

	sentEmails = mockService.GetSentEmails()
	if len(sentEmails) != 0 {
		t.Fatalf("Expected 0 sent emails after clearing, got %d", len(sentEmails))
	}
}

func TestSMTPEmailService_TemplateRendering(t *testing.T) {
	cfg := &config.EmailConfig{
		SMTPHost:     "smtp.example.com",
		SMTPPort:     587,
		SMTPUsername: "test@example.com",
		SMTPPassword: "password",
		FromEmail:    "noreply@example.com",
		FromName:     "Test Service",
		BaseURL:      "https://example.com",
	}

	service := NewSMTPEmailService(cfg)

	t.Run("VerificationEmailTemplate", func(t *testing.T) {
		name := "John Doe"
		verificationURL := "https://example.com/verify?token=abc123"

		htmlBody, err := service.renderVerificationEmailTemplate(name, verificationURL)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}

		if !strings.Contains(htmlBody, name) {
			t.Errorf("Expected HTML body to contain name '%s'", name)
		}
		if !strings.Contains(htmlBody, verificationURL) {
			t.Errorf("Expected HTML body to contain verification URL '%s'", verificationURL)
		}
		if !strings.Contains(htmlBody, "Verify Your Email Address") {
			t.Errorf("Expected HTML body to contain verification title")
		}

		textBody := service.renderVerificationEmailText(name, verificationURL)
		if !strings.Contains(textBody, name) {
			t.Errorf("Expected text body to contain name '%s'", name)
		}
		if !strings.Contains(textBody, verificationURL) {
			t.Errorf("Expected text body to contain verification URL '%s'", verificationURL)
		}
	})

	t.Run("PasswordResetEmailTemplate", func(t *testing.T) {
		name := "Jane Smith"
		resetURL := "https://example.com/reset?token=def456"

		htmlBody, err := service.renderPasswordResetEmailTemplate(name, resetURL)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}

		if !strings.Contains(htmlBody, name) {
			t.Errorf("Expected HTML body to contain name '%s'", name)
		}
		if !strings.Contains(htmlBody, resetURL) {
			t.Errorf("Expected HTML body to contain reset URL '%s'", resetURL)
		}
		if !strings.Contains(htmlBody, "Reset Your Password") {
			t.Errorf("Expected HTML body to contain reset title")
		}

		textBody := service.renderPasswordResetEmailText(name, resetURL)
		if !strings.Contains(textBody, name) {
			t.Errorf("Expected text body to contain name '%s'", name)
		}
		if !strings.Contains(textBody, resetURL) {
			t.Errorf("Expected text body to contain reset URL '%s'", resetURL)
		}
	})

	t.Run("WelcomeEmailTemplate", func(t *testing.T) {
		name := "Bob Johnson"

		htmlBody, err := service.renderWelcomeEmailTemplate(name)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}

		if !strings.Contains(htmlBody, name) {
			t.Errorf("Expected HTML body to contain name '%s'", name)
		}
		if !strings.Contains(htmlBody, "Welcome to Sigma Finance") {
			t.Errorf("Expected HTML body to contain welcome title")
		}

		textBody := service.renderWelcomeEmailText(name)
		if !strings.Contains(textBody, name) {
			t.Errorf("Expected text body to contain name '%s'", name)
		}
		if !strings.Contains(textBody, "Welcome to Sigma Finance") {
			t.Errorf("Expected text body to contain welcome title")
		}
	})
}

func TestSMTPEmailService_CreateMIMEMessage(t *testing.T) {
	cfg := &config.EmailConfig{
		FromEmail: "noreply@example.com",
		FromName:  "Test Service",
	}

	service := NewSMTPEmailService(cfg)

	from := "noreply@example.com"
	to := "test@example.com"
	subject := "Test Subject"
	textBody := "This is the text body"
	htmlBody := "<html><body>This is the HTML body</body></html>"

	message := service.createMIMEMessage(from, to, subject, textBody, htmlBody)

	// Check that the message contains required headers
	if !strings.Contains(message, "From: Test Service <noreply@example.com>") {
		t.Errorf("Expected message to contain proper From header")
	}
	if !strings.Contains(message, "To: test@example.com") {
		t.Errorf("Expected message to contain proper To header")
	}
	if !strings.Contains(message, "Subject: Test Subject") {
		t.Errorf("Expected message to contain proper Subject header")
	}
	if !strings.Contains(message, "MIME-Version: 1.0") {
		t.Errorf("Expected message to contain MIME version")
	}
	if !strings.Contains(message, "Content-Type: multipart/alternative") {
		t.Errorf("Expected message to contain multipart content type")
	}

	// Check that both text and HTML bodies are included
	if !strings.Contains(message, textBody) {
		t.Errorf("Expected message to contain text body")
	}
	if !strings.Contains(message, htmlBody) {
		t.Errorf("Expected message to contain HTML body")
	}

	// Check content type headers for each part
	if !strings.Contains(message, "Content-Type: text/plain; charset=UTF-8") {
		t.Errorf("Expected message to contain text/plain content type")
	}
	if !strings.Contains(message, "Content-Type: text/html; charset=UTF-8") {
		t.Errorf("Expected message to contain text/html content type")
	}
}

// Integration test for SMTP service (requires mock SMTP server or real SMTP config)
func TestSMTPEmailService_Integration(t *testing.T) {
	// Skip this test in normal runs - only run when SMTP_TEST_ENABLED is set
	if testing.Short() {
		t.Skip("Skipping SMTP integration test in short mode")
	}

	cfg := &config.EmailConfig{
		SMTPHost:     "localhost",
		SMTPPort:     1025, // MailHog default port
		SMTPUsername: "",
		SMTPPassword: "",
		FromEmail:    "test@example.com",
		FromName:     "Test Service",
		BaseURL:      "https://example.com",
	}

	service := NewSMTPEmailService(cfg)

	// This test would require a running SMTP server (like MailHog) for integration testing
	// For now, we'll just test that the service can be created without error
	if service == nil {
		t.Errorf("Expected SMTP service to be created successfully")
	}

	// In a real integration test, you would:
	// 1. Start a test SMTP server (like MailHog)
	// 2. Send actual emails
	// 3. Verify the emails were received by the test server
	// 4. Check email content and formatting

	t.Log("SMTP service created successfully - integration test would require running SMTP server")
}

func TestEmailService_Interface(t *testing.T) {
	// Test that both implementations satisfy the EmailService interface
	var _ EmailService = &MockEmailService{}
	var _ EmailService = &SMTPEmailService{}
}
