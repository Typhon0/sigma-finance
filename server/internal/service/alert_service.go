package service

import (
	"context"
	"errors"
	"fmt"
	"sigma_finance/internal/repository"
	"time"

	"github.com/shopspring/decimal"
)

// AlertService provides business logic for alert management operations
type AlertService struct {
	alertRepo           repository.IAlertRepository
	assetRepo           repository.IAssetRepository
	portfolioRepo       repository.IPortfolioRepository
	priceRepo           repository.IPriceRepository
	performanceRepo     repository.IPerformanceRepository
	notificationService INotificationService
}

// NewAlertService creates a new AlertService instance
func NewAlertService(
	alertRepo repository.IAlertRepository,
	assetRepo repository.IAssetRepository,
	portfolioRepo repository.IPortfolioRepository,
	priceRepo repository.IPriceRepository,
	performanceRepo repository.IPerformanceRepository,
	notificationService INotificationService,
) *AlertService {
	return &AlertService{
		alertRepo:           alertRepo,
		assetRepo:           assetRepo,
		portfolioRepo:       portfolioRepo,
		priceRepo:           priceRepo,
		performanceRepo:     performanceRepo,
		notificationService: notificationService,
	}
}

// IAlertService defines the interface for alert management operations
type IAlertService interface {
	// Alert CRUD operations
	CreateAlert(ctx context.Context, req CreateAlertRequest) (*repository.UserAlert, error)
	GetAlert(ctx context.Context, id string) (*repository.UserAlert, error)
	UpdateAlert(ctx context.Context, id string, req UpdateAlertRequest) (*repository.UserAlert, error)
	DeleteAlert(ctx context.Context, id string) error

	// Alert management
	GetUserAlerts(ctx context.Context, userID string) ([]*repository.UserAlert, error)
	GetActiveUserAlerts(ctx context.Context, userID string) ([]*repository.UserAlert, error)
	ActivateAlert(ctx context.Context, alertID string) error
	DeactivateAlert(ctx context.Context, alertID string) error

	// Alert processing and evaluation
	ProcessAlerts(ctx context.Context) error
	EvaluateAssetAlerts(ctx context.Context, assetID string, currentPrice decimal.Decimal) ([]repository.AlertTriggerEvent, error)
	EvaluatePortfolioAlerts(ctx context.Context, portfolioID string) ([]repository.AlertTriggerEvent, error)
	TriggerAlert(ctx context.Context, event repository.AlertTriggerEvent) error

	// Alert validation
	ValidateAlertThreshold(ctx context.Context, alertType repository.AlertType, conditionType repository.ConditionType, thresholdValue *decimal.Decimal, thresholdPercentage *decimal.Decimal) error
	ValidateAlertConfiguration(ctx context.Context, req CreateAlertRequest) error

	// Alert history and acknowledgment
	AcknowledgeAlert(ctx context.Context, alertID string, userID string) error
	GetAlertHistory(ctx context.Context, userID string, filter AlertHistoryFilter) ([]*AlertHistoryEntry, error)
	GetTriggeredAlerts(ctx context.Context, userID string, since time.Time) ([]*AlertHistoryEntry, error)

	// Batch operations
	CreateBatchAlerts(ctx context.Context, alerts []CreateAlertRequest) ([]*repository.UserAlert, error)
	DeactivateBatchAlerts(ctx context.Context, alertIDs []string) error
}

// Request/Response structures

type CreateAlertRequest struct {
	UserID              string                    `json:"user_id" validate:"required"`
	AssetID             *string                   `json:"asset_id,omitempty"`
	PortfolioID         *string                   `json:"portfolio_id,omitempty"`
	AlertType           repository.AlertType      `json:"alert_type" validate:"required"`
	ConditionType       repository.ConditionType  `json:"condition_type" validate:"required"`
	ThresholdValue      *decimal.Decimal          `json:"threshold_value,omitempty"`
	ThresholdPercentage *decimal.Decimal          `json:"threshold_percentage,omitempty"`
	NotificationMethods []AlertNotificationMethod `json:"notification_methods,omitempty"`
}

type UpdateAlertRequest struct {
	AlertType           *repository.AlertType     `json:"alert_type,omitempty"`
	ConditionType       *repository.ConditionType `json:"condition_type,omitempty"`
	ThresholdValue      *decimal.Decimal          `json:"threshold_value,omitempty"`
	ThresholdPercentage *decimal.Decimal          `json:"threshold_percentage,omitempty"`
	IsActive            *bool                     `json:"is_active,omitempty"`
	NotificationMethods []AlertNotificationMethod `json:"notification_methods,omitempty"`
}

type AlertHistoryFilter struct {
	AlertType       *repository.AlertType `json:"alert_type,omitempty"`
	AssetID         *string               `json:"asset_id,omitempty"`
	PortfolioID     *string               `json:"portfolio_id,omitempty"`
	TriggeredAfter  *time.Time            `json:"triggered_after,omitempty"`
	TriggeredBefore *time.Time            `json:"triggered_before,omitempty"`
	Acknowledged    *bool                 `json:"acknowledged,omitempty"`
	Limit           *int                  `json:"limit,omitempty"`
	Offset          *int                  `json:"offset,omitempty"`
}

type AlertHistoryEntry struct {
	AlertID          string                   `json:"alert_id"`
	UserID           string                   `json:"user_id"`
	AssetID          *string                  `json:"asset_id,omitempty"`
	PortfolioID      *string                  `json:"portfolio_id,omitempty"`
	AlertType        repository.AlertType     `json:"alert_type"`
	ConditionType    repository.ConditionType `json:"condition_type"`
	CurrentValue     decimal.Decimal          `json:"current_value"`
	ThresholdValue   decimal.Decimal          `json:"threshold_value"`
	TriggeredAt      time.Time                `json:"triggered_at"`
	AcknowledgedAt   *time.Time               `json:"acknowledged_at,omitempty"`
	Message          string                   `json:"message"`
	NotificationSent bool                     `json:"notification_sent"`
}

type AlertNotificationMethod string

const (
	NotificationMethodEmail   AlertNotificationMethod = "EMAIL"
	NotificationMethodPush    AlertNotificationMethod = "PUSH"
	NotificationMethodInApp   AlertNotificationMethod = "IN_APP"
	NotificationMethodWebhook AlertNotificationMethod = "WEBHOOK"
)

// Error definitions
var (
	ErrAlertNotFound             = errors.New("alert not found")
	ErrInvalidAlertType          = errors.New("invalid alert type")
	ErrInvalidConditionType      = errors.New("invalid condition type")
	ErrInvalidThreshold          = errors.New("invalid threshold value")
	ErrMissingThreshold          = errors.New("threshold value is required")
	ErrAssetNotFound             = errors.New("asset not found")
	ErrAlertPortfolioNotFound    = errors.New("portfolio not found")
	ErrUnauthorizedAccess        = errors.New("unauthorized access to alert")
	ErrAlertAlreadyAcknowledged  = errors.New("alert already acknowledged")
	ErrInvalidAlertConfiguration = errors.New("invalid alert configuration")
)

// CreateAlert creates a new alert with validation
func (s *AlertService) CreateAlert(ctx context.Context, req CreateAlertRequest) (*repository.UserAlert, error) {
	// Validate the alert configuration
	if err := s.validateAlertConfiguration(ctx, req); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Validate threshold values
	if err := s.validateAlertThreshold(ctx, req.AlertType, req.ConditionType, req.ThresholdValue, req.ThresholdPercentage); err != nil {
		return nil, fmt.Errorf("threshold validation failed: %w", err)
	}

	// Create the alert
	alert := repository.UserAlert{
		UserID:              req.UserID,
		AssetID:             req.AssetID,
		PortfolioID:         req.PortfolioID,
		AlertType:           req.AlertType,
		ConditionType:       req.ConditionType,
		ThresholdValue:      req.ThresholdValue,
		ThresholdPercentage: req.ThresholdPercentage,
		IsActive:            true,
		CreatedAt:           time.Now(),
	}

	createdAlert, err := s.alertRepo.Create(ctx, &alert)
	if err != nil {
		return nil, fmt.Errorf("failed to create alert: %w", err)
	}

	return createdAlert, nil
}

