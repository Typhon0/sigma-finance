package graphql

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
)

// Alert query resolvers

// Alerts is the resolver for the alerts field.
func (r *queryResolver) Alerts(ctx context.Context, filter *gqlModel.AlertFilter, pagination *gqlModel.PaginationInput) ([]*gqlModel.Alert, error) {
	// Get user ID from context (assuming it's set by auth middleware)
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("unauthorized: %w", err)
	}

	// Get alerts from service
	alerts, err := r.AlertService.GetUserAlerts(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get alerts: %w", err)
	}

	// Apply filters if provided
	if filter != nil {
		alerts = filterAlerts(alerts, filter)
	}

	// Apply pagination if provided
	if pagination != nil {
		alerts = paginateAlerts(alerts, pagination)
	}

	// Convert to GraphQL model
	result := make([]*gqlModel.Alert, len(alerts))
	for i, alert := range alerts {
		result[i] = mapAlertToGQL(alert)
	}

	return result, nil
}

// Alert is the resolver for the alert field.
func (r *queryResolver) Alert(ctx context.Context, id string) (*gqlModel.Alert, error) {
	// Parse alert ID
	alertUUID, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid alert ID: %w", err)
	}

	// Get alert from service
	alert, err := r.AlertService.GetAlert(ctx, alertUUID)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert: %w", err)
	}

	if alert == nil {
		return nil, nil
	}

	// Convert to GraphQL model
	return mapAlertToGQL(alert), nil
}

// AlertHistory is the resolver for the alertHistory field.
func (r *queryResolver) AlertHistory(ctx context.Context, userID string, filter *gqlModel.AlertFilter, pagination *gqlModel.PaginationInput) ([]*gqlModel.AlertTriggerEvent, error) {
	// Parse user ID
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID: %w", err)
	}

	// Verify user authorization (user can only access their own alert history)
	currentUserID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("unauthorized: %w", err)
	}

	if currentUserID != userUUID {
		return nil, fmt.Errorf("unauthorized: cannot access other user's alert history")
	}

	// Convert filter to service filter
	serviceFilter := service.AlertHistoryFilter{}
	if filter != nil {
		if filter.AlertType != nil {
			alertType := mapGQLAlertTypeToService(*filter.AlertType)
			serviceFilter.AlertType = &alertType
		}
		if filter.AssetID != nil {
			assetUUID, err := uuid.Parse(*filter.AssetID)
			if err != nil {
				return nil, fmt.Errorf("invalid asset ID: %w", err)
			}
			serviceFilter.AssetID = &assetUUID
		}
		if filter.PortfolioID != nil {
			portfolioUUID, err := uuid.Parse(*filter.PortfolioID)
			if err != nil {
				return nil, fmt.Errorf("invalid portfolio ID: %w", err)
			}
			serviceFilter.PortfolioID = &portfolioUUID
		}
		if filter.TriggeredAfter != nil {
			serviceFilter.TriggeredAfter = filter.TriggeredAfter
		}
	}

	// Get alert history from service
	history, err := r.AlertService.GetAlertHistory(ctx, userUUID, serviceFilter)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert history: %w", err)
	}

	// Apply pagination if provided
	if pagination != nil {
		history = paginateAlertHistory(history, pagination)
	}

	// Convert to GraphQL model
	result := make([]*gqlModel.AlertTriggerEvent, len(history))
	for i, event := range history {
		result[i] = mapAlertHistoryToGQL(event)
	}

	return result, nil
}

// Alert mutation resolvers

// CreateAlert is the resolver for the createAlert field.
func (r *mutationResolver) CreateAlert(ctx context.Context, input gqlModel.CreateAlertInput) (*gqlModel.Alert, error) {
	// Get user ID from context
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("unauthorized: %w", err)
	}

	// Convert input to service request
	req := service.CreateAlertRequest{
		UserID:              userID,
		AlertType:           mapGQLAlertTypeToService(input.AlertType),
		ConditionType:       mapGQLConditionTypeToService(input.ConditionType),
		NotificationMethods: mapGQLNotificationMethodsToService(input.NotificationMethods),
	}

	// Set optional fields
	if input.AssetID != nil {
		assetUUID, err := uuid.Parse(*input.AssetID)
		if err != nil {
			return nil, fmt.Errorf("invalid asset ID: %w", err)
		}
		req.AssetID = &assetUUID
	}

	if input.PortfolioID != nil {
		portfolioUUID, err := uuid.Parse(*input.PortfolioID)
		if err != nil {
			return nil, fmt.Errorf("invalid portfolio ID: %w", err)
		}
		req.PortfolioID = &portfolioUUID
	}

	if input.ThresholdValue != nil {
		thresholdDecimal := decimal.NewFromFloat(*input.ThresholdValue)
		req.ThresholdValue = &thresholdDecimal
	}

	if input.ThresholdPercentage != nil {
		thresholdPercentage := decimal.NewFromFloat(*input.ThresholdPercentage)
		req.ThresholdPercentage = &thresholdPercentage
	}

	// Create alert using service
	alert, err := r.AlertService.CreateAlert(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to create alert: %w", err)
	}

	// Convert to GraphQL model
	return mapAlertToGQL(alert), nil
}

// UpdateAlert is the resolver for the updateAlert field.
func (r *mutationResolver) UpdateAlert(ctx context.Context, id string, input gqlModel.UpdateAlertInput) (*gqlModel.Alert, error) {
	// Parse alert ID
	alertUUID, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid alert ID: %w", err)
	}

	// Convert input to service request
	req := service.UpdateAlertRequest{}

	// Set optional fields
	if input.AlertType != nil {
		alertType := mapGQLAlertTypeToService(*input.AlertType)
		req.AlertType = &alertType
	}

	if input.ConditionType != nil {
		conditionType := mapGQLConditionTypeToService(*input.ConditionType)
		req.ConditionType = &conditionType
	}

	if input.ThresholdValue != nil {
		thresholdDecimal := decimal.NewFromFloat(*input.ThresholdValue)
		req.ThresholdValue = &thresholdDecimal
	}

	if input.ThresholdPercentage != nil {
		thresholdPercentage := decimal.NewFromFloat(*input.ThresholdPercentage)
		req.ThresholdPercentage = &thresholdPercentage
	}

	if input.IsActive != nil {
		req.IsActive = input.IsActive
	}

	if input.NotificationMethods != nil {
		req.NotificationMethods = mapGQLNotificationMethodsToService(input.NotificationMethods)
	}

	// Update alert using service
	alert, err := r.AlertService.UpdateAlert(ctx, alertUUID, req)
	if err != nil {
		return nil, fmt.Errorf("failed to update alert: %w", err)
	}

	// Convert to GraphQL model
	return mapAlertToGQL(alert), nil
}

// DeleteAlert is the resolver for the deleteAlert field.
func (r *mutationResolver) DeleteAlert(ctx context.Context, id string) (bool, error) {
	// Parse alert ID
	alertUUID, err := uuid.Parse(id)
	if err != nil {
		return false, fmt.Errorf("invalid alert ID: %w", err)
	}

	// Delete alert using service
	err = r.AlertService.DeleteAlert(ctx, alertUUID)
	if err != nil {
		return false, fmt.Errorf("failed to delete alert: %w", err)
	}

	return true, nil
}

// AcknowledgeAlert is the resolver for the acknowledgeAlert field.
func (r *mutationResolver) AcknowledgeAlert(ctx context.Context, id string) (bool, error) {
	// Parse alert ID
	alertUUID, err := uuid.Parse(id)
	if err != nil {
		return false, fmt.Errorf("invalid alert ID: %w", err)
	}

	// Get user ID from context
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return false, fmt.Errorf("unauthorized: %w", err)
	}

	// Acknowledge alert using service
	err = r.AlertService.AcknowledgeAlert(ctx, alertUUID, userID)
	if err != nil {
		return false, fmt.Errorf("failed to acknowledge alert: %w", err)
	}

	return true, nil
}

// CreateBatchAlerts is the resolver for the createBatchAlerts field.
func (r *mutationResolver) CreateBatchAlerts(ctx context.Context, alerts []*gqlModel.CreateAlertInput) ([]*gqlModel.Alert, error) {
	// Get user ID from context
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("unauthorized: %w", err)
	}

	// Convert inputs to service requests
	requests := make([]service.CreateAlertRequest, len(alerts))
	for i, input := range alerts {
		req := service.CreateAlertRequest{
			UserID:              userID,
			AlertType:           mapGQLAlertTypeToService(input.AlertType),
			ConditionType:       mapGQLConditionTypeToService(input.ConditionType),
			NotificationMethods: mapGQLNotificationMethodsToService(input.NotificationMethods),
		}

		// Set optional fields
		if input.AssetID != nil {
			assetUUID, err := uuid.Parse(*input.AssetID)
			if err != nil {
				return nil, fmt.Errorf("invalid asset ID in alert %d: %w", i, err)
			}
			req.AssetID = &assetUUID
		}

		if input.PortfolioID != nil {
			portfolioUUID, err := uuid.Parse(*input.PortfolioID)
			if err != nil {
				return nil, fmt.Errorf("invalid portfolio ID in alert %d: %w", i, err)
			}
			req.PortfolioID = &portfolioUUID
		}

		if input.ThresholdValue != nil {
			thresholdDecimal := decimal.NewFromFloat(*input.ThresholdValue)
			req.ThresholdValue = &thresholdDecimal
		}

		if input.ThresholdPercentage != nil {
			thresholdPercentage := decimal.NewFromFloat(*input.ThresholdPercentage)
			req.ThresholdPercentage = &thresholdPercentage
		}

		requests[i] = req
	}

	// Create batch alerts using service
	createdAlerts, err := r.AlertService.CreateBatchAlerts(ctx, requests)
	if err != nil {
		return nil, fmt.Errorf("failed to create batch alerts: %w", err)
	}

	// Convert to GraphQL model
	result := make([]*gqlModel.Alert, len(createdAlerts))
	for i, alert := range createdAlerts {
		result[i] = mapAlertToGQL(alert)
	}

	return result, nil
}

// DeactivateBatchAlerts is the resolver for the deactivateBatchAlerts field.
func (r *mutationResolver) DeactivateBatchAlerts(ctx context.Context, alertIds []string) (bool, error) {
	// Parse alert IDs
	alertUUIDs := make([]uuid.UUID, len(alertIds))
	for i, id := range alertIds {
		alertUUID, err := uuid.Parse(id)
		if err != nil {
			return false, fmt.Errorf("invalid alert ID %s: %w", id, err)
		}
		alertUUIDs[i] = alertUUID
	}

	// Deactivate batch alerts using service
	err := r.AlertService.DeactivateBatchAlerts(ctx, alertUUIDs)
	if err != nil {
		return false, fmt.Errorf("failed to deactivate batch alerts: %w", err)
	}

	return true, nil
}

// Export data resolver

// ExportPortfolioData is the resolver for the exportPortfolioData field.
func (r *queryResolver) ExportPortfolioData(ctx context.Context, input gqlModel.ExportDataInput) (*gqlModel.ExportData, error) {
	// Parse portfolio ID
	portfolioUUID, err := uuid.Parse(input.PortfolioID)
	if err != nil {
		return nil, fmt.Errorf("invalid portfolio ID: %w", err)
	}

	// For now, return a placeholder implementation
	// In a real implementation, this would generate the export data
	// and potentially store it in a file system or cloud storage
	
	return &gqlModel.ExportData{
		PortfolioID:  input.PortfolioID,
		Format:       input.Format,
		Data:         "placeholder export data",
		DownloadURL:  "https://example.com/exports/portfolio-" + input.PortfolioID + ".csv",
		GeneratedAt:  time.Now(),
		ExpiresAt:    time.Now().Add(24 * time.Hour),
	}, nil
}

// Helper functions

func getUserIDFromContext(ctx context.Context) (uuid.UUID, error) {
	// This would typically extract the user ID from the authentication context
	// For now, return a placeholder
	return uuid.New(), nil
}

func filterAlerts(alerts []*repository.UserAlert, filter *gqlModel.AlertFilter) []*repository.UserAlert {
	// Apply filters to the alerts slice
	// This is a simplified implementation
	filtered := make([]*repository.UserAlert, 0, len(alerts))
	
	for _, alert := range alerts {
		include := true
		
		if filter.AlertType != nil {
			serviceAlertType := mapGQLAlertTypeToService(*filter.AlertType)
			if alert.AlertType != serviceAlertType {
				include = false
			}
		}
		
		if filter.IsActive != nil && alert.IsActive != *filter.IsActive {
			include = false
		}
		
		if include {
			filtered = append(filtered, alert)
		}
	}
	
	return filtered
}

func paginateAlerts(alerts []*repository.UserAlert, pagination *gqlModel.PaginationInput) []*repository.UserAlert {
	// Apply pagination to the alerts slice
	offset := 0
	if pagination.Offset != nil {
		offset = *pagination.Offset
	}
	
	limit := 20
	if pagination.Limit != nil {
		limit = *pagination.Limit
	}
	
	start := offset
	end := offset + limit
	
	if start >= len(alerts) {
		return []*repository.UserAlert{}
	}
	
	if end > len(alerts) {
		end = len(alerts)
	}
	
	return alerts[start:end]
}

func paginateAlertHistory(history []*service.AlertHistoryEntry, pagination *gqlModel.PaginationInput) []*service.AlertHistoryEntry {
	// Apply pagination to the alert history slice
	offset := 0
	if pagination.Offset != nil {
		offset = *pagination.Offset
	}
	
	limit := 20
	if pagination.Limit != nil {
		limit = *pagination.Limit
	}
	
	start := offset
	end := offset + limit
	
	if start >= len(history) {
		return []*service.AlertHistoryEntry{}
	}
	
	if end > len(history) {
		end = len(history)
	}
	
	return history[start:end]
}