package service

import (
	"context"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
)

// AlertService defines the interface for alert-related business logic.
type AlertService interface {
	GetAlertsByUserID(ctx context.Context, userID uint) ([]model.Alert, error)
}

// alertService is the implementation of AlertService.
type alertService struct {
	alertRepo repository.AlertRepository
}

// NewAlertService creates a new AlertService.
func NewAlertService(alertRepo repository.AlertRepository) AlertService {
	return &alertService{
		alertRepo: alertRepo,
	}
}

// GetAlertsByUserID retrieves all alerts for a specific user.
func (s *alertService) GetAlertsByUserID(ctx context.Context, userID uint) ([]model.Alert, error) {
	return s.alertRepo.GetByUserID(ctx, userID)
}
