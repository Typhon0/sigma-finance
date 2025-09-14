package graphql

import (
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
)

// mapAlertToGQL converts a repository UserAlert to GraphQL Alert model
func mapAlertToGQL(alert *repository.UserAlert) *gqlModel.Alert {
	if alert == nil {
		return nil
	}

	gqlAlert := &gqlModel.Alert{
		ID:                  alert.ID.String(),
		UserID:              alert.UserID.String(),
		AlertType:           mapServiceAlertTypeToGQL(alert.AlertType),
		ConditionType:       mapServiceConditionTypeToGQL(alert.ConditionType),
		IsActive:            alert.IsActive,
		CreatedAt:           alert.CreatedAt,
		UpdatedAt:           alert.CreatedAt, // Use CreatedAt as UpdatedAt since we don't have UpdatedAt field
		NotificationMethods: []gqlModel.AlertNotificationMethod{}, // Default empty slice
	}

	// Set optional fields
	if alert.AssetID != nil {
		assetIDStr := alert.AssetID.String()
		gqlAlert.AssetID = &assetIDStr
	}

	if alert.PortfolioID != nil {
		portfolioIDStr := alert.PortfolioID.String()
		gqlAlert.PortfolioID = &portfolioIDStr
	}

	if alert.ThresholdValue != nil {
		thresholdValue, _ := alert.ThresholdValue.Float64()
		gqlAlert.ThresholdValue = &thresholdValue
	}

	if alert.ThresholdPercentage != nil {
		thresholdPercentage, _ := alert.ThresholdPercentage.Float64()
		gqlAlert.ThresholdPercentage = &thresholdPercentage
	}

	if alert.LastTriggered != nil {
		gqlAlert.LastTriggered = alert.LastTriggered
	}

	return gqlAlert
}

// mapAlertHistoryToGQL converts a service AlertHistoryEntry to GraphQL AlertTriggerEvent model
func mapAlertHistoryToGQL(entry *service.AlertHistoryEntry) *gqlModel.AlertTriggerEvent {
	if entry == nil {
		return nil
	}

	currentValue, _ := entry.CurrentValue.Float64()
	thresholdValue, _ := entry.ThresholdValue.Float64()

	gqlEvent := &gqlModel.AlertTriggerEvent{
		ID:             entry.AlertID.String(), // Using AlertID as ID for simplicity
		AlertID:        entry.AlertID.String(),
		CurrentValue:   currentValue,
		ThresholdValue: thresholdValue,
		TriggeredAt:    entry.TriggeredAt,
		Message:        entry.Message,
		Acknowledged:   entry.AcknowledgedAt != nil,
	}

	// Set optional fields
	if entry.AcknowledgedAt != nil {
		gqlEvent.AcknowledgedAt = entry.AcknowledgedAt
	}

	return gqlEvent
}

// mapGQLAlertTypeToService converts GraphQL AlertType to service/repository AlertType
func mapGQLAlertTypeToService(gqlType gqlModel.AlertType) repository.AlertType {
	switch gqlType {
	case gqlModel.AlertTypePrice:
		return repository.AlertTypePrice
	case gqlModel.AlertTypePercentageChange:
		return repository.AlertTypePercentageChange
	case gqlModel.AlertTypePortfolioValue:
		return repository.AlertTypePortfolioValue
	case gqlModel.AlertTypeAllocation:
		return repository.AlertTypeAllocation
	default:
		return repository.AlertTypePrice // Default fallback
	}
}

// mapServiceAlertTypeToGQL converts service/repository AlertType to GraphQL AlertType
func mapServiceAlertTypeToGQL(serviceType repository.AlertType) gqlModel.AlertType {
	switch serviceType {
	case repository.AlertTypePrice:
		return gqlModel.AlertTypePrice
	case repository.AlertTypePercentageChange:
		return gqlModel.AlertTypePercentageChange
	case repository.AlertTypePortfolioValue:
		return gqlModel.AlertTypePortfolioValue
	case repository.AlertTypeAllocation:
		return gqlModel.AlertTypeAllocation
	default:
		return gqlModel.AlertTypePrice // Default fallback
	}
}

// mapGQLConditionTypeToService converts GraphQL ConditionType to service/repository ConditionType
func mapGQLConditionTypeToService(gqlType gqlModel.ConditionType) repository.ConditionType {
	switch gqlType {
	case gqlModel.ConditionTypeAbove:
		return repository.ConditionTypeAbove
	case gqlModel.ConditionTypeBelow:
		return repository.ConditionTypeBelow
	default:
		return repository.ConditionTypeAbove // Default fallback
	}
}

// mapServiceConditionTypeToGQL converts service/repository ConditionType to GraphQL ConditionType
func mapServiceConditionTypeToGQL(serviceType repository.ConditionType) gqlModel.ConditionType {
	switch serviceType {
	case repository.ConditionTypeAbove:
		return gqlModel.ConditionTypeAbove
	case repository.ConditionTypeBelow:
		return gqlModel.ConditionTypeBelow
	default:
		return gqlModel.ConditionTypeAbove // Default fallback
	}
}

// mapGQLNotificationMethodsToService converts GraphQL AlertNotificationMethod slice to service AlertNotificationMethod slice
func mapGQLNotificationMethodsToService(gqlMethods []gqlModel.AlertNotificationMethod) []service.AlertNotificationMethod {
	serviceMethods := make([]service.AlertNotificationMethod, len(gqlMethods))
	for i, gqlMethod := range gqlMethods {
		serviceMethods[i] = mapGQLNotificationMethodToService(gqlMethod)
	}
	return serviceMethods
}

// mapGQLNotificationMethodToService converts GraphQL AlertNotificationMethod to service AlertNotificationMethod
func mapGQLNotificationMethodToService(gqlMethod gqlModel.AlertNotificationMethod) service.AlertNotificationMethod {
	switch gqlMethod {
	case gqlModel.AlertNotificationMethodEmail:
		return service.NotificationMethodEmail
	case gqlModel.AlertNotificationMethodPush:
		return service.NotificationMethodPush
	case gqlModel.AlertNotificationMethodInApp:
		return service.NotificationMethodInApp
	case gqlModel.AlertNotificationMethodSms:
		return service.NotificationMethodPush // Map SMS to Push for now
	default:
		return service.NotificationMethodInApp // Default fallback
	}
}

// mapServiceNotificationMethodsToGQL converts service AlertNotificationMethod slice to GraphQL AlertNotificationMethod slice
func mapServiceNotificationMethodsToGQL(serviceMethods []service.AlertNotificationMethod) []gqlModel.AlertNotificationMethod {
	gqlMethods := make([]gqlModel.AlertNotificationMethod, len(serviceMethods))
	for i, serviceMethod := range serviceMethods {
		gqlMethods[i] = mapServiceNotificationMethodToGQL(serviceMethod)
	}
	return gqlMethods
}

// mapServiceNotificationMethodToGQL converts service AlertNotificationMethod to GraphQL AlertNotificationMethod
func mapServiceNotificationMethodToGQL(serviceMethod service.AlertNotificationMethod) gqlModel.AlertNotificationMethod {
	switch serviceMethod {
	case service.NotificationMethodEmail:
		return gqlModel.AlertNotificationMethodEmail
	case service.NotificationMethodPush:
		return gqlModel.AlertNotificationMethodPush
	case service.NotificationMethodInApp:
		return gqlModel.AlertNotificationMethodInApp
	case service.NotificationMethodWebhook:
		return gqlModel.AlertNotificationMethodPush // Map Webhook to Push for now
	default:
		return gqlModel.AlertNotificationMethodInApp // Default fallback
	}
}