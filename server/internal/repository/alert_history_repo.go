package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

// AlertHistory represents a historical alert trigger event
type AlertHistory struct {
	ID               uuid.UUID       `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	AlertID          uuid.UUID       `bun:"alert_id,notnull"`
	UserID           uuid.UUID       `bun:"user_id,notnull"`
	AssetID          *uuid.UUID      `bun:"asset_id"`
	PortfolioID      *uuid.UUID      `bun:"portfolio_id"`
	AlertType        AlertType       `bun:"alert_type,notnull"`
	ConditionType    ConditionType   `bun:"condition_type,notnull"`
	CurrentValue     decimal.Decimal `bun:"current_value,type:decimal(20,8),notnull"`
	ThresholdValue   decimal.Decimal `bun:"threshold_value,type:decimal(20,8),notnull"`
	Message          string          `bun:"message,notnull"`
	TriggeredAt      time.Time       `bun:"triggered_at,notnull"`
	AcknowledgedAt   *time.Time      `bun:"acknowledged_at"`
	AcknowledgedBy   *uuid.UUID      `bun:"acknowledged_by"`
	NotificationSent bool            `bun:"notification_sent,default:false"`
	CreatedAt        time.Time       `bun:"created_at,nullzero,notnull,default:current_timestamp"`
}

// AlertHistoryFilter defines filter criteria for alert history queries
type AlertHistoryFilter struct {
	UserID          *uuid.UUID `json:"user_id,omitempty"`
	AlertID         *uuid.UUID `json:"alert_id,omitempty"`
	AssetID         *uuid.UUID `json:"asset_id,omitempty"`
	PortfolioID     *uuid.UUID `json:"portfolio_id,omitempty"`
	AlertType       *AlertType `json:"alert_type,omitempty"`
	Acknowledged    *bool      `json:"acknowledged,omitempty"`
	TriggeredAfter  *time.Time `json:"triggered_after,omitempty"`
	TriggeredBefore *time.Time `json:"triggered_before,omitempty"`
	Limit           *int       `json:"limit,omitempty"`
	Offset          *int       `json:"offset,omitempty"`
}

// IAlertHistoryRepository defines the interface for alert history repository operations
type IAlertHistoryRepository interface {
	IRepository[AlertHistory]

	// Enhanced CRUD operations
	GetByUUID(ctx context.Context, id uuid.UUID) (*AlertHistory, error)
	FindWithFilters(ctx context.Context, filter AlertHistoryFilter) ([]AlertHistory, error)
	CountWithFilters(ctx context.Context, filter AlertHistoryFilter) (int, error)

	// User-specific queries
	GetUserAlertHistory(ctx context.Context, userID uuid.UUID, limit, offset int) ([]AlertHistory, error)
	GetUnacknowledgedAlerts(ctx context.Context, userID uuid.UUID) ([]AlertHistory, error)
	GetRecentAlerts(ctx context.Context, userID uuid.UUID, since time.Time) ([]AlertHistory, error)

	// Alert-specific queries
	GetAlertTriggerHistory(ctx context.Context, alertID uuid.UUID) ([]AlertHistory, error)
	GetAssetAlertHistory(ctx context.Context, assetID uuid.UUID, limit int) ([]AlertHistory, error)
	GetPortfolioAlertHistory(ctx context.Context, portfolioID uuid.UUID, limit int) ([]AlertHistory, error)

	// Acknowledgment operations
	AcknowledgeAlert(ctx context.Context, historyID uuid.UUID, acknowledgedBy uuid.UUID) error
	AcknowledgeMultipleAlerts(ctx context.Context, historyIDs []uuid.UUID, acknowledgedBy uuid.UUID) error

	// Statistics and analytics
	GetAlertStatistics(ctx context.Context, userID uuid.UUID, start, end time.Time) (*AlertStatistics, error)
	GetMostTriggeredAlerts(ctx context.Context, userID uuid.UUID, limit int) ([]AlertTriggerSummary, error)

	// Cleanup operations
	DeleteOldHistory(ctx context.Context, olderThan time.Time) (int, error)
}

// AlertStatistics represents alert statistics for a user
type AlertStatistics struct {
	TotalTriggered      int                   `json:"total_triggered"`
	TotalAcknowledged   int                   `json:"total_acknowledged"`
	ByAlertType         map[AlertType]int     `json:"by_alert_type"`
	ByConditionType     map[ConditionType]int `json:"by_condition_type"`
	AverageResponseTime *time.Duration        `json:"average_response_time,omitempty"`
	MostActiveHours     []int                 `json:"most_active_hours"`
}

// AlertTriggerSummary represents a summary of alert triggers
type AlertTriggerSummary struct {
	AlertID       uuid.UUID  `json:"alert_id"`
	AlertType     AlertType  `json:"alert_type"`
	TriggerCount  int        `json:"trigger_count"`
	LastTriggered time.Time  `json:"last_triggered"`
	AssetID       *uuid.UUID `json:"asset_id,omitempty"`
	PortfolioID   *uuid.UUID `json:"portfolio_id,omitempty"`
}

// AlertHistoryRepository is the concrete implementation of IAlertHistoryRepository
type AlertHistoryRepository struct {
	*Repository[AlertHistory]
}

// NewAlertHistoryRepository creates a new AlertHistoryRepository
func NewAlertHistoryRepository(db bun.IDB) *AlertHistoryRepository {
	return &AlertHistoryRepository{
		Repository: NewRepository[AlertHistory](db),
	}
}

// GetByUUID retrieves an alert history record by its UUID
func (r *AlertHistoryRepository) GetByUUID(ctx context.Context, id uuid.UUID) (*AlertHistory, error) {
	var history AlertHistory
	err := r.db.NewSelect().
		Model(&history).
		Where("id = ?", id).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &history, nil
}

// FindWithFilters retrieves alert history with multiple filter criteria
func (r *AlertHistoryRepository) FindWithFilters(ctx context.Context, filter AlertHistoryFilter) ([]AlertHistory, error) {
	query := r.db.NewSelect().Model((*AlertHistory)(nil))

	// Apply filters
	query = r.applyHistoryFilters(query, filter)

	// Apply ordering - by triggered_at DESC for most recent first
	query = query.Order("triggered_at DESC")

	// Apply pagination
	if filter.Limit != nil && *filter.Limit > 0 {
		query = query.Limit(*filter.Limit)
	}
	if filter.Offset != nil && *filter.Offset > 0 {
		query = query.Offset(*filter.Offset)
	}

	var history []AlertHistory
	err := query.Scan(ctx, &history)
	return history, err
}

// CountWithFilters returns the count of alert history records matching the filter criteria
func (r *AlertHistoryRepository) CountWithFilters(ctx context.Context, filter AlertHistoryFilter) (int, error) {
	query := r.db.NewSelect().Model((*AlertHistory)(nil))
	query = r.applyHistoryFilters(query, filter)
	return query.Count(ctx)
}

// applyHistoryFilters applies filter criteria to a query
func (r *AlertHistoryRepository) applyHistoryFilters(query *bun.SelectQuery, filter AlertHistoryFilter) *bun.SelectQuery {
	if filter.UserID != nil {
		query = query.Where("user_id = ?", *filter.UserID)
	}

	if filter.AlertID != nil {
		query = query.Where("alert_id = ?", *filter.AlertID)
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

	if filter.Acknowledged != nil {
		if *filter.Acknowledged {
			query = query.Where("acknowledged_at IS NOT NULL")
		} else {
			query = query.Where("acknowledged_at IS NULL")
		}
	}

	if filter.TriggeredAfter != nil {
		query = query.Where("triggered_at > ?", *filter.TriggeredAfter)
	}

	if filter.TriggeredBefore != nil {
		query = query.Where("triggered_at < ?", *filter.TriggeredBefore)
	}

	return query
}

// GetUserAlertHistory retrieves alert history for a user with pagination
func (r *AlertHistoryRepository) GetUserAlertHistory(ctx context.Context, userID uuid.UUID, limit, offset int) ([]AlertHistory, error) {
	return r.FindWithFilters(ctx, AlertHistoryFilter{
		UserID: &userID,
		Limit:  &limit,
		Offset: &offset,
	})
}

// GetUnacknowledgedAlerts retrieves unacknowledged alerts for a user
func (r *AlertHistoryRepository) GetUnacknowledgedAlerts(ctx context.Context, userID uuid.UUID) ([]AlertHistory, error) {
	acknowledged := false
	return r.FindWithFilters(ctx, AlertHistoryFilter{
		UserID:       &userID,
		Acknowledged: &acknowledged,
	})
}

// GetRecentAlerts retrieves recent alerts for a user since a specific time
func (r *AlertHistoryRepository) GetRecentAlerts(ctx context.Context, userID uuid.UUID, since time.Time) ([]AlertHistory, error) {
	return r.FindWithFilters(ctx, AlertHistoryFilter{
		UserID:         &userID,
		TriggeredAfter: &since,
	})
}

// GetAlertTriggerHistory retrieves trigger history for a specific alert
func (r *AlertHistoryRepository) GetAlertTriggerHistory(ctx context.Context, alertID uuid.UUID) ([]AlertHistory, error) {
	return r.FindWithFilters(ctx, AlertHistoryFilter{
		AlertID: &alertID,
	})
}

// GetAssetAlertHistory retrieves alert history for a specific asset
func (r *AlertHistoryRepository) GetAssetAlertHistory(ctx context.Context, assetID uuid.UUID, limit int) ([]AlertHistory, error) {
	return r.FindWithFilters(ctx, AlertHistoryFilter{
		AssetID: &assetID,
		Limit:   &limit,
	})
}

// GetPortfolioAlertHistory retrieves alert history for a specific portfolio
func (r *AlertHistoryRepository) GetPortfolioAlertHistory(ctx context.Context, portfolioID uuid.UUID, limit int) ([]AlertHistory, error) {
	return r.FindWithFilters(ctx, AlertHistoryFilter{
		PortfolioID: &portfolioID,
		Limit:       &limit,
	})
}

// AcknowledgeAlert acknowledges a single alert
func (r *AlertHistoryRepository) AcknowledgeAlert(ctx context.Context, historyID uuid.UUID, acknowledgedBy uuid.UUID) error {
	now := time.Now()
	_, err := r.db.NewUpdate().
		Model((*AlertHistory)(nil)).
		Set("acknowledged_at = ?", now).
		Set("acknowledged_by = ?", acknowledgedBy).
		Where("id = ?", historyID).
		Where("acknowledged_at IS NULL"). // Only acknowledge if not already acknowledged
		Exec(ctx)

	return err
}

// AcknowledgeMultipleAlerts acknowledges multiple alerts
func (r *AlertHistoryRepository) AcknowledgeMultipleAlerts(ctx context.Context, historyIDs []uuid.UUID, acknowledgedBy uuid.UUID) error {
	if len(historyIDs) == 0 {
		return nil
	}

	now := time.Now()
	_, err := r.db.NewUpdate().
		Model((*AlertHistory)(nil)).
		Set("acknowledged_at = ?", now).
		Set("acknowledged_by = ?", acknowledgedBy).
		Where("id IN (?)", bun.In(historyIDs)).
		Where("acknowledged_at IS NULL"). // Only acknowledge if not already acknowledged
		Exec(ctx)

	return err
}

// GetAlertStatistics retrieves alert statistics for a user within a time range
func (r *AlertHistoryRepository) GetAlertStatistics(ctx context.Context, userID uuid.UUID, start, end time.Time) (*AlertStatistics, error) {
	// Get basic counts
	totalTriggered, err := r.db.NewSelect().
		Model((*AlertHistory)(nil)).
		Where("user_id = ?", userID).
		Where("triggered_at BETWEEN ? AND ?", start, end).
		Count(ctx)
	if err != nil {
		return nil, err
	}

	totalAcknowledged, err := r.db.NewSelect().
		Model((*AlertHistory)(nil)).
		Where("user_id = ?", userID).
		Where("triggered_at BETWEEN ? AND ?", start, end).
		Where("acknowledged_at IS NOT NULL").
		Count(ctx)
	if err != nil {
		return nil, err
	}

	// Get counts by alert type
	var alertTypeCounts []struct {
		AlertType AlertType `bun:"alert_type"`
		Count     int       `bun:"count"`
	}
	err = r.db.NewSelect().
		Model((*AlertHistory)(nil)).
		Column("alert_type").
		ColumnExpr("COUNT(*) as count").
		Where("user_id = ?", userID).
		Where("triggered_at BETWEEN ? AND ?", start, end).
		Group("alert_type").
		Scan(ctx, &alertTypeCounts)
	if err != nil {
		return nil, err
	}

	byAlertType := make(map[AlertType]int)
	for _, count := range alertTypeCounts {
		byAlertType[count.AlertType] = count.Count
	}

	// Get counts by condition type
	var conditionTypeCounts []struct {
		ConditionType ConditionType `bun:"condition_type"`
		Count         int           `bun:"count"`
	}
	err = r.db.NewSelect().
		Model((*AlertHistory)(nil)).
		Column("condition_type").
		ColumnExpr("COUNT(*) as count").
		Where("user_id = ?", userID).
		Where("triggered_at BETWEEN ? AND ?", start, end).
		Group("condition_type").
		Scan(ctx, &conditionTypeCounts)
	if err != nil {
		return nil, err
	}

	byConditionType := make(map[ConditionType]int)
	for _, count := range conditionTypeCounts {
		byConditionType[count.ConditionType] = count.Count
	}

	return &AlertStatistics{
		TotalTriggered:    totalTriggered,
		TotalAcknowledged: totalAcknowledged,
		ByAlertType:       byAlertType,
		ByConditionType:   byConditionType,
	}, nil
}

// GetMostTriggeredAlerts retrieves the most frequently triggered alerts
func (r *AlertHistoryRepository) GetMostTriggeredAlerts(ctx context.Context, userID uuid.UUID, limit int) ([]AlertTriggerSummary, error) {
	var summaries []AlertTriggerSummary
	err := r.db.NewSelect().
		Model((*AlertHistory)(nil)).
		Column("alert_id", "alert_type", "asset_id", "portfolio_id").
		ColumnExpr("COUNT(*) as trigger_count").
		ColumnExpr("MAX(triggered_at) as last_triggered").
		Where("user_id = ?", userID).
		Group("alert_id", "alert_type", "asset_id", "portfolio_id").
		Order("trigger_count DESC").
		Limit(limit).
		Scan(ctx, &summaries)

	return summaries, err
}

// DeleteOldHistory deletes alert history records older than the specified time
func (r *AlertHistoryRepository) DeleteOldHistory(ctx context.Context, olderThan time.Time) (int, error) {
	result, err := r.db.NewDelete().
		Model((*AlertHistory)(nil)).
		Where("triggered_at < ?", olderThan).
		Exec(ctx)
	if err != nil {
		return 0, err
	}

	rowsAffected, err := result.RowsAffected()
	return int(rowsAffected), err
}
