package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

// AlertType represents the type of alert
type AlertType string

const (
	AlertTypePrice            AlertType = "PRICE"
	AlertTypePercentageChange AlertType = "PERCENTAGE_CHANGE"
	AlertTypePortfolioValue   AlertType = "PORTFOLIO_VALUE"
	AlertTypeAllocation       AlertType = "ALLOCATION"
)

// ConditionType represents the condition for triggering an alert
type ConditionType string

const (
	ConditionTypeAbove      ConditionType = "ABOVE"
	ConditionTypeBelow      ConditionType = "BELOW"
	ConditionTypeIncreaseBy ConditionType = "INCREASE_BY"
	ConditionTypeDecreaseBy ConditionType = "DECREASE_BY"
)

// UserAlert represents a user-configured alert
type UserAlert struct {
	ID                  uuid.UUID        `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID              uuid.UUID        `bun:"user_id,notnull"`
	AssetID             *uuid.UUID       `bun:"asset_id"`
	PortfolioID         *uuid.UUID       `bun:"portfolio_id"`
	AlertType           AlertType        `bun:"alert_type,notnull"`
	ConditionType       ConditionType    `bun:"condition_type,notnull"`
	ThresholdValue      *decimal.Decimal `bun:"threshold_value,type:decimal(20,8)"`
	ThresholdPercentage *decimal.Decimal `bun:"threshold_percentage,type:decimal(5,2)"`
	IsActive            bool             `bun:"is_active,default:true"`
	LastTriggered       *time.Time       `bun:"last_triggered"`
	CreatedAt           time.Time        `bun:"created_at,nullzero,notnull,default:current_timestamp"`
}

// AlertFilter defines filter criteria for alert queries
type AlertFilter struct {
	UserID       *uuid.UUID `json:"user_id,omitempty"`
	AssetID      *uuid.UUID `json:"asset_id,omitempty"`
	PortfolioID  *uuid.UUID `json:"portfolio_id,omitempty"`
	AlertType    *AlertType `json:"alert_type,omitempty"`
	IsActive     *bool      `json:"is_active,omitempty"`
	CreatedAfter *time.Time `json:"created_after,omitempty"`
	Limit        *int       `json:"limit,omitempty"`
	Offset       *int       `json:"offset,omitempty"`
}

// AlertTriggerEvent represents an alert trigger event
type AlertTriggerEvent struct {
	AlertID        uuid.UUID       `json:"alert_id"`
	UserID         uuid.UUID       `json:"user_id"`
	AssetID        *uuid.UUID      `json:"asset_id,omitempty"`
	PortfolioID    *uuid.UUID      `json:"portfolio_id,omitempty"`
	AlertType      AlertType       `json:"alert_type"`
	ConditionType  ConditionType   `json:"condition_type"`
	CurrentValue   decimal.Decimal `json:"current_value"`
	ThresholdValue decimal.Decimal `json:"threshold_value"`
	TriggeredAt    time.Time       `json:"triggered_at"`
	Message        string          `json:"message"`
}

// IAlertRepository defines the interface for alert repository operations
type IAlertRepository interface {
	IRepository[UserAlert]

	// Enhanced CRUD operations
	GetByUUID(ctx context.Context, id uuid.UUID) (*UserAlert, error)
	FindWithFilters(ctx context.Context, filter AlertFilter) ([]UserAlert, error)
	CountWithFilters(ctx context.Context, filter AlertFilter) (int, error)

	// User-specific queries
	GetUserAlerts(ctx context.Context, userID uuid.UUID) ([]UserAlert, error)
	GetActiveUserAlerts(ctx context.Context, userID uuid.UUID) ([]UserAlert, error)
	GetAssetAlerts(ctx context.Context, assetID uuid.UUID) ([]UserAlert, error)
	GetPortfolioAlerts(ctx context.Context, portfolioID uuid.UUID) ([]UserAlert, error)

	// Alert processing
	GetAlertsToProcess(ctx context.Context, alertTypes []AlertType) ([]UserAlert, error)
	UpdateLastTriggered(ctx context.Context, alertID uuid.UUID, triggeredAt time.Time) error
	DeactivateAlert(ctx context.Context, alertID uuid.UUID) error

	// Alert evaluation
	EvaluatePriceAlerts(ctx context.Context, assetID uuid.UUID, currentPrice decimal.Decimal) ([]AlertTriggerEvent, error)
	EvaluatePercentageChangeAlerts(ctx context.Context, assetID uuid.UUID, changePercent decimal.Decimal) ([]AlertTriggerEvent, error)
	EvaluatePortfolioValueAlerts(ctx context.Context, portfolioID uuid.UUID, currentValue decimal.Decimal) ([]AlertTriggerEvent, error)

	// Batch operations
	CreateBatch(ctx context.Context, alerts []UserAlert) error
	UpdateBatch(ctx context.Context, alerts []UserAlert) error
	DeactivateBatch(ctx context.Context, alertIDs []uuid.UUID) error
	
	// UUID-based operations
	DeleteByUUID(ctx context.Context, id uuid.UUID) error
}

// AlertRepository is the concrete implementation of IAlertRepository
type AlertRepository struct {
	*Repository[UserAlert]
}

// NewAlertRepository creates a new AlertRepository
func NewAlertRepository(db bun.IDB) *AlertRepository {
	return &AlertRepository{
		Repository: NewRepository[UserAlert](db),
	}
}

// GetByUUID retrieves an alert by its UUID
func (r *AlertRepository) GetByUUID(ctx context.Context, id uuid.UUID) (*UserAlert, error) {
	var alert UserAlert
	err := r.db.NewSelect().
		Model(&alert).
		Where("id = ?", id).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &alert, nil
}

// FindWithFilters retrieves alerts with multiple filter criteria
func (r *AlertRepository) FindWithFilters(ctx context.Context, filter AlertFilter) ([]UserAlert, error) {
	query := r.db.NewSelect().Model((*UserAlert)(nil))

	// Apply filters
	query = r.applyAlertFilters(query, filter)

	// Apply ordering - by created_at DESC for most recent first
	query = query.Order("created_at DESC")

	// Apply pagination
	if filter.Limit != nil && *filter.Limit > 0 {
		query = query.Limit(*filter.Limit)
	}
	if filter.Offset != nil && *filter.Offset > 0 {
		query = query.Offset(*filter.Offset)
	}

	var alerts []UserAlert
	err := query.Scan(ctx, &alerts)
	return alerts, err
}

// CountWithFilters returns the count of alerts matching the filter criteria
func (r *AlertRepository) CountWithFilters(ctx context.Context, filter AlertFilter) (int, error) {
	query := r.db.NewSelect().Model((*UserAlert)(nil))
	query = r.applyAlertFilters(query, filter)
	return query.Count(ctx)
}

// applyAlertFilters applies filter criteria to a query
func (r *AlertRepository) applyAlertFilters(query *bun.SelectQuery, filter AlertFilter) *bun.SelectQuery {
	if filter.UserID != nil {
		query = query.Where("user_id = ?", *filter.UserID)
	}

	if filter.AssetID != nil {
		query = query.Where("asset_id = ?", *filter.AssetID)
	}

	if filter.PortfolioID != nil {
		query = query.Where("portfolio_id = ?", *filter.PortfolioID)
	}

	if filter.AlertType != nil {
		query = query.Where("alert_type = ?", *filter.AlertType)
	}

	if filter.IsActive != nil {
		query = query.Where("is_active = ?", *filter.IsActive)
	}

	if filter.CreatedAfter != nil {
		query = query.Where("created_at > ?", *filter.CreatedAfter)
	}

	return query
}

// GetUserAlerts retrieves all alerts for a user
func (r *AlertRepository) GetUserAlerts(ctx context.Context, userID uuid.UUID) ([]UserAlert, error) {
	return r.FindWithFilters(ctx, AlertFilter{UserID: &userID})
}

// GetActiveUserAlerts retrieves all active alerts for a user
func (r *AlertRepository) GetActiveUserAlerts(ctx context.Context, userID uuid.UUID) ([]UserAlert, error) {
	isActive := true
	return r.FindWithFilters(ctx, AlertFilter{
		UserID:   &userID,
		IsActive: &isActive,
	})
}

// GetAssetAlerts retrieves all alerts for a specific asset
func (r *AlertRepository) GetAssetAlerts(ctx context.Context, assetID uuid.UUID) ([]UserAlert, error) {
	isActive := true
	return r.FindWithFilters(ctx, AlertFilter{
		AssetID:  &assetID,
		IsActive: &isActive,
	})
}

// GetPortfolioAlerts retrieves all alerts for a specific portfolio
func (r *AlertRepository) GetPortfolioAlerts(ctx context.Context, portfolioID uuid.UUID) ([]UserAlert, error) {
	isActive := true
	return r.FindWithFilters(ctx, AlertFilter{
		PortfolioID: &portfolioID,
		IsActive:    &isActive,
	})
}

// GetAlertsToProcess retrieves alerts that need to be processed
func (r *AlertRepository) GetAlertsToProcess(ctx context.Context, alertTypes []AlertType) ([]UserAlert, error) {
	if len(alertTypes) == 0 {
		return []UserAlert{}, nil
	}

	var alerts []UserAlert
	err := r.db.NewSelect().
		Model(&alerts).
		Where("is_active = true").
		Where("alert_type IN (?)", bun.In(alertTypes)).
		Order("created_at ASC").
		Scan(ctx)

	return alerts, err
}

// UpdateLastTriggered updates the last triggered timestamp for an alert
func (r *AlertRepository) UpdateLastTriggered(ctx context.Context, alertID uuid.UUID, triggeredAt time.Time) error {
	_, err := r.db.NewUpdate().
		Model((*UserAlert)(nil)).
		Set("last_triggered = ?", triggeredAt).
		Where("id = ?", alertID).
		Exec(ctx)

	return err
}

// DeactivateAlert deactivates an alert
func (r *AlertRepository) DeactivateAlert(ctx context.Context, alertID uuid.UUID) error {
	_, err := r.db.NewUpdate().
		Model((*UserAlert)(nil)).
		Set("is_active = false").
		Where("id = ?", alertID).
		Exec(ctx)

	return err
}

// EvaluatePriceAlerts evaluates price-based alerts for an asset
func (r *AlertRepository) EvaluatePriceAlerts(ctx context.Context, assetID uuid.UUID, currentPrice decimal.Decimal) ([]AlertTriggerEvent, error) {
	priceAlertType := AlertTypePrice
	alerts, err := r.FindWithFilters(ctx, AlertFilter{
		AssetID:   &assetID,
		AlertType: &priceAlertType,
		IsActive:  &[]bool{true}[0],
	})
	if err != nil {
		return nil, err
	}

	var triggerEvents []AlertTriggerEvent

	for _, alert := range alerts {
		if alert.ThresholdValue == nil {
			continue
		}

		var shouldTrigger bool
		var message string

		switch alert.ConditionType {
		case ConditionTypeAbove:
			shouldTrigger = currentPrice.GreaterThan(*alert.ThresholdValue)
			message = "Price is above threshold"
		case ConditionTypeBelow:
			shouldTrigger = currentPrice.LessThan(*alert.ThresholdValue)
			message = "Price is below threshold"
		}

		if shouldTrigger {
			triggerEvents = append(triggerEvents, AlertTriggerEvent{
				AlertID:        alert.ID,
				UserID:         alert.UserID,
				AssetID:        &assetID,
				AlertType:      alert.AlertType,
				ConditionType:  alert.ConditionType,
				CurrentValue:   currentPrice,
				ThresholdValue: *alert.ThresholdValue,
				TriggeredAt:    time.Now(),
				Message:        message,
			})
		}
	}

	return triggerEvents, nil
}

// EvaluatePercentageChangeAlerts evaluates percentage change alerts for an asset
func (r *AlertRepository) EvaluatePercentageChangeAlerts(ctx context.Context, assetID uuid.UUID, changePercent decimal.Decimal) ([]AlertTriggerEvent, error) {
	percentageAlertType := AlertTypePercentageChange
	alerts, err := r.FindWithFilters(ctx, AlertFilter{
		AssetID:   &assetID,
		AlertType: &percentageAlertType,
		IsActive:  &[]bool{true}[0],
	})
	if err != nil {
		return nil, err
	}

	var triggerEvents []AlertTriggerEvent

	for _, alert := range alerts {
		if alert.ThresholdPercentage == nil {
			continue
		}

		var shouldTrigger bool
		var message string

		switch alert.ConditionType {
		case ConditionTypeIncreaseBy:
			shouldTrigger = changePercent.GreaterThanOrEqual(*alert.ThresholdPercentage)
			message = "Price increased by threshold percentage"
		case ConditionTypeDecreaseBy:
			shouldTrigger = changePercent.LessThanOrEqual(alert.ThresholdPercentage.Neg())
			message = "Price decreased by threshold percentage"
		}

		if shouldTrigger {
			triggerEvents = append(triggerEvents, AlertTriggerEvent{
				AlertID:        alert.ID,
				UserID:         alert.UserID,
				AssetID:        &assetID,
				AlertType:      alert.AlertType,
				ConditionType:  alert.ConditionType,
				CurrentValue:   changePercent,
				ThresholdValue: *alert.ThresholdPercentage,
				TriggeredAt:    time.Now(),
				Message:        message,
			})
		}
	}

	return triggerEvents, nil
}

// EvaluatePortfolioValueAlerts evaluates portfolio value alerts
func (r *AlertRepository) EvaluatePortfolioValueAlerts(ctx context.Context, portfolioID uuid.UUID, currentValue decimal.Decimal) ([]AlertTriggerEvent, error) {
	portfolioAlertType := AlertTypePortfolioValue
	alerts, err := r.FindWithFilters(ctx, AlertFilter{
		PortfolioID: &portfolioID,
		AlertType:   &portfolioAlertType,
		IsActive:    &[]bool{true}[0],
	})
	if err != nil {
		return nil, err
	}

	var triggerEvents []AlertTriggerEvent

	for _, alert := range alerts {
		if alert.ThresholdValue == nil {
			continue
		}

		var shouldTrigger bool
		var message string

		switch alert.ConditionType {
		case ConditionTypeAbove:
			shouldTrigger = currentValue.GreaterThan(*alert.ThresholdValue)
			message = "Portfolio value is above threshold"
		case ConditionTypeBelow:
			shouldTrigger = currentValue.LessThan(*alert.ThresholdValue)
			message = "Portfolio value is below threshold"
		}

		if shouldTrigger {
			triggerEvents = append(triggerEvents, AlertTriggerEvent{
				AlertID:        alert.ID,
				UserID:         alert.UserID,
				PortfolioID:    &portfolioID,
				AlertType:      alert.AlertType,
				ConditionType:  alert.ConditionType,
				CurrentValue:   currentValue,
				ThresholdValue: *alert.ThresholdValue,
				TriggeredAt:    time.Now(),
				Message:        message,
			})
		}
	}

	return triggerEvents, nil
}

// CreateBatch creates multiple alerts in a single transaction
func (r *AlertRepository) CreateBatch(ctx context.Context, alerts []UserAlert) error {
	if len(alerts) == 0 {
		return nil
	}

	// Set timestamps
	now := time.Now()
	for i := range alerts {
		alerts[i].CreatedAt = now
	}

	_, err := r.db.NewInsert().
		Model(&alerts).
		Exec(ctx)

	return err
}

// UpdateBatch updates multiple alerts in a single transaction
func (r *AlertRepository) UpdateBatch(ctx context.Context, alerts []UserAlert) error {
	if len(alerts) == 0 {
		return nil
	}

	// Use bulk update with ON CONFLICT for better performance
	_, err := r.db.NewInsert().
		Model(&alerts).
		On("CONFLICT (id) DO UPDATE").
		Set("alert_type = EXCLUDED.alert_type").
		Set("condition_type = EXCLUDED.condition_type").
		Set("threshold_value = EXCLUDED.threshold_value").
		Set("threshold_percentage = EXCLUDED.threshold_percentage").
		Set("is_active = EXCLUDED.is_active").
		Exec(ctx)

	return err
}

// DeactivateBatch deactivates multiple alerts in a single transaction
func (r *AlertRepository) DeactivateBatch(ctx context.Context, alertIDs []uuid.UUID) error {
	if len(alertIDs) == 0 {
		return nil
	}

	_, err := r.db.NewUpdate().
		Model((*UserAlert)(nil)).
		Set("is_active = false").
		Where("id IN (?)", bun.In(alertIDs)).
		Exec(ctx)

	return err
}

// DeleteByUUID deletes an alert by its UUID
func (r *AlertRepository) DeleteByUUID(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.NewDelete().
		Model((*UserAlert)(nil)).
		Where("id = ?", id).
		Exec(ctx)
	if err != nil {
		return err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}