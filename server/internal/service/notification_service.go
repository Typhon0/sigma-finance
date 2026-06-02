package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sigma_finance/internal/config"
	"sigma_finance/internal/repository"
	"time"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/google/uuid"
)

// NotificationService handles alert notifications through various channels
type NotificationService struct {
	uow          repository.IUnitOfWork
	emailService EmailService
	httpClient   *http.Client
	vapidKey     string
}

// NewNotificationService creates a new notification service
func NewNotificationService(uow repository.IUnitOfWork, emailService EmailService, cfg *config.Config) *NotificationService {
	return &NotificationService{
		uow:          uow,
		emailService: emailService,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		vapidKey: cfg.Email.VAPIDPrivateKey,
	}
}

// PushSubscription represents a user's web push subscription
type PushSubscription struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Endpoint  string    `json:"endpoint"`
	P256dh    string    `json:"p256dh"`
	Auth      string    `json:"auth"`
	CreatedAt time.Time `json:"created_at"`
}

// INotificationService defines the interface for notification operations
type INotificationService interface {
	// Send alert notifications
	SendAlertNotification(ctx context.Context, event repository.AlertTriggerEvent, methods []AlertNotificationMethod) error
	SendEmailAlertNotification(ctx context.Context, event repository.AlertTriggerEvent, userEmail, userName string) error
	SendInAppNotification(ctx context.Context, event repository.AlertTriggerEvent) error
	SendPushNotification(ctx context.Context, event repository.AlertTriggerEvent) error
	SendWebhookNotification(ctx context.Context, event repository.AlertTriggerEvent, webhookURL string) error

	// Notification preferences
	GetUserNotificationPreferences(ctx context.Context, userID string) (*NotificationPreferences, error)
	UpdateUserNotificationPreferences(ctx context.Context, userID string, prefs NotificationPreferences) error

	// Notification history
	LogNotification(ctx context.Context, notification NotificationLog) error
	GetNotificationHistory(ctx context.Context, userID string, filter NotificationHistoryFilter) ([]*NotificationLog, error)
}

// NotificationPreferences represents user notification preferences
type NotificationPreferences struct {
	UserID               string                                             `json:"user_id"`
	EmailEnabled         bool                                               `json:"email_enabled"`
	PushEnabled          bool                                               `json:"push_enabled"`
	InAppEnabled         bool                                               `json:"in_app_enabled"`
	WebhookEnabled       bool                                               `json:"webhook_enabled"`
	WebhookURL           string                                             `json:"webhook_url,omitempty"`
	QuietHoursEnabled    bool                                               `json:"quiet_hours_enabled"`
	QuietHoursStart      string                                             `json:"quiet_hours_start,omitempty"` // Format: "22:00"
	QuietHoursEnd        string                                             `json:"quiet_hours_end,omitempty"`   // Format: "08:00"
	AlertTypePreferences map[repository.AlertType][]AlertNotificationMethod `json:"alert_type_preferences"`
}

// NotificationLog represents a sent notification record
type NotificationLog struct {
	ID           string                  `json:"id"`
	UserID       string                  `json:"user_id"`
	AlertID      string                  `json:"alert_id"`
	Method       AlertNotificationMethod `json:"method"`
	Status       NotificationStatus      `json:"status"`
	Message      string                  `json:"message"`
	ErrorMessage string                  `json:"error_message,omitempty"`
	SentAt       time.Time               `json:"sent_at"`
	DeliveredAt  *time.Time              `json:"delivered_at,omitempty"`
}

// NotificationStatus represents the status of a notification
type NotificationStatus string

const (
	NotificationStatusPending   NotificationStatus = "PENDING"
	NotificationStatusSent      NotificationStatus = "SENT"
	NotificationStatusDelivered NotificationStatus = "DELIVERED"
	NotificationStatusFailed    NotificationStatus = "FAILED"
)

// NotificationHistoryFilter defines filter criteria for notification history
type NotificationHistoryFilter struct {
	AlertID    *string                  `json:"alert_id,omitempty"`
	Method     *AlertNotificationMethod `json:"method,omitempty"`
	Status     *NotificationStatus      `json:"status,omitempty"`
	SentAfter  *time.Time               `json:"sent_after,omitempty"`
	SentBefore *time.Time               `json:"sent_before,omitempty"`
	Limit      *int                     `json:"limit,omitempty"`
	Offset     *int                     `json:"offset,omitempty"`
}

