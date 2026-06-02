package service

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"html/template"
	"log"
	"net/smtp"
	"sigma_finance/internal/config"
	"time"
)

// EmailService provides email functionality for authentication workflows
type EmailService interface {
	// SendVerificationEmail sends an email verification email
	SendVerificationEmail(ctx context.Context, email, name, token string) error

	// SendPasswordResetEmail sends a password reset email
	SendPasswordResetEmail(ctx context.Context, email, name, token string) error

	// SendWelcomeEmail sends a welcome email after successful registration
	SendWelcomeEmail(ctx context.Context, email, name string) error

	// SendAlertEmail sends an alert notification email
	SendAlertEmail(ctx context.Context, to, subject, textBody, htmlBody string) error
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

// SendAlertEmail records an alert email send
func (m *MockEmailService) SendAlertEmail(ctx context.Context, to, subject, textBody, htmlBody string) error {
	m.SentEmails = append(m.SentEmails, EmailRecord{
		Type:  "alert",
		Email: to,
		Name:  "",
		Token: subject,
	})
	return nil
}

// SMTPEmailService implements EmailService using SMTP
type SMTPEmailService struct {
	config *config.EmailConfig
}

// NewSMTPEmailService creates a new SMTP email service
func NewSMTPEmailService(cfg *config.EmailConfig) *SMTPEmailService {
	return &SMTPEmailService{
		config: cfg,
	}
}

// SendVerificationEmail sends an email verification email
func (s *SMTPEmailService) SendVerificationEmail(ctx context.Context, email, name, token string) error {
	log.Printf("[EmailService] SendVerificationEmail: started email=%s", email)
	subject := "Verify Your Email Address"
	verificationURL := fmt.Sprintf("%s/verify-email?token=%s", s.config.BaseURL, token)

	htmlBody, err := s.renderVerificationEmailTemplate(name, verificationURL)
	if err != nil {
		return fmt.Errorf("failed to render verification email template: %w", err)
	}

	textBody := s.renderVerificationEmailText(name, verificationURL)

	return s.sendEmail(email, subject, textBody, htmlBody)
}

// SendPasswordResetEmail sends a password reset email
func (s *SMTPEmailService) SendPasswordResetEmail(ctx context.Context, email, name, token string) error {
	log.Printf("[EmailService] SendPasswordResetEmail: started email=%s", email)
	subject := "Reset Your Password"
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", s.config.BaseURL, token)

	htmlBody, err := s.renderPasswordResetEmailTemplate(name, resetURL)
	if err != nil {
		return fmt.Errorf("failed to render password reset email template: %w", err)
	}

	textBody := s.renderPasswordResetEmailText(name, resetURL)

	return s.sendEmail(email, subject, textBody, htmlBody)
}

// SendWelcomeEmail sends a welcome email after successful registration
func (s *SMTPEmailService) SendWelcomeEmail(ctx context.Context, email, name string) error {
	log.Printf("[EmailService] SendWelcomeEmail: started email=%s", email)
	subject := "Welcome to Sigma Finance!"

	htmlBody, err := s.renderWelcomeEmailTemplate(name)
	if err != nil {
		return fmt.Errorf("failed to render welcome email template: %w", err)
	}

	textBody := s.renderWelcomeEmailText(name)

	return s.sendEmail(email, subject, textBody, htmlBody)
}

// SendAlertEmail sends an alert notification email
func (s *SMTPEmailService) SendAlertEmail(ctx context.Context, to, subject, textBody, htmlBody string) error {
	return s.sendEmail(to, subject, textBody, htmlBody)
}

// sendEmail sends an email using SMTP
func (s *SMTPEmailService) sendEmail(to, subject, textBody, htmlBody string) error {
	from := s.config.FromEmail

	// Create message
	message := s.createMIMEMessage(from, to, subject, textBody, htmlBody)

	// Setup authentication
	auth := smtp.PlainAuth("", s.config.SMTPUsername, s.config.SMTPPassword, s.config.SMTPHost)

	// Setup TLS config
	tlsConfig := &tls.Config{
		InsecureSkipVerify: false,
		ServerName:         s.config.SMTPHost,
	}

	// Connect to server
	conn, err := tls.Dial("tcp", fmt.Sprintf("%s:%d", s.config.SMTPHost, s.config.SMTPPort), tlsConfig)
	if err != nil {
		log.Printf("[EmailService] sendEmail: ERROR SMTP connection failed to=%s: %v", to, err)
		return fmt.Errorf("failed to connect to SMTP server: %w", err)
	}
	defer conn.Close()

	// Create SMTP client
	client, err := smtp.NewClient(conn, s.config.SMTPHost)
	if err != nil {
		log.Printf("[EmailService] sendEmail: ERROR SMTP client creation failed to=%s: %v", to, err)
		return fmt.Errorf("failed to create SMTP client: %w", err)
	}
	defer client.Quit()

	// Authenticate
	if err := client.Auth(auth); err != nil {
		log.Printf("[EmailService] sendEmail: ERROR SMTP auth failed to=%s: %v", to, err)
		return fmt.Errorf("failed to authenticate with SMTP server: %w", err)
	}

	// Set sender
	if err := client.Mail(from); err != nil {
		return fmt.Errorf("failed to set sender: %w", err)
	}

	// Set recipient
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("failed to set recipient: %w", err)
	}

	// Send message
	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("failed to get data writer: %w", err)
	}

	_, err = writer.Write([]byte(message))
	if err != nil {
		log.Printf("[EmailService] sendEmail: ERROR write failed to=%s: %v", to, err)
		return fmt.Errorf("failed to write message: %w", err)
	}

	if err := writer.Close(); err != nil {
		log.Printf("[EmailService] sendEmail: ERROR close failed to=%s: %v", to, err)
		return err
	}
	log.Printf("[EmailService] sendEmail: SUCCESS to=%s subject=%s", to, subject)
	return nil
}