// GetAlert retrieves an alert by ID
func (s *AlertService) GetAlert(ctx context.Context, id string) (*repository.UserAlert, error) {
	alert, err := s.alertRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert: %w", err)
	}
	return alert, nil
}

// UpdateAlert updates an existing alert
func (s *AlertService) UpdateAlert(ctx context.Context, id string, req UpdateAlertRequest) (*repository.UserAlert, error) {
	// Get existing alert
	existingAlert, err := s.alertRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get existing alert: %w", err)
	}

	// Update fields if provided
	if req.AlertType != nil {
		existingAlert.AlertType = *req.AlertType
	}
	if req.ConditionType != nil {
		existingAlert.ConditionType = *req.ConditionType
	}
	if req.ThresholdValue != nil {
		existingAlert.ThresholdValue = req.ThresholdValue
	}
	if req.ThresholdPercentage != nil {
		existingAlert.ThresholdPercentage = req.ThresholdPercentage
	}
	if req.IsActive != nil {
		existingAlert.IsActive = *req.IsActive
	}

	// Validate updated threshold values
	if err := s.validateAlertThreshold(ctx, existingAlert.AlertType, existingAlert.ConditionType, existingAlert.ThresholdValue, existingAlert.ThresholdPercentage); err != nil {
		return nil, fmt.Errorf("threshold validation failed: %w", err)
	}

	err = s.alertRepo.Update(ctx, existingAlert)
	if err != nil {
		return nil, fmt.Errorf("failed to update alert: %w", err)
	}

	return existingAlert, nil
}

// DeleteAlert deletes an alert
func (s *AlertService) DeleteAlert(ctx context.Context, id string) error {
	err := s.alertRepo.Delete(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to delete alert: %w", err)
	}
	return nil
}

// GetUserAlerts retrieves all alerts for a user
func (s *AlertService) GetUserAlerts(ctx context.Context, userID string) ([]*repository.UserAlert, error) {
	alerts, err := s.alertRepo.GetUserAlerts(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user alerts: %w", err)
	}

	// Convert to pointer slice
	result := make([]*repository.UserAlert, len(alerts))
	for i := range alerts {
		result[i] = &alerts[i]
	}

	return result, nil
}

// GetActiveUserAlerts retrieves all active alerts for a user
func (s *AlertService) GetActiveUserAlerts(ctx context.Context, userID string) ([]*repository.UserAlert, error) {
	alerts, err := s.alertRepo.GetActiveUserAlerts(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get active user alerts: %w", err)
	}

	// Convert to pointer slice
	result := make([]*repository.UserAlert, len(alerts))
	for i := range alerts {
		result[i] = &alerts[i]
	}

	return result, nil
}

// ActivateAlert activates an alert
func (s *AlertService) ActivateAlert(ctx context.Context, alertID string) error {
	alert, err := s.alertRepo.GetByID(ctx, alertID)
	if err != nil {
		return fmt.Errorf("failed to get alert: %w", err)
	}

	alert.IsActive = true
	err = s.alertRepo.Update(ctx, alert)
	if err != nil {
		return fmt.Errorf("failed to activate alert: %w", err)
	}

	return nil
}

// DeactivateAlert deactivates an alert
func (s *AlertService) DeactivateAlert(ctx context.Context, alertID string) error {
	err := s.alertRepo.DeactivateAlert(ctx, alertID)
	if err != nil {
		return fmt.Errorf("failed to deactivate alert: %w", err)
	}
	return nil
}

// validateAlertConfiguration validates the alert configuration
func (s *AlertService) validateAlertConfiguration(ctx context.Context, req CreateAlertRequest) error {
	// Validate user exists (if needed)
	if req.UserID == "" {
		return errors.New("user ID is required")
	}

	// Validate asset exists if asset alert
	if req.AssetID != nil && *req.AssetID != "" {
		_, err := s.assetRepo.GetByID(ctx, *req.AssetID)
		if err != nil {
			return fmt.Errorf("asset not found: %w", err)
		}
	}

	// TODO: Fix data model inconsistency - Portfolio uses uint ID but UserAlert expects uuid.UUID
	// Validate portfolio exists if portfolio alert
	// if req.PortfolioID != nil && *req.PortfolioID != uuid.Nil {
	//     _, err := s.portfolioRepo.GetByID(ctx, *req.PortfolioID)
	//     if err != nil {
	//         return fmt.Errorf("portfolio not found: %w", err)
	//     }
	// }

	// Validate alert type and condition type combination
	if err := s.validateAlertTypeConditionCombination(req.AlertType, req.ConditionType); err != nil {
		return err
	}

	return nil
}

