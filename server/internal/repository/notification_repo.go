package repository

import (
	"context"
	"time"

	"github.com/uptrace/bun"
)

// NotificationPreferencesModel represents user notification preferences in the database
type NotificationPreferencesModel struct {
	bun.BaseModel `bun:"table:notification_preferences"`

	ID                string    `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID            string    `bun:"user_id,notnull,unique"`
	EmailEnabled      bool      `bun:"email_enabled,default:true"`
	PushEnabled       bool      `bun:"push_enabled,default:false"`
	InAppEnabled      bool      `bun:"in_app_enabled,default:true"`
	WebhookEnabled    bool      `bun:"webhook_enabled,default:false"`
	WebhookURL        string    `bun:"webhook_url,omitempty"`
	QuietHoursEnabled bool      `bun:"quiet_hours_enabled,default:false"`
	QuietHoursStart   string    `bun:"quiet_hours_start,omitempty"` // Format: "22:00"
	QuietHoursEnd     string    `bun:"quiet_hours_end,omitempty"`   // Format: "08:00"
	CreatedAt         time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt         time.Time `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}

// NotificationLogModel represents a notification log entry in the database
type NotificationLogModel struct {
	bun.BaseModel `bun:"table:notification_logs"`

	ID           string     `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID       string     `bun:"user_id,notnull"`
	AlertID      string     `bun:"alert_id,notnull"`
	Method       string     `bun:"method,notnull"` // EMAIL, PUSH, IN_APP, WEBHOOK
	Status       string     `bun:"status,notnull"` // PENDING, SENT, DELIVERED, FAILED
	Message      string     `bun:"message"`
	ErrorMessage string     `bun:"error_message,omitempty"`
	SentAt       time.Time  `bun:"sent_at,notnull"`
	DeliveredAt  *time.Time `bun:"delivered_at,omitempty"`
}

// PushSubscriptionModel represents a user's web push subscription
type PushSubscriptionModel struct {
	bun.BaseModel `bun:"table:push_subscriptions"`

	ID        string    `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID    string    `bun:"user_id,notnull"`
	Endpoint  string    `bun:"endpoint,notnull"`
	P256dh    string    `bun:"p256dh,notnull"`
	Auth      string    `bun:"auth,notnull"`
	CreatedAt time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`
}

// INotificationPreferencesRepository defines the interface for notification preferences operations
type INotificationPreferencesRepository interface {
	GetByUserID(ctx context.Context, userID string) (*NotificationPreferencesModel, error)
	Upsert(ctx context.Context, prefs *NotificationPreferencesModel) error
}

// INotificationLogRepository defines the interface for notification log operations
type INotificationLogRepository interface {
	Create(ctx context.Context, log *NotificationLogModel) error
	FindByUserID(ctx context.Context, userID string, limit, offset *int) ([]NotificationLogModel, error)
	CountByUserID(ctx context.Context, userID string) (int, error)
}

// IPushSubscriptionRepository defines the interface for push subscription operations
type IPushSubscriptionRepository interface {
	FindByUserID(ctx context.Context, userID string) ([]PushSubscriptionModel, error)
	DeleteByEndpoint(ctx context.Context, endpoint string) error
	DeleteByUserID(ctx context.Context, userID string) error
}

// NotificationPreferencesRepository implements INotificationPreferencesRepository
type NotificationPreferencesRepository struct {
	*Repository[NotificationPreferencesModel]
}

// NewNotificationPreferencesRepository creates a new notification preferences repository
func NewNotificationPreferencesRepository(db bun.IDB) *NotificationPreferencesRepository {
	return &NotificationPreferencesRepository{
		Repository: NewRepository[NotificationPreferencesModel](db),
	}
}

// FindByUserID retrieves preferences by user ID
func (r *NotificationPreferencesRepository) GetByUserID(ctx context.Context, userID string) (*NotificationPreferencesModel, error) {
	var prefs NotificationPreferencesModel
	err := r.db.NewSelect().Model(&prefs).Where("user_id = ?", userID).Scan(ctx, &prefs)
	if err != nil {
		return nil, err
	}
	return &prefs, nil
}

// Upsert creates or updates notification preferences
func (r *NotificationPreferencesRepository) Upsert(ctx context.Context, prefs *NotificationPreferencesModel) error {
	_, err := r.db.NewInsert().On("CONFLICT (user_id) DO UPDATE").Set("email_enabled = EXCLUDED.email_enabled, push_enabled = EXCLUDED.push_enabled, in_app_enabled = EXCLUDED.in_app_enabled, webhook_enabled = EXCLUDED.webhook_enabled, webhook_url = EXCLUDED.webhook_url, quiet_hours_enabled = EXCLUDED.quiet_hours_enabled, quiet_hours_start = EXCLUDED.quiet_hours_start, quiet_hours_end = EXCLUDED.quiet_hours_end, updated_at = current_timestamp").Model(prefs).Exec(ctx)
	return err
}

// NotificationLogRepository implements INotificationLogRepository
type NotificationLogRepository struct {
	*Repository[NotificationLogModel]
}

// NewNotificationLogRepository creates a new notification log repository
func NewNotificationLogRepository(db bun.IDB) *NotificationLogRepository {
	return &NotificationLogRepository{
		Repository: NewRepository[NotificationLogModel](db),
	}
}

// Create inserts a new notification log entry
func (r *NotificationLogRepository) Create(ctx context.Context, log *NotificationLogModel) error {
	_, err := r.db.NewInsert().Model(log).Exec(ctx)
	return err
}

// FindByUserID retrieves notification logs for a user with pagination
func (r *NotificationLogRepository) FindByUserID(ctx context.Context, userID string, limit, offset *int) ([]NotificationLogModel, error) {
	query := r.db.NewSelect().Model(&NotificationLogModel{}).Where("user_id = ?", userID).Order("sent_at DESC")

	if limit != nil && *limit > 0 {
		query = query.Limit(*limit)
	}
	if offset != nil && *offset > 0 {
		query = query.Offset(*offset)
	}

	var logs []NotificationLogModel
	err := query.Scan(ctx, &logs)
	return logs, err
}

// CountByUserID counts notification logs for a user
func (r *NotificationLogRepository) CountByUserID(ctx context.Context, userID string) (int, error) {
	return r.db.NewSelect().Model(&NotificationLogModel{}).Where("user_id = ?", userID).Count(ctx)
}

// PushSubscriptionRepository implements IPushSubscriptionRepository
type PushSubscriptionRepository struct {
	*Repository[PushSubscriptionModel]
}

// NewPushSubscriptionRepository creates a new push subscription repository
func NewPushSubscriptionRepository(db bun.IDB) *PushSubscriptionRepository {
	return &PushSubscriptionRepository{
		Repository: NewRepository[PushSubscriptionModel](db),
	}
}

// FindByUserID retrieves all push subscriptions for a user
func (r *PushSubscriptionRepository) FindByUserID(ctx context.Context, userID string) ([]PushSubscriptionModel, error) {
	var subs []PushSubscriptionModel
	err := r.db.NewSelect().Model(&subs).Where("user_id = ?", userID).Scan(ctx, &subs)
	return subs, err
}

// DeleteByEndpoint deletes a push subscription by endpoint
func (r *PushSubscriptionRepository) DeleteByEndpoint(ctx context.Context, endpoint string) error {
	_, err := r.db.NewDelete().Model(&PushSubscriptionModel{}).Where("endpoint = ?", endpoint).Exec(ctx)
	return err
}

// DeleteByUserID deletes all push subscriptions for a user
func (r *PushSubscriptionRepository) DeleteByUserID(ctx context.Context, userID string) error {
	_, err := r.db.NewDelete().Model(&PushSubscriptionModel{}).Where("user_id = ?", userID).Exec(ctx)
	return err
}
