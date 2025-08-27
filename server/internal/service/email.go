package service

import (
	"context"
)

// EmailService provides email functionality for authentication workflows
type EmailService interface {
	// SendVerificationEmail sends an email verification email
	SendVerificationEmail(ctx context.Context, email, name, token string) error

	// SendPasswordResetEmail sends a password reset email
	SendPasswordResetEmail(ctx context.Context, email, name, token string) error

	// SendWelcomeEmail sends a welcome email after successful registration
	SendWelcomeEmail(ctx context.Context, email, name string) error
}

// MockEmailService is a mock implementation for testing
type MockEmailService struct {
	SentEmails []EmailRecord
}

// EmailRecord represents a sent email for testing purposes
type EmailRecord struct {
	Type      string `json:"type"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	Token     string `json:"token,omitempty"`
	Timestamp string `json:"timestamp"`
}

// NewMockEmailService creates a new mock email service
func NewMockEmailService() *MockEmailService {
	return &MockEmailService{
		SentEmails: make([]EmailRecord, 0),
	}
}

// SendVerificationEmail records a verification email send
func (m *MockEmailService) SendVerificationEmail(ctx context.Context, email, name, token string) error {
	m.SentEmails = append(m.SentEmails, EmailRecord{
		Type:  "verification",
		Email: email,
		Name:  name,
		Token: token,
	})
	return nil
}

// SendPasswordResetEmail records a password reset email send
func (m *MockEmailService) SendPasswordResetEmail(ctx context.Context, email, name, token string) error {
	m.SentEmails = append(m.SentEmails, EmailRecord{
		Type:  "password_reset",
		Email: email,
		Name:  name,
		Token: token,
	})
	return nil
}

// SendWelcomeEmail records a welcome email send
func (m *MockEmailService) SendWelcomeEmail(ctx context.Context, email, name string) error {
	m.SentEmails = append(m.SentEmails, EmailRecord{
		Type:  "welcome",
		Email: email,
		Name:  name,
	})
	return nil
}

// GetSentEmails returns all sent emails (for testing)
func (m *MockEmailService) GetSentEmails() []EmailRecord {
	return m.SentEmails
}

// ClearSentEmails clears the sent emails list (for testing)
func (m *MockEmailService) ClearSentEmails() {
	m.SentEmails = make([]EmailRecord, 0)
}