// validateAlertThreshold validates threshold values for alerts
func (s *AlertService) validateAlertThreshold(ctx context.Context, alertType repository.AlertType, conditionType repository.ConditionType, thresholdValue *decimal.Decimal, thresholdPercentage *decimal.Decimal) error {
	// At least one threshold must be provided
	if thresholdValue == nil && thresholdPercentage == nil {
		return errors.New("at least one threshold value must be provided")
	}

	// Validate threshold value ranges
	if thresholdValue != nil {
		if thresholdValue.IsNegative() {
			return errors.New("threshold value cannot be negative")
		}
	}

	// Validate percentage ranges
	if thresholdPercentage != nil {
		if thresholdPercentage.LessThan(decimal.NewFromFloat(-100)) || thresholdPercentage.GreaterThan(decimal.NewFromFloat(1000)) {
			return errors.New("threshold percentage must be between -100% and 1000%")
		}
	}

	// Validate specific combinations
	switch alertType {
	case repository.AlertTypePrice:
		if thresholdValue == nil {
			return errors.New("price alerts require a value threshold")
		}
	case repository.AlertTypePercentageChange:
		if thresholdPercentage == nil {
			return errors.New("percentage change alerts require a percentage threshold")
		}
	case repository.AlertTypePortfolioValue:
		if thresholdValue == nil {
			return errors.New("portfolio value alerts require a value threshold")
		}
	case repository.AlertTypeAllocation:
		if thresholdPercentage == nil {
			return errors.New("allocation alerts require a percentage threshold")
		}
	}

	return nil
}

// validateAlertTypeConditionCombination validates alert type and condition type combinations
func (s *AlertService) validateAlertTypeConditionCombination(alertType repository.AlertType, conditionType repository.ConditionType) error {
	validCombinations := map[repository.AlertType][]repository.ConditionType{
		repository.AlertTypePrice: {
			repository.ConditionTypeAbove,
			repository.ConditionTypeBelow,
		},
		repository.AlertTypePercentageChange: {
			repository.ConditionTypeAbove,
			repository.ConditionTypeBelow,
		},
		repository.AlertTypePortfolioValue: {
			repository.ConditionTypeAbove,
			repository.ConditionTypeBelow,
		},
		repository.AlertTypeAllocation: {
			repository.ConditionTypeAbove,
			repository.ConditionTypeBelow,
		},
	}

	validConditions, exists := validCombinations[alertType]
	if !exists {
		return fmt.Errorf("unsupported alert type: %s", alertType)
	}

	for _, validCondition := range validConditions {
		if conditionType == validCondition {
			return nil
		}
	}

	return fmt.Errorf("invalid condition type %s for alert type %s", conditionType, alertType)
}

// AcknowledgeAlert acknowledges an alert
func (s *AlertService) AcknowledgeAlert(ctx context.Context, alertID string, userID string) error {
	// TODO: Implement proper acknowledgment logic
	// For now, just mark as acknowledged in the alert history
	err := s.alertRepo.DeactivateAlert(ctx, alertID)
	if err != nil {
		return fmt.Errorf("failed to acknowledge alert: %w", err)
	}
	return nil
}

// GetAlertHistory retrieves alert history for a user
func (s *AlertService) GetAlertHistory(ctx context.Context, userID string, filter AlertHistoryFilter) ([]*AlertHistoryEntry, error) {
	// TODO: Implement proper alert history retrieval
	// For now, return empty slice
	return []*AlertHistoryEntry{}, nil
}