// SendAlertNotification sends notifications through specified methods
func (s *NotificationService) SendAlertNotification(ctx context.Context, event repository.AlertTriggerEvent, methods []AlertNotificationMethod) error {
	log.Printf("[NotificationService] SendAlertNotification: started user=%s alert=%s type=%s", event.UserID, event.AlertID, event.AlertType)
	// Get user notification preferences
	prefs, err := s.GetUserNotificationPreferences(ctx, event.UserID)
	if err != nil {
		// If preferences not found, use default methods
		prefs = &NotificationPreferences{
			UserID:       event.UserID,
			EmailEnabled: true,
			InAppEnabled: true,
		}
	}

	// Check quiet hours
	if s.isQuietHours(prefs) {
		log.Printf("[NotificationService] SendAlertNotification: SKIPPED quiet hours active user=%s", event.UserID)
		return nil
	}

	// Send notifications through each requested method
	for _, method := range methods {
		if s.isMethodEnabled(prefs, method) {
			switch method {
			case NotificationMethodEmail:
				if err := s.sendEmailNotification(ctx, event); err != nil {
					s.logNotificationError(ctx, event, method, err)
				}
			case NotificationMethodInApp:
				if err := s.SendInAppNotification(ctx, event); err != nil {
					s.logNotificationError(ctx, event, method, err)
				}
			case NotificationMethodPush:
				if err := s.SendPushNotification(ctx, event); err != nil {
					s.logNotificationError(ctx, event, method, err)
				}
			case NotificationMethodWebhook:
				if prefs.WebhookURL != "" {
					if err := s.SendWebhookNotification(ctx, event, prefs.WebhookURL); err != nil {
						s.logNotificationError(ctx, event, method, err)
					}
				}
			}
		}
	}

	return nil
}

// sendEmailNotification sends an email notification for an alert
func (s *NotificationService) sendEmailNotification(ctx context.Context, event repository.AlertTriggerEvent) error {
	user, err := s.uow.User().GetByID(ctx, event.UserID)
	if err != nil {
		userEmail := fmt.Sprintf("user-%s@example.com", event.UserID)
		return s.SendEmailAlertNotification(ctx, event, userEmail, "User")
	}

	return s.SendEmailAlertNotification(ctx, event, user.Email, user.Name)
}

// SendEmailAlertNotification sends an email alert notification
func (s *NotificationService) SendEmailAlertNotification(ctx context.Context, event repository.AlertTriggerEvent, userEmail, userName string) error {
	subject := s.generateEmailSubject(event)
	textBody := s.generateEmailBody(event, userName)
	htmlBody := s.renderAlertEmailHTML(event, userName)

	if err := s.emailService.SendAlertEmail(ctx, userEmail, subject, textBody, htmlBody); err != nil {
		return fmt.Errorf("failed to send alert email: %w", err)
	}

	s.logNotificationSuccess(ctx, event, NotificationMethodEmail)
	return nil
}

// SendInAppNotification sends an in-app notification
func (s *NotificationService) SendInAppNotification(ctx context.Context, event repository.AlertTriggerEvent) error {
	s.logNotificationSuccess(ctx, event, NotificationMethodInApp)
	return nil
}

// SendPushNotification sends a push notification
func (s *NotificationService) SendPushNotification(ctx context.Context, event repository.AlertTriggerEvent) error {
	log.Printf("[NotificationService] SendPushNotification: started user=%s alert=%s", event.UserID, event.AlertID)
	subs := s.getUserPushSubscriptions(ctx, event.UserID)
	if len(subs) == 0 {
		return nil
	}

	payload, err := json.Marshal(map[string]interface{}{
		"title": s.generatePushTitle(event),
		"body":  event.Message,
		"icon":  "/icon.png",
		"data": map[string]string{
			"alert_id":   event.AlertID,
			"alert_type": string(event.AlertType),
		},
	})
	if err != nil {
		return fmt.Errorf("failed to marshal push payload: %w", err)
	}

	for _, sub := range subs {
		subscriber := webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys: webpush.Keys{
				P256dh: sub.P256dh,
				Auth:   sub.Auth,
			},
		}

		resp, err := webpush.SendNotification(payload, &subscriber, &webpush.Options{
			VAPIDPrivateKey: s.vapidKey,
			TTL:             24 * 60 * 60,
		})
		if err != nil {
			s.logNotificationError(ctx, event, NotificationMethodPush, err)
			continue
		}
		resp.Body.Close()
		if resp.StatusCode >= 400 {
			s.logNotificationError(ctx, event, NotificationMethodPush, fmt.Errorf("push failed with status %d", resp.StatusCode))
			continue
		}
	}

	s.logNotificationSuccess(ctx, event, NotificationMethodPush)
	return nil
}

