package graphql

import (
	"context"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/handler/middleware"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
)

// Helper functions for alert resolvers

func getUserIDFromContext(ctx context.Context) (string, error) {
	user, err := middleware.RequireAuth(ctx)
	if err != nil {
		return "", err
	}
	return user.ID, nil
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
		offset = int(*pagination.Offset)
	}

	limit := 20
	if pagination.Limit != nil {
		limit = int(*pagination.Limit)
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
		offset = int(*pagination.Offset)
	}

	limit := 20
	if pagination.Limit != nil {
		limit = int(*pagination.Limit)
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