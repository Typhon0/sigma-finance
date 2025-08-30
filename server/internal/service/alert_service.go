package service

import (
	"context"
	"errors"
	"fmt"
	"sigma_finance/internal/repository"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// AlertService provides business logic for alert management operations
type AlertService struct {
	alertRepo       repository.IAlertRepository
	assetRepo       repository.IAssetRepository
	portfolioRepo   repository.IPortfolioRepository
	priceRepo       repository.IPriceRepository
	performanceRepo repository.IPerformanceRepository
}

// NewAlertService creates a new AlertService instance
func NewAlertService(
	alertRepo repository.IAlertRepository,
	assetRepo repository.IAssetRepository,
	portfolioRepo repository.IPortfolioRepository,
	priceRepo repository.IPriceRepository,
	performanceRepo repository.IPerformanceRepository,
) *AlertService {
	return &AlertService{
		alertRepo:       alertRepo,
		assetRepo:       assetRepo,
		portfolioRepo:   portfolioRepo,
		priceRepo:       priceRepo,
		performanceRepo: performanceRepo,
	}
}

// IAlertService defines the interface for alert management operations
type IAlertService interface {
	// Alert CRUD operations
	CreateAlert(ctx context.Context, req CreateAlertRequest) (*repository.UserAlert, error)
	GetAlert(ctx context.Context, id uuid.UUID) (*repository.UserAlert, error)
	UpdateAlert(ctx context.Context, id uuid.UUID, req UpdateAlertRequest) (*repository.UserAlert, error)
	DeleteAlert(ctx context.Context, id uuid.UUID) error

	// Alert management
	GetUserAlerts(ctx context.Context, userID uuid.UUID) ([]*repository.UserAlert, error)
	GetActiveUserAlerts(ctx context.Context, userID uuid.UUID) ([]*repository.UserAlert, error)
	ActivateAlert(ctx context.Context, alertID uuid.UUID) error
	DeactivateAlert(ctx context.Context, alertID uuid.UUID) error

	// Alert processing and evaluation
	ProcessAlerts(ctx context.Context) error
	EvaluateAssetAlerts(ctx context.Context, assetID uuid.UUID, currentPrice decimal.Decimal) ([]repository.AlertTriggerEvent, error)
	EvaluatePortfolioAlerts(ctx context.Context, portfolioID uuid.UUID) ([]repository.AlertTriggerEvent, error)
	TriggerAlert(ctx context.Context, event repository.AlertTriggerEvent) error

	// Alert validation
	ValidateAlertThreshold(ctx context.Context, alertType repository.AlertType, conditionType repository.ConditionType, thresholdValue *decimal.Decimal, thresholdPercentage *decimal.Decimal) error
	ValidateAlertConfiguration(ctx context.Context, req CreateAlertRequest) error

	// Alert history and acknowledgment
	AcknowledgeAlert(ctx context.Context, alertID uuid.UUID, userID uuid.UUID) error
	GetAlertHistory(ctx context.Context, userID uuid.UUID, filter AlertHistoryFilter) ([]*AlertHistoryEntry, error)
	GetTriggeredAlerts(ctx context.Context, userID uuid.UUID, since time.Time) ([]*AlertHistoryEntry, error)

	// Batch operations
	CreateBatchAlerts(ctx context.Context, alerts []CreateAlertRequest) ([]*repository.UserAlert, error)
	DeactivateBatchAlerts(ctx context.Context, alertIDs []uuid.UUID) error
}

// Request/Response structures

type CreateAlertRequest struct {
	UserID              uuid.UUID                 `json:"user_id" validate:"required"`
	AssetID             *uuid.UUID                `json:"asset_id,omitempty"`
	PortfolioID         *uuid.UUID                `json:"portfolio_id,omitempty"`
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
	AssetID         *uuid.UUID            `json:"asset_id,omitempty"`
	PortfolioID     *uuid.UUID            `json:"portfolio_id,omitempty"`
	TriggeredAfter  *time.Time            `json:"triggered_after,omitempty"`
	TriggeredBefore *time.Time            `json:"triggered_before,omitempty"`
	Acknowledged    *bool                 `json:"acknowledged,omitempty"`
	Limit           *int                  `json:"limit,omitempty"`
	Offset          *int                  `json:"offset,omitempty"`
}

type AlertHistoryEntry struct {
	AlertID          uuid.UUID                `json:"alert_id"`
	UserID           uuid.UUID                `json:"user_id"`
	AssetID          *uuid.UUID               `json:"asset_id,omitempty"`
	PortfolioID      *uuid.UUID               `json:"portfolio_id,omitempty"`
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
	ErrPortfolioNotFound         = errors.New("portfolio not found")
	ErrUnauthorizedAccess        = errors.New("unauthorized access to alert")
	ErrAlertAlreadyAcknowledged  = errors.New("alert already acknowledged")
	ErrInvalidAlertConfiguration = errors.New("invalid alert configuration")
)

// CreateAlert creates a new alert with validation
func (s *AlertService) CreateAlert(ctx context.Context, req CreateAlertRequest) (*repository.UserAlert, error) {
	// Validate the alert configuration
	if err := s.ValidateAlertConfiguration(ctx, req); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Validate threshold values
	if err := s.ValidateAlertThreshold(ctx, req.AlertType, req.ConditionType, req.ThresholdValue, req.ThresholdPercentage); err != nil {
		return nil, fmt.Errorf("threshold validation failed: %w", err)
	}

	// Create the alert
	alert := repository.UserAlert{
		ID:                  uuid.New(),
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

	createdAlert, err := s.alertRepo.Create(ctx, alert)
	if err != nil {
		return nil, fmt.Errorf("failed to create alert: %w", err)
	}

	return createdAlert, nil
}

// GetAlert retrieves an alert by ID
func (s *AlertService) GetAlert(ctx context.Context, id uuid.UUID) (*repository.UserAlert, error) {
	alert, err := s.alertRepo.GetByUUID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert: %w", err)
	}
	return alert, nil
}

// UpdateAlert updates an existing alert
func (s *AlertService) UpdateAlert(ctx context.Context, id uuid.UUID, req UpdateAlertRequest) (*repository.UserAlert, error) {
	// Get existing alert
	existingAlert, err := s.alertRepo.GetByUUID(ctx, id)
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
	if err := s.ValidateAlertThreshold(ctx, existingAlert.AlertType, existingAlert.ConditionType, existingAlert.ThresholdValue, existingAlert.ThresholdPercentage); err != nil {
		return nil, fmt.Errorf("threshold validation failed: %w", err)
	}

	updatedAlert, err := s.alertRepo.Update(ctx, *existingAlert)
	if err != nil {
		return nil, fmt.Errorf("failed to update alert: %w", err)
	}

	return updatedAlert, nil
}

// DeleteAlert deletes an alert
func (s *AlertService) DeleteAlert(ctx context.Context, id uuid.UUID) error {
	err := s.alertRepo.Delete(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to delete alert: %w", err)
	}
	return nil
}

// GetUserAlerts retrieves all alerts for a user
func (s *AlertService) GetUserAlerts(ctx context.Context, userID uuid.UUID) ([]*repository.UserAlert, error) {
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
func (s *AlertService) GetActiveUserAlerts(ctx context.Context, userID uuid.UUID) ([]*repository.UserAlert, error) {
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
func (s *AlertService) ActivateAlert(ctx context.Context, alertID uuid.UUID) error {
	alert, err := s.alertRepo.GetByUUID(ctx, alertID)
	if err != nil {
		return fmt.Errorf("failed to get alert: %w", err)
	}

	alert.IsActive = true
	_, err = s.alertRepo.Update(ctx, *alert)
	if err != nil {
		return fmt.Errorf("failed to activate alert: %w", err)
	}

	return nil
}

// DeactivateAlert deactivates an alert
func (s *AlertService) DeactivateAlert(ctx context.Context, alertID uuid.UUID) error {
	err := s.alertRepo.DeactivateAlert(ctx, alertID)
	if err != nil {
		return fmt.Errorf("failed to deactivate alert: %w", err)
	}
	return nil
}