func (s *NotificationService) generatePushTitle(event repository.AlertTriggerEvent) string {
	switch event.AlertType {
	case repository.AlertTypePrice:
		return "Price Alert"
	case repository.AlertTypePercentageChange:
		return "Price Change Alert"
	case repository.AlertTypePortfolioValue:
		return "Portfolio Alert"
	case repository.AlertTypeAllocation:
		return "Allocation Alert"
	default:
		return "Portfolio Notification"
	}
}

func (s *NotificationService) getUserPushSubscriptions(ctx context.Context, userID string) []*PushSubscription {
	return nil
}

// SendWebhookNotification sends a webhook notification
func (s *NotificationService) SendWebhookNotification(ctx context.Context, event repository.AlertTriggerEvent, webhookURL string) error {
	log.Printf("[NotificationService] SendWebhookNotification: started user=%s alert=%s url=%s", event.UserID, event.AlertID, webhookURL)
	payload := map[string]interface{}{
		"event_id":      event.AlertID,
		"user_id":       event.UserID,
		"alert_type":    event.AlertType,
		"condition":     event.ConditionType,
		"message":       event.Message,
		"current_value": event.CurrentValue.String(),
		"threshold":     event.ThresholdValue.String(),
		"triggered_at":  event.TriggeredAt.Format(time.RFC3339),
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	maxRetries := 3
	var lastErr error

	for attempt := 1; attempt <= maxRetries; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, webhookURL, bytes.NewReader(jsonPayload))
		if err != nil {
			return fmt.Errorf("failed to create webhook request: %w", err)
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "SigmaFinance/1.0")

		resp, err := s.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			s.logNotificationSuccess(ctx, event, NotificationMethodWebhook)
			return nil
		}

		lastErr = fmt.Errorf("webhook returned status %d", resp.StatusCode)
		if attempt < maxRetries {
			time.Sleep(time.Duration(attempt) * 500 * time.Millisecond)
		}
	}

	log.Printf("[NotificationService] SendWebhookNotification: ERROR all retries exhausted user=%s: %v", event.UserID, lastErr)

	return fmt.Errorf("webhook notification failed after %d attempts: %w", maxRetries, lastErr)
}

// GetUserNotificationPreferences retrieves user notification preferences
func (s *NotificationService) GetUserNotificationPreferences(ctx context.Context, userID string) (*NotificationPreferences, error) {
	prefs, err := s.uow.NotificationPreferences().GetByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return &NotificationPreferences{
				UserID:            userID,
				EmailEnabled:      true,
				InAppEnabled:      true,
				PushEnabled:       false,
				WebhookEnabled:    false,
				QuietHoursEnabled: false,
				AlertTypePreferences: map[repository.AlertType][]AlertNotificationMethod{
					repository.AlertTypePrice:            {NotificationMethodEmail, NotificationMethodInApp},
					repository.AlertTypePercentageChange: {NotificationMethodInApp, NotificationMethodPush},
					repository.AlertTypePortfolioValue:   {NotificationMethodEmail},
					repository.AlertTypeAllocation:       {NotificationMethodEmail},
				},
			}, nil
		}
		return nil, fmt.Errorf("failed to get notification preferences: %w", err)
	}

	return &NotificationPreferences{
		UserID:               prefs.UserID,
		EmailEnabled:         prefs.EmailEnabled,
		PushEnabled:          prefs.PushEnabled,
		InAppEnabled:         prefs.InAppEnabled,
		WebhookEnabled:       prefs.WebhookEnabled,
		WebhookURL:           prefs.WebhookURL,
		QuietHoursEnabled:    prefs.QuietHoursEnabled,
		QuietHoursStart:      prefs.QuietHoursStart,
		QuietHoursEnd:        prefs.QuietHoursEnd,
		AlertTypePreferences: nil,
	}, nil
}