// createMIMEMessage creates a MIME message with both text and HTML parts
func (s *SMTPEmailService) createMIMEMessage(from, to, subject, textBody, htmlBody string) string {
	boundary := "boundary-" + fmt.Sprintf("%d", time.Now().Unix())

	message := fmt.Sprintf(`From: %s <%s>
To: %s
Subject: %s
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="%s"

--%s
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 7bit

%s

--%s
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: 7bit

%s

--%s--
`, s.config.FromName, from, to, subject, boundary, boundary, textBody, boundary, htmlBody, boundary)

	return message
}

// Email template rendering methods

// renderVerificationEmailTemplate renders the HTML template for email verification
func (s *SMTPEmailService) renderVerificationEmailTemplate(name, verificationURL string) (string, error) {
	tmpl := `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Sigma Finance</h1>
    </div>
    <div class="content">
        <h2>Verify Your Email Address</h2>
        <p>Hello {{.Name}},</p>
        <p>Thank you for registering with Sigma Finance! To complete your registration and start tracking your portfolio, please verify your email address by clicking the button below:</p>
        <p style="text-align: center;">
            <a href="{{.VerificationURL}}" class="button">Verify Email Address</a>
        </p>
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background-color: #f1f5f9; padding: 10px; border-radius: 4px;">{{.VerificationURL}}</p>
        <p><strong>This verification link will expire in 24 hours.</strong></p>
        <p>If you didn't create an account with Sigma Finance, you can safely ignore this email.</p>
    </div>
    <div class="footer">
        <p>Best regards,<br>The Sigma Finance Team</p>
        <p>This is an automated message, please do not reply to this email.</p>
    </div>
</body>
</html>`

	t, err := template.New("verification").Parse(tmpl)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	err = t.Execute(&buf, map[string]string{
		"Name":            name,
		"VerificationURL": verificationURL,
	})
	if err != nil {
		return "", err
	}

	return buf.String(), nil
}

// renderVerificationEmailText renders the text version for email verification
func (s *SMTPEmailService) renderVerificationEmailText(name, verificationURL string) string {
	return fmt.Sprintf(`Sigma Finance - Verify Your Email Address

Hello %s,

Thank you for registering with Sigma Finance! To complete your registration and start tracking your portfolio, please verify your email address by visiting the following link:

%s

This verification link will expire in 24 hours.

If you didn't create an account with Sigma Finance, you can safely ignore this email.

Best regards,
The Sigma Finance Team

This is an automated message, please do not reply to this email.`, name, verificationURL)
}

