package service

import (
	"context"
	"fmt"
	"sigma_finance/internal/repository"
	"time"

	"github.com/google/uuid"
)

// NotificationService handles alert notifications through various channels
type NotificationService struct {
	emailService EmailService
	// Future: Add push notification service, webhook service, etc.
}

// NewNotificationService creates a new notification service
func NewNotificationService(emailService EmailService) *NotificationService {
	return &NotificationService{
		emailService: emailService,
	}
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
	GetUserNotificationPreferences(ctx context.Context, userID uuid.UUID) (*NotificationPreferences, error)
	UpdateUserNotificationPreferences(ctx context.Context, userID uuid.UUID, prefs NotificationPreferences) error

	// Notification history
	LogNotification(ctx context.Context, notification NotificationLog) error
	GetNotificationHistory(ctx context.Context, userID uuid.UUID, filter NotificationHistoryFilter) ([]*NotificationLog, error)
}

// NotificationPreferences represents user notification preferences
type NotificationPreferences struct {
	UserID               uuid.UUID                                          `json:"user_id"`
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
	ID           uuid.UUID               `json:"id"`
	UserID       uuid.UUID               `json:"user_id"`
	AlertID      uuid.UUID               `json:"alert_id"`
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
	AlertID    *uuid.UUID               `json:"alert_id,omitempty"`
	Method     *AlertNotificationMethod `json:"method,omitempty"`
	Status     *NotificationStatus      `json:"status,omitempty"`
	SentAfter  *time.Time               `json:"sent_after,omitempty"`
	SentBefore *time.Time               `json:"sent_before,omitempty"`
	Limit      *int                     `json:"limit,omitempty"`
	Offset     *int                     `json:"offset,omitempty"`
}

// SendAlertNotification sends notifications through specified methods
func (s *NotificationService) SendAlertNotification(ctx context.Context, event repository.AlertTriggerEvent, methods []AlertNotificationMethod) error {
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
		// During quiet hours, only send critical alerts or store for later
		fmt.Printf("Quiet hours active for user %s, deferring non-critical alert\n", event.UserID)
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
	// This would need user email and name from user service
	// For now, using placeholder values
	userEmail := fmt.Sprintf("user-%s@example.com", event.UserID)
	userName := "User"

	return s.SendEmailAlertNotification(ctx, event, userEmail, userName)
}

// SendEmailAlertNotification sends an email alert notification
func (s *NotificationService) SendEmailAlertNotification(ctx context.Context, event repository.AlertTriggerEvent, userEmail, userName string) error {
	subject := s.generateEmailSubject(event)
	body := s.generateEmailBody(event, userName)

	// Use a simple email sending approach for now
	// In a real implementation, this would use proper email templates
	fmt.Printf("Sending email to %s: %s\n%s\n", userEmail, subject, body)

	// Log successful notification
	s.logNotificationSuccess(ctx, event, NotificationMethodEmail)

	return nil
}

// SendInAppNotification sends an in-app notification
func (s *NotificationService) SendInAppNotification(ctx context.Context, event repository.AlertTriggerEvent) error {
	// This would typically store the notification in a database table
	// and use WebSocket to push to connected clients
	fmt.Printf("In-app notification for user %s: %s\n", event.UserID, event.Message)

	// Log successful notification
	s.logNotificationSuccess(ctx, event, NotificationMethodInApp)

	return nil
}

// SendPushNotification sends a push notification
func (s *NotificationService) SendPushNotification(ctx context.Context, event repository.AlertTriggerEvent) error {
	// This would integrate with a push notification service like FCM or APNs
	fmt.Printf("Push notification for user %s: %s\n", event.UserID, event.Message)

	// Log successful notification
	s.logNotificationSuccess(ctx, event, NotificationMethodPush)

	return nil
}

// SendWebhookNotification sends a webhook notification
func (s *NotificationService) SendWebhookNotification(ctx context.Context, event repository.AlertTriggerEvent, webhookURL string) error {
	// This would make an HTTP POST request to the webhook URL
	fmt.Printf("Webhook notification to %s for user %s: %s\n", webhookURL, event.UserID, event.Message)

	// Log successful notification
	s.logNotificationSuccess(ctx, event, NotificationMethodWebhook)

	return nil
}

// GetUserNotificationPreferences retrieves user notification preferences
func (s *NotificationService) GetUserNotificationPreferences(ctx context.Context, userID uuid.UUID) (*NotificationPreferences, error) {
	// This would query a user_notification_preferences table
	// For now, return default preferences
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

// UpdateUserNotificationPreferences updates user notification preferences
func (s *NotificationService) UpdateUserNotificationPreferences(ctx context.Context, userID uuid.UUID, prefs NotificationPreferences) error {
	// This would update the user_notification_preferences table
	fmt.Printf("Updated notification preferences for user %s\n", userID)
	return nil
}

// LogNotification logs a notification record
func (s *NotificationService) LogNotification(ctx context.Context, notification NotificationLog) error {
	// This would insert into a notification_log table
	fmt.Printf("Logged notification: %+v\n", notification)
	return nil
}

// GetNotificationHistory retrieves notification history for a user
func (s *NotificationService) GetNotificationHistory(ctx context.Context, userID uuid.UUID, filter NotificationHistoryFilter) ([]*NotificationLog, error) {
	// This would query the notification_log table
	// For now, return empty history
	return []*NotificationLog{}, nil
}

// Helper methods

// isQuietHours checks if current time is within user's quiet hours
func (s *NotificationService) isQuietHours(prefs *NotificationPreferences) bool {
	if !prefs.QuietHoursEnabled {
		return false
	}

	// This would parse the quiet hours and check current time
	// For now, always return false
	return false
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

// logNotificationSuccess logs a successful notification
func (s *NotificationService) logNotificationSuccess(ctx context.Context, event repository.AlertTriggerEvent, method AlertNotificationMethod) {
	log := NotificationLog{
		ID:      uuid.New(),
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
		ID:           uuid.New(),
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