// UpdateUserNotificationPreferences updates user notification preferences
func (s *NotificationService) UpdateUserNotificationPreferences(ctx context.Context, userID string, prefs NotificationPreferences) error {
	model := &repository.NotificationPreferencesModel{
		UserID:            userID,
		EmailEnabled:      prefs.EmailEnabled,
		PushEnabled:       prefs.PushEnabled,
		InAppEnabled:      prefs.InAppEnabled,
		WebhookEnabled:    prefs.WebhookEnabled,
		WebhookURL:        prefs.WebhookURL,
		QuietHoursEnabled: prefs.QuietHoursEnabled,
		QuietHoursStart:   prefs.QuietHoursStart,
		QuietHoursEnd:     prefs.QuietHoursEnd,
	}

	if err := s.uow.NotificationPreferences().Upsert(ctx, model); err != nil {
		return fmt.Errorf("failed to update notification preferences: %w", err)
	}
	return nil
}

// LogNotification logs a notification record
func (s *NotificationService) LogNotification(ctx context.Context, notification NotificationLog) error {
	model := &repository.NotificationLogModel{
		ID:           notification.ID,
		UserID:       notification.UserID,
		AlertID:      notification.AlertID,
		Method:       string(notification.Method),
		Status:       string(notification.Status),
		Message:      notification.Message,
		ErrorMessage: notification.ErrorMessage,
		SentAt:       notification.SentAt,
		DeliveredAt:  notification.DeliveredAt,
	}

	if err := s.uow.NotificationLog().Create(ctx, model); err != nil {
		return fmt.Errorf("failed to log notification: %w", err)
	}
	return nil
}

// GetNotificationHistory retrieves notification history for a user
func (s *NotificationService) GetNotificationHistory(ctx context.Context, userID string, filter NotificationHistoryFilter) ([]*NotificationLog, error) {
	logs, err := s.uow.NotificationLog().FindByUserID(ctx, userID, filter.Limit, filter.Offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get notification history: %w", err)
	}

	result := make([]*NotificationLog, len(logs))
	for i, log := range logs {
		result[i] = &NotificationLog{
			ID:           log.ID,
			UserID:       log.UserID,
			AlertID:      log.AlertID,
			Method:       AlertNotificationMethod(log.Method),
			Status:       NotificationStatus(log.Status),
			Message:      log.Message,
			ErrorMessage: log.ErrorMessage,
			SentAt:       log.SentAt,
			DeliveredAt:  log.DeliveredAt,
		}
	}
	return result, nil
}

// Helper methods

// isQuietHours checks if current time is within user's quiet hours
func (s *NotificationService) isQuietHours(prefs *NotificationPreferences) bool {
	if !prefs.QuietHoursEnabled {
		return false
	}

	if prefs.QuietHoursStart == "" || prefs.QuietHoursEnd == "" {
		return false
	}

	currentTime := time.Now()
	currentMinutes := currentTime.Hour()*60 + currentTime.Minute()

	parseQuietHours := func(t string) (int, error) {
		var hour, minute int
		_, err := fmt.Sscanf(t, "%d:%d", &hour, &minute)
		if err != nil {
			return 0, err
		}
		return hour*60 + minute, nil
	}

	start, err := parseQuietHours(prefs.QuietHoursStart)
	if err != nil {
		return false
	}

	end, err := parseQuietHours(prefs.QuietHoursEnd)
	if err != nil {
		return false
	}

	if start <= end {
		return currentMinutes >= start && currentMinutes < end
	}

	return currentMinutes >= start || currentMinutes < end
}