// GetTriggeredAlerts retrieves triggered alerts for a user since a specific time
func (s *AlertService) GetTriggeredAlerts(ctx context.Context, userID string, since time.Time) ([]*AlertHistoryEntry, error) {
	// TODO: Implement proper triggered alerts retrieval
	// For now, return empty slice
	return []*AlertHistoryEntry{}, nil
}

// CreateBatchAlerts creates multiple alerts in a batch
func (s *AlertService) CreateBatchAlerts(ctx context.Context, alerts []CreateAlertRequest) ([]*repository.UserAlert, error) {
	result := make([]*repository.UserAlert, 0, len(alerts))

	for _, alertReq := range alerts {
		alert, err := s.CreateAlert(ctx, alertReq)
		if err != nil {
			return nil, fmt.Errorf("failed to create alert in batch: %w", err)
		}
		result = append(result, alert)
	}

	return result, nil
}

// DeactivateBatchAlerts deactivates multiple alerts in a batch
func (s *AlertService) DeactivateBatchAlerts(ctx context.Context, alertIDs []string) error {
	for _, alertID := range alertIDs {
		err := s.DeactivateAlert(ctx, alertID)
		if err != nil {
			return fmt.Errorf("failed to deactivate alert %s in batch: %w", alertID, err)
		}
	}
	return nil
}

// ProcessAlerts processes all active alerts
func (s *AlertService) ProcessAlerts(ctx context.Context) error {
	// 1. Get all active alerts
	alerts, err := s.alertRepo.GetAlertsToProcess(ctx, []repository.AlertType{
		repository.AlertTypePrice,
		repository.AlertTypePercentageChange,
		repository.AlertTypePortfolioValue,
	})
	if err != nil {
		return fmt.Errorf("failed to get alerts to process: %w", err)
	}

	for _, alert := range alerts {
		// Group by alert type to determine how to process
		if alert.AssetID != nil && (alert.AlertType == repository.AlertTypePrice || alert.AlertType == repository.AlertTypePercentageChange) {
			// Get current price of asset
			priceInfo, err := s.priceRepo.GetLatestPrice(ctx, *alert.AssetID)
			if err != nil {
				// Log but continue to next alert
				fmt.Printf("Warning: failed to get latest price for asset %s: %v\n", *alert.AssetID, err)
				continue
			}

			var events []repository.AlertTriggerEvent
			var evalErr error

			if alert.AlertType == repository.AlertTypePrice {
				events, evalErr = s.alertRepo.EvaluatePriceAlerts(ctx, *alert.AssetID, priceInfo.Price)
			} else if alert.AlertType == repository.AlertTypePercentageChange {
				// Assuming we have some daily change or similar calculation
				// For now, this requires historical data comparison which might be handled differently,
				// but we'll try to get it if the method exists. We pass a 0 percentage change for now to prevent panic
				// until real percentage calculation logic is present.
				events, evalErr = s.alertRepo.EvaluatePercentageChangeAlerts(ctx, *alert.AssetID, decimal.Zero)
			}

			if evalErr != nil {
				fmt.Printf("Error evaluating alert %s: %v\n", alert.ID, evalErr)
				continue
			}

			for _, event := range events {
				// Only trigger if this specific alert matched
				if event.AlertID == alert.ID {
					_ = s.TriggerAlert(ctx, event)
				}
			}

		} else if alert.PortfolioID != nil && alert.AlertType == repository.AlertTypePortfolioValue {
			// Calculate current portfolio value using performance service methods or similar
			// Here we assume there's a quick way to sum the portfolio value
			// Using placeholder value zero for now until full portfolio calc is integrated
			var events []repository.AlertTriggerEvent
			var evalErr error

			events, evalErr = s.alertRepo.EvaluatePortfolioValueAlerts(ctx, *alert.PortfolioID, decimal.Zero)
			if evalErr != nil {
				fmt.Printf("Error evaluating portfolio alert %s: %v\n", alert.ID, evalErr)
				continue
			}

			for _, event := range events {
				if event.AlertID == alert.ID {
					_ = s.TriggerAlert(ctx, event)
				}
			}
		}
	}

	return nil
}