// renderPasswordResetEmailTemplate renders the HTML template for password reset
func (s *SMTPEmailService) renderPasswordResetEmailTemplate(name, resetURL string) (string, error) {
	tmpl := `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b; }
        .warning { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Sigma Finance</h1>
    </div>
    <div class="content">
        <h2>Reset Your Password</h2>
        <p>Hello {{.Name}},</p>
        <p>We received a request to reset your password for your Sigma Finance account. If you made this request, click the button below to reset your password:</p>
        <p style="text-align: center;">
            <a href="{{.ResetURL}}" class="button">Reset Password</a>
        </p>
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background-color: #f1f5f9; padding: 10px; border-radius: 4px;">{{.ResetURL}}</p>
        <div class="warning">
            <p><strong>Important Security Information:</strong></p>
            <ul>
                <li>This password reset link will expire in 1 hour</li>
                <li>The link can only be used once</li>
                <li>If you didn't request this password reset, please ignore this email</li>
                <li>Your password will remain unchanged until you use this link</li>
            </ul>
        </div>
        <p>If you continue to have problems, please contact our support team.</p>
    </div>
    <div class="footer">
        <p>Best regards,<br>The Sigma Finance Team</p>
        <p>This is an automated message, please do not reply to this email.</p>
    </div>
</body>
</html>`

	t, err := template.New("passwordReset").Parse(tmpl)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	err = t.Execute(&buf, map[string]string{
		"Name":     name,
		"ResetURL": resetURL,
	})
	if err != nil {
		return "", err
	}

	return buf.String(), nil
}

// renderPasswordResetEmailText renders the text version for password reset
func (s *SMTPEmailService) renderPasswordResetEmailText(name, resetURL string) string {
	return fmt.Sprintf(`Sigma Finance - Reset Your Password

Hello %s,

We received a request to reset your password for your Sigma Finance account. If you made this request, visit the following link to reset your password:

%s

IMPORTANT SECURITY INFORMATION:
- This password reset link will expire in 1 hour
- The link can only be used once
- If you didn't request this password reset, please ignore this email
- Your password will remain unchanged until you use this link

If you continue to have problems, please contact our support team.

Best regards,
The Sigma Finance Team

This is an automated message, please do not reply to this email.`, name, resetURL)
}

// renderWelcomeEmailTemplate renders the HTML template for welcome email
func (s *SMTPEmailService) renderWelcomeEmailTemplate(name string) (string, error) {
	tmpl := `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Sigma Finance</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .feature { background-color: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #059669; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to Sigma Finance!</h1>
    </div>
    <div class="content">
        <h2>Your Portfolio Tracking Journey Begins</h2>
        <p>Hello {{.Name}},</p>
        <p>Welcome to Sigma Finance! We're excited to help you take control of your financial portfolio and make informed investment decisions.</p>
        
        <h3>What you can do with Sigma Finance:</h3>
        <div class="feature">
            <strong>📊 Track Multiple Asset Types</strong><br>
            Monitor stocks, cryptocurrencies, real estate, bank accounts, and more in one place.
        </div>
        <div class="feature">
            <strong>📈 Portfolio Analytics</strong><br>
            Get insights into your portfolio performance with detailed reports and visualizations.
        </div>
        <div class="feature">
            <strong>🔔 Smart Alerts</strong><br>
            Set up notifications for price changes and portfolio milestones.
        </div>
        <div class="feature">
            <strong>📱 Multi-Device Access</strong><br>
            Access your portfolio from anywhere with our responsive web application.
        </div>
        
        <p>Ready to get started? Log in to your account and begin building your first portfolio!</p>
        <p>If you have any questions or need assistance, don't hesitate to reach out to our support team.</p>
    </div>
    <div class="footer">
        <p>Happy investing!<br>The Sigma Finance Team</p>
        <p>This is an automated message, please do not reply to this email.</p>
    </div>
</body>
</html>`

	t, err := template.New("welcome").Parse(tmpl)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	err = t.Execute(&buf, map[string]string{
		"Name": name,
	})
	if err != nil {
		return "", err
	}

	return buf.String(), nil
}

// renderWelcomeEmailText renders the text version for welcome email
func (s *SMTPEmailService) renderWelcomeEmailText(name string) string {
	return fmt.Sprintf(`Sigma Finance - Welcome!

Hello %s,

Welcome to Sigma Finance! We're excited to help you take control of your financial portfolio and make informed investment decisions.

What you can do with Sigma Finance:

📊 Track Multiple Asset Types
Monitor stocks, cryptocurrencies, real estate, bank accounts, and more in one place.

📈 Portfolio Analytics
Get insights into your portfolio performance with detailed reports and visualizations.

🔔 Smart Alerts
Set up notifications for price changes and portfolio milestones.

📱 Multi-Device Access
Access your portfolio from anywhere with our responsive web application.

Ready to get started? Log in to your account and begin building your first portfolio!

If you have any questions or need assistance, don't hesitate to reach out to our support team.

Happy investing!
The Sigma Finance Team

This is an automated message, please do not reply to this email.`, name)
}