// isMethodEnabled checks if a notification method is enabled for the user
func (s *NotificationService) isMethodEnabled(prefs *NotificationPreferences, method AlertNotificationMethod) bool {
	switch method {
	case NotificationMethodEmail:
		return prefs.EmailEnabled
	case NotificationMethodInApp:
		return prefs.InAppEnabled
	case NotificationMethodPush:
		return prefs.PushEnabled
	case NotificationMethodWebhook:
		return prefs.WebhookEnabled
	default:
		return false
	}
}

// generateEmailSubject generates an email subject for an alert
func (s *NotificationService) generateEmailSubject(event repository.AlertTriggerEvent) string {
	switch event.AlertType {
	case repository.AlertTypePrice:
		return fmt.Sprintf("Price Alert: %s", event.Message)
	case repository.AlertTypePercentageChange:
		return fmt.Sprintf("Price Change Alert: %s", event.Message)
	case repository.AlertTypePortfolioValue:
		return fmt.Sprintf("Portfolio Alert: %s", event.Message)
	case repository.AlertTypeAllocation:
		return fmt.Sprintf("Allocation Alert: %s", event.Message)
	default:
		return "Portfolio Alert Triggered"
	}
}

// generateEmailBody generates an email body for an alert
func (s *NotificationService) generateEmailBody(event repository.AlertTriggerEvent, userName string) string {
	return fmt.Sprintf(`
Dear %s,

Your alert has been triggered:

%s

Alert Details:
- Type: %s
- Condition: %s
- Current Value: %s
- Threshold: %s
- Triggered At: %s

You can manage your alerts by logging into your portfolio dashboard.

Best regards,
Sigma Finance Team
`, userName, event.Message, event.AlertType, event.ConditionType,
		event.CurrentValue.String(), event.ThresholdValue.String(),
		event.TriggeredAt.Format("2006-01-02 15:04:05"))
}

// renderAlertEmailHTML renders the HTML template for alert emails
func (s *NotificationService) renderAlertEmailHTML(event repository.AlertTriggerEvent, userName string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>%s</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .alert-box { background-color: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc2626; }
        .detail-row { margin: 10px 0; }
        .detail-label { font-weight: bold; color: #64748b; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Sigma Finance Alert</h1>
    </div>
    <div class="content">
        <p>Hello %s,</p>
        <p>Your alert has been triggered:</p>
        <div class="alert-box">
            <strong>%s</strong>
        </div>
        <div class="detail-row">
            <span class="detail-label">Type:</span> %s
        </div>
        <div class="detail-row">
            <span class="detail-label">Condition:</span> %s
        </div>
        <div class="detail-row">
            <span class="detail-label">Current Value:</span> %s
        </div>
        <div class="detail-row">
            <span class="detail-label">Threshold:</span> %s
        </div>
        <div class="detail-row">
            <span class="detail-label">Triggered At:</span> %s
        </div>
        <p>You can manage your alerts by logging into your portfolio dashboard.</p>
    </div>
    <div class="footer">
        <p>Best regards,<br>The Sigma Finance Team</p>
        <p>This is an automated message, please do not reply to this email.</p>
    </div>
</body>
</html>`, s.generateEmailSubject(event), userName, event.Message,
		event.AlertType, event.ConditionType,
		event.CurrentValue.String(), event.ThresholdValue.String(),
		event.TriggeredAt.Format("2006-01-02 15:04:05"))
}

// logNotificationSuccess logs a successful notification
func (s *NotificationService) logNotificationSuccess(ctx context.Context, event repository.AlertTriggerEvent, method AlertNotificationMethod) {
	log := NotificationLog{
		ID:      uuid.NewString(),
		UserID:  event.UserID,
		AlertID: event.AlertID,
		Method:  method,
		Status:  NotificationStatusSent,
		Message: event.Message,
		SentAt:  time.Now(),
	}
	s.LogNotification(ctx, log)
}

// logNotificationError logs a failed notification
func (s *NotificationService) logNotificationError(ctx context.Context, event repository.AlertTriggerEvent, method AlertNotificationMethod, err error) {
	log := NotificationLog{
		ID:           uuid.NewString(),
		UserID:       event.UserID,
		AlertID:      event.AlertID,
		Method:       method,
		Status:       NotificationStatusFailed,
		Message:      event.Message,
		ErrorMessage: err.Error(),
		SentAt:       time.Now(),
	}
	s.LogNotification(ctx, log)
}