// EvaluateAssetAlerts evaluates alerts for a specific asset
func (s *AlertService) EvaluateAssetAlerts(ctx context.Context, assetID string, currentPrice decimal.Decimal) ([]repository.AlertTriggerEvent, error) {
	return s.alertRepo.EvaluatePriceAlerts(ctx, assetID, currentPrice)
}

// EvaluatePortfolioAlerts evaluates alerts for a specific portfolio
func (s *AlertService) EvaluatePortfolioAlerts(ctx context.Context, portfolioID string) ([]repository.AlertTriggerEvent, error) {
	// TODO: Replace with real portfolio value calculation when accessible here
	currentValue := decimal.Zero
	return s.alertRepo.EvaluatePortfolioValueAlerts(ctx, portfolioID, currentValue)
}

// TriggerAlert triggers an alert event
func (s *AlertService) TriggerAlert(ctx context.Context, event repository.AlertTriggerEvent) error {
	// 1. Get user's notification preferences to determine delivery methods
	prefs, err := s.notificationService.GetUserNotificationPreferences(ctx, event.UserID)
	if err != nil {
		prefs = nil // Use default methods if preferences unavailable
	}

	// 2. Determine which notification methods to use
	methods := s.getNotificationMethodsForAlert(event.AlertType, prefs)

	// 3. Send notifications through the notification service
	if err := s.notificationService.SendAlertNotification(ctx, event, methods); err != nil {
		fmt.Printf("Warning: failed to send notifications for alert %s: %v\n", event.AlertID, err)
	}

	// 4. Log alert history entry
	historyEntry := AlertHistoryEntry{
		AlertID:          event.AlertID,
		UserID:           event.UserID,
		AssetID:          event.AssetID,
		PortfolioID:      event.PortfolioID,
		AlertType:        event.AlertType,
		ConditionType:    event.ConditionType,
		CurrentValue:     event.CurrentValue,
		ThresholdValue:   event.ThresholdValue,
		Message:          event.Message,
		TriggeredAt:      event.TriggeredAt,
		NotificationSent: true,
	}

	// 5. Log it out (since History repo isn't fully implemented per CODEBASE_ISSUES.md)
	fmt.Printf("ALERT TRIGGERED: [%s] %s\n", historyEntry.AlertType, historyEntry.Message)

	// 6. Update the alert's last triggered timestamp
	err = s.alertRepo.UpdateLastTriggered(ctx, event.AlertID, event.TriggeredAt)
	if err != nil {
		fmt.Printf("Warning: failed to update last triggered time for alert %s: %v\n", event.AlertID, err)
	}

	return nil
}

func (s *AlertService) getNotificationMethodsForAlert(alertType repository.AlertType, prefs *NotificationPreferences) []AlertNotificationMethod {
	if prefs != nil && prefs.AlertTypePreferences != nil {
		if methods, ok := prefs.AlertTypePreferences[alertType]; ok && len(methods) > 0 {
			return methods
		}
	}

	// Default methods by alert type
	switch alertType {
	case repository.AlertTypePrice:
		return []AlertNotificationMethod{NotificationMethodEmail, NotificationMethodInApp}
	case repository.AlertTypePercentageChange:
		return []AlertNotificationMethod{NotificationMethodInApp, NotificationMethodPush}
	case repository.AlertTypePortfolioValue:
		return []AlertNotificationMethod{NotificationMethodEmail}
	case repository.AlertTypeAllocation:
		return []AlertNotificationMethod{NotificationMethodEmail}
	default:
		return []AlertNotificationMethod{NotificationMethodEmail, NotificationMethodInApp}
	}
}

// ValidateAlertThreshold validates alert threshold values
func (s *AlertService) ValidateAlertThreshold(ctx context.Context, alertType repository.AlertType, conditionType repository.ConditionType, thresholdValue *decimal.Decimal, thresholdPercentage *decimal.Decimal) error {
	return s.validateAlertThreshold(ctx, alertType, conditionType, thresholdValue, thresholdPercentage)
}

// ValidateAlertConfiguration validates alert configuration
func (s *AlertService) ValidateAlertConfiguration(ctx context.Context, req CreateAlertRequest) error {
	return s.validateAlertConfiguration(ctx, req)
}
