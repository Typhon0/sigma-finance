package middleware

import (
	"context"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"sigma_finance/internal/service"
)

// MonitoringMiddleware creates middleware for monitoring HTTP requests
func MonitoringMiddleware(monitoringService *service.MonitoringService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		
		// Continue with request
		err := c.Next()
		
		// Record metrics after request completion
		duration := time.Since(start).Seconds()
		
		labels := map[string]string{
			"method":     c.Method(),
			"path":       c.Path(),
			"status":     strconv.Itoa(c.Response().StatusCode()),
			"user_agent": c.Get("User-Agent"),
		}

		// Record request metrics
		monitoringService.RecordMetric("http_requests_total", 1, service.MetricTypeCounter, labels)
		monitoringService.RecordMetric("http_request_duration", duration, service.MetricTypeTiming, labels)

		// Record error metrics if request failed
		if err != nil || c.Response().StatusCode() >= 400 {
			errorLabels := map[string]string{
				"method": c.Method(),
				"path":   c.Path(),
				"status": strconv.Itoa(c.Response().StatusCode()),
			}
			monitoringService.RecordMetric("http_errors_total", 1, service.MetricTypeCounter, errorLabels)
		}

		return err
	}
}

// GraphQLMonitoringMiddleware creates middleware for monitoring GraphQL operations
func GraphQLMonitoringMiddleware(monitoringService *service.MonitoringService) func(ctx context.Context, next func(ctx context.Context) (interface{}, error)) (interface{}, error) {
	return func(ctx context.Context, next func(ctx context.Context) (interface{}, error)) (interface{}, error) {
		start := time.Now()
		
		// Get operation info from context
		operationName := getOperationName(ctx)
		userID := getUserID(ctx)
		
		// Execute operation
		result, err := next(ctx)
		
		// Record metrics
		duration := time.Since(start).Seconds()
		
		labels := map[string]string{
			"operation": operationName,
			"user_id":   userID,
			"success":   strconv.FormatBool(err == nil),
		}

		monitoringService.RecordMetric("graphql_operations_total", 1, service.MetricTypeCounter, labels)
		monitoringService.RecordMetric("graphql_operation_duration", duration, service.MetricTypeTiming, labels)

		if err != nil {
			errorLabels := map[string]string{
				"operation": operationName,
				"user_id":   userID,
				"error":     err.Error(),
			}
			monitoringService.RecordMetric("graphql_errors_total", 1, service.MetricTypeCounter, errorLabels)
		}

		return result, err
	}
}

// getOperationName extracts operation name from GraphQL context
func getOperationName(ctx context.Context) string {
	// Implementation depends on your GraphQL setup
	// This is a placeholder - you'd extract from your GraphQL context
	if opName := ctx.Value("operation_name"); opName != nil {
		if name, ok := opName.(string); ok {
			return name
		}
	}
	return "unknown"
}

// getUserID extracts user ID from context
func getUserID(ctx context.Context) string {
	// Implementation depends on your auth setup
	// This is a placeholder - you'd extract from your auth context
	if userID := ctx.Value("user_id"); userID != nil {
		if id, ok := userID.(string); ok {
			return id
		}
	}
	return "anonymous"
}