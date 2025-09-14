package resolver

import (
	"context"
	"encoding/json"
	"time"

	"sigma_finance/internal/service"
)

// MonitoringResolver handles monitoring-related GraphQL operations
type MonitoringResolver struct {
	monitoringService *service.MonitoringService
}

// NewMonitoringResolver creates a new monitoring resolver
func NewMonitoringResolver(monitoringService *service.MonitoringService) *MonitoringResolver {
	return &MonitoringResolver{
		monitoringService: monitoringService,
	}
}

// Metric represents a monitoring metric
type Metric struct {
	Name         string                 `json:"name"`
	Type         string                 `json:"type"`
	Value        float64                `json:"value"`
	Labels       map[string]string      `json:"labels"`
	Aggregations map[string]float64     `json:"aggregations"`
	LastUpdated  time.Time              `json:"last_updated"`
}

// SystemHealth represents system health status
type SystemHealth struct {
	Status       string                 `json:"status"`
	Timestamp    time.Time              `json:"timestamp"`
	MetricsCount int                    `json:"metrics_count"`
	AlertsCount  int                    `json:"alerts_count"`
	RecentErrors float64                `json:"recent_errors"`
	Details      map[string]interface{} `json:"details"`
}

// PerformanceMetrics represents dashboard performance metrics
type PerformanceMetrics struct {
	DashboardStateTransitions *MetricSummary `json:"dashboard_state_transitions"`
	DataLoadTimes            *MetricSummary `json:"data_load_times"`
	UserInteractions         *MetricSummary `json:"user_interactions"`
	ErrorRates               *MetricSummary `json:"error_rates"`
	MarketDataUpdates        *MetricSummary `json:"market_data_updates"`
}

// MetricSummary provides aggregated metric information
type MetricSummary struct {
	Total      float64            `json:"total"`
	Average    float64            `json:"average"`
	Min        float64            `json:"min"`
	Max        float64            `json:"max"`
	P50        float64            `json:"p50"`
	P95        float64            `json:"p95"`
	P99        float64            `json:"p99"`
	LastHour   float64            `json:"last_hour"`
	LastDay    float64            `json:"last_day"`
	Breakdown  map[string]float64 `json:"breakdown"`
}

// UserEngagementMetrics represents user engagement analytics
type UserEngagementMetrics struct {
	TotalUsers           int                    `json:"total_users"`
	ActiveUsers          int                    `json:"active_users"`
	AvgSessionDuration   float64                `json:"avg_session_duration"`
	TopFeatures          []FeatureUsage         `json:"top_features"`
	NavigationPatterns   []NavigationPattern    `json:"navigation_patterns"`
	DeviceBreakdown      map[string]int         `json:"device_breakdown"`
	ErrorsByComponent    map[string]int         `json:"errors_by_component"`
}

// FeatureUsage represents usage statistics for a feature
type FeatureUsage struct {
	Feature     string  `json:"feature"`
	UsageCount  int     `json:"usage_count"`
	UniqueUsers int     `json:"unique_users"`
	AvgDuration float64 `json:"avg_duration"`
}

// NavigationPattern represents user navigation patterns
type NavigationPattern struct {
	Pattern     string  `json:"pattern"`
	Count       int     `json:"count"`
	AvgDuration float64 `json:"avg_duration"`
	Conversion  float64 `json:"conversion"`
}

// GetSystemHealth returns current system health status
func (r *MonitoringResolver) GetSystemHealth(ctx context.Context) (*SystemHealth, error) {
	healthData := r.monitoringService.GetHealthStatus()
	
	health := &SystemHealth{
		Status:       healthData["status"].(string),
		Timestamp:    healthData["timestamp"].(time.Time),
		MetricsCount: healthData["metrics_count"].(int),
		AlertsCount:  healthData["alerts_count"].(int),
		Details:      healthData,
	}

	if recentErrors, ok := healthData["recent_errors"].(float64); ok {
		health.RecentErrors = recentErrors
	}

	return health, nil
}

// GetPerformanceMetrics returns dashboard performance metrics
func (r *MonitoringResolver) GetPerformanceMetrics(ctx context.Context, timeRange *string) (*PerformanceMetrics, error) {
	metrics := r.monitoringService.GetMetrics()
	
	performanceMetrics := &PerformanceMetrics{
		DashboardStateTransitions: r.buildMetricSummary(metrics, "dashboard_state_transition_duration"),
		DataLoadTimes:            r.buildMetricSummary(metrics, "dashboard_data_load_duration"),
		UserInteractions:         r.buildMetricSummary(metrics, "user_interactions_total"),
		ErrorRates:               r.buildMetricSummary(metrics, "errors_total"),
		MarketDataUpdates:        r.buildMetricSummary(metrics, "market_data_updates_total"),
	}

	return performanceMetrics, nil
}

// GetUserEngagementMetrics returns user engagement analytics
func (r *MonitoringResolver) GetUserEngagementMetrics(ctx context.Context, timeRange *string) (*UserEngagementMetrics, error) {
	metrics := r.monitoringService.GetMetrics()
	
	engagement := &UserEngagementMetrics{
		TopFeatures:        r.calculateTopFeatures(metrics),
		NavigationPatterns: r.calculateNavigationPatterns(metrics),
		DeviceBreakdown:    r.calculateDeviceBreakdown(metrics),
		ErrorsByComponent:  r.calculateErrorsByComponent(metrics),
	}

	// Calculate user counts and session duration
	if userMetric, exists := metrics["user_interactions_total"]; exists {
		engagement.TotalUsers = r.countUniqueUsers(userMetric)
		engagement.ActiveUsers = r.countActiveUsers(userMetric, time.Hour*24)
	}

	if sessionMetric, exists := metrics["user_engagement_duration"]; exists {
		if avg, ok := sessionMetric.Aggregations["avg"]; ok {
			engagement.AvgSessionDuration = avg
		}
	}

	return engagement, nil
}

// RecordDashboardEvent records a dashboard monitoring event
func (r *MonitoringResolver) RecordDashboardEvent(ctx context.Context, input DashboardEventInput) (bool, error) {
	event := service.MonitoringEvent{
		Type:      input.Type,
		UserID:    input.UserID,
		SessionID: input.SessionID,
		Data:      input.Data,
	}

	r.monitoringService.RecordEvent(event)
	return true, nil
}

// DashboardEventInput represents input for recording dashboard events
type DashboardEventInput struct {
	Type      string                 `json:"type"`
	UserID    string                 `json:"user_id"`
	SessionID string                 `json:"session_id"`
	Data      map[string]interface{} `json:"data"`
}

// buildMetricSummary builds a metric summary from collected data
func (r *MonitoringResolver) buildMetricSummary(metrics map[string]*service.MetricCollector, metricName string) *MetricSummary {
	metric, exists := metrics[metricName]
	if !exists || len(metric.Values) == 0 {
		return &MetricSummary{
			Breakdown: make(map[string]float64),
		}
	}

	summary := &MetricSummary{
		Total:     metric.Aggregations["sum"],
		Average:   metric.Aggregations["avg"],
		Min:       metric.Aggregations["min"],
		Max:       metric.Aggregations["max"],
		Breakdown: make(map[string]float64),
	}

	// Add percentiles if available
	if p50, ok := metric.Aggregations["p50"]; ok {
		summary.P50 = p50
	}
	if p95, ok := metric.Aggregations["p95"]; ok {
		summary.P95 = p95
	}
	if p99, ok := metric.Aggregations["p99"]; ok {
		summary.P99 = p99
	}

	// Calculate time-based aggregations
	summary.LastHour = r.calculateTimeRangeSum(metric, time.Hour)
	summary.LastDay = r.calculateTimeRangeSum(metric, time.Hour*24)

	// Build breakdown by labels
	summary.Breakdown = r.buildLabelBreakdown(metric)

	return summary
}

// calculateTimeRangeSum calculates sum for a specific time range
func (r *MonitoringResolver) calculateTimeRangeSum(metric *service.MetricCollector, duration time.Duration) float64 {
	cutoff := time.Now().Add(-duration)
	sum := 0.0

	for i, timestamp := range metric.Timestamps {
		if timestamp.After(cutoff) {
			sum += metric.Values[i]
		}
	}

	return sum
}

// buildLabelBreakdown builds breakdown by metric labels
func (r *MonitoringResolver) buildLabelBreakdown(metric *service.MetricCollector) map[string]float64 {
	breakdown := make(map[string]float64)
	
	// This is a simplified implementation
	// In a real system, you'd track label-specific values
	for key, value := range metric.Labels {
		breakdown[key] = metric.Aggregations["avg"] // Placeholder
		_ = value // Use value in real implementation
	}

	return breakdown
}

// calculateTopFeatures calculates top used features
func (r *MonitoringResolver) calculateTopFeatures(metrics map[string]*service.MetricCollector) []FeatureUsage {
	features := make([]FeatureUsage, 0)
	
	if interactionMetric, exists := metrics["user_interactions_total"]; exists {
		// Simplified calculation - in real implementation, you'd parse labels
		features = append(features, FeatureUsage{
			Feature:     "portfolio_view",
			UsageCount:  int(interactionMetric.Aggregations["sum"]),
			UniqueUsers: r.countUniqueUsers(interactionMetric),
			AvgDuration: interactionMetric.Aggregations["avg"],
		})
	}

	return features
}

// calculateNavigationPatterns calculates user navigation patterns
func (r *MonitoringResolver) calculateNavigationPatterns(metrics map[string]*service.MetricCollector) []NavigationPattern {
	patterns := make([]NavigationPattern, 0)
	
	if transitionMetric, exists := metrics["dashboard_state_transition_duration"]; exists {
		// Simplified calculation - in real implementation, you'd analyze transition sequences
		patterns = append(patterns, NavigationPattern{
			Pattern:     "overview -> portfolio -> asset",
			Count:       int(transitionMetric.Aggregations["count"]),
			AvgDuration: transitionMetric.Aggregations["avg"],
			Conversion:  0.85, // Placeholder
		})
	}

	return patterns
}

// calculateDeviceBreakdown calculates device usage breakdown
func (r *MonitoringResolver) calculateDeviceBreakdown(metrics map[string]*service.MetricCollector) map[string]int {
	breakdown := make(map[string]int)
	
	// Simplified implementation - in real system, you'd parse user agent data
	breakdown["desktop"] = 150
	breakdown["mobile"] = 75
	breakdown["tablet"] = 25

	return breakdown
}

// calculateErrorsByComponent calculates errors by component
func (r *MonitoringResolver) calculateErrorsByComponent(metrics map[string]*service.MetricCollector) map[string]int {
	breakdown := make(map[string]int)
	
	if errorMetric, exists := metrics["errors_total"]; exists {
		// Simplified implementation - in real system, you'd parse component labels
		breakdown["dashboard"] = int(errorMetric.Aggregations["sum"] * 0.4)
		breakdown["portfolio"] = int(errorMetric.Aggregations["sum"] * 0.3)
		breakdown["charts"] = int(errorMetric.Aggregations["sum"] * 0.2)
		breakdown["other"] = int(errorMetric.Aggregations["sum"] * 0.1)
	}

	return breakdown
}

// countUniqueUsers counts unique users in a metric
func (r *MonitoringResolver) countUniqueUsers(metric *service.MetricCollector) int {
	// Simplified implementation - in real system, you'd track unique user IDs
	return int(metric.Aggregations["count"] * 0.7) // Placeholder calculation
}

// countActiveUsers counts active users in a time period
func (r *MonitoringResolver) countActiveUsers(metric *service.MetricCollector, period time.Duration) int {
	cutoff := time.Now().Add(-period)
	activeCount := 0

	for _, timestamp := range metric.Timestamps {
		if timestamp.After(cutoff) {
			activeCount++
		}
	}

	return int(float64(activeCount) * 0.7) // Simplified calculation
}