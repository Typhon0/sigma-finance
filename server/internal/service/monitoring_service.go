package service

import (
	"fmt"
	"log"
	"sync"
	"time"

	"sigma_finance/internal/domain"
)

// MonitoringService handles performance monitoring and analytics
type MonitoringService struct {
	metrics      map[string]*MetricCollector
	alerts       []domain.AlertRule
	mu           sync.RWMutex
	eventChannel chan MonitoringEvent
}

// MetricCollector stores and aggregates metrics
type MetricCollector struct {
	Name         string                 `json:"name"`
	Type         MetricType             `json:"type"`
	Values       []float64              `json:"values"`
	Timestamps   []time.Time            `json:"timestamps"`
	Labels       map[string]string      `json:"labels"`
	Aggregations map[string]float64     `json:"aggregations"`
	LastUpdated  time.Time              `json:"last_updated"`
}

// MetricType defines the type of metric being collected
type MetricType string

const (
	MetricTypeCounter   MetricType = "counter"
	MetricTypeGauge     MetricType = "gauge"
	MetricTypeHistogram MetricType = "histogram"
	MetricTypeTiming    MetricType = "timing"
)

// MonitoringEvent represents an event to be monitored
type MonitoringEvent struct {
	Type      string                 `json:"type"`
	UserID    string                 `json:"user_id,omitempty"`
	SessionID string                 `json:"session_id,omitempty"`
	Data      map[string]interface{} `json:"data"`
	Timestamp time.Time              `json:"timestamp"`
}

// Note: AlertRule and AlertAction types are now defined in domain package

// NewMonitoringService creates a new monitoring service
func NewMonitoringService() *MonitoringService {
	ms := &MonitoringService{
		metrics:      make(map[string]*MetricCollector),
		alerts:       make([]domain.AlertRule, 0),
		eventChannel: make(chan MonitoringEvent, 1000),
	}

	// Start event processor
	go ms.processEvents()
	
	// Start alert processor
	go ms.processAlerts()

	return ms
}

// RecordMetric records a metric value
func (ms *MonitoringService) RecordMetric(name string, value float64, metricType MetricType, labels map[string]string) {
	ms.mu.Lock()
	defer ms.mu.Unlock()

	collector, exists := ms.metrics[name]
	if !exists {
		collector = &MetricCollector{
			Name:         name,
			Type:         metricType,
			Values:       make([]float64, 0),
			Timestamps:   make([]time.Time, 0),
			Labels:       labels,
			Aggregations: make(map[string]float64),
		}
		ms.metrics[name] = collector
	}

	now := time.Now()
	collector.Values = append(collector.Values, value)
	collector.Timestamps = append(collector.Timestamps, now)
	collector.LastUpdated = now

	// Keep only last 1000 values for memory efficiency
	if len(collector.Values) > 1000 {
		collector.Values = collector.Values[len(collector.Values)-1000:]
		collector.Timestamps = collector.Timestamps[len(collector.Timestamps)-1000:]
	}

	// Update aggregations
	ms.updateAggregations(collector)
}

// RecordEvent records a monitoring event
func (ms *MonitoringService) RecordEvent(event MonitoringEvent) {
	event.Timestamp = time.Now()
	select {
	case ms.eventChannel <- event:
	default:
		log.Printf("[WARN] Warning: Event channel full, dropping event: %s", event.Type)
	}
}

// GetMetrics returns current metrics
func (ms *MonitoringService) GetMetrics() map[string]*MetricCollector {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	result := make(map[string]*MetricCollector)
	for k, v := range ms.metrics {
		result[k] = v
	}
	return result
}

// GetMetric returns a specific metric
func (ms *MonitoringService) GetMetric(name string) (*MetricCollector, bool) {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	metric, exists := ms.metrics[name]
	return metric, exists
}

// AddAlertRule adds a new alert rule
func (ms *MonitoringService) AddAlertRule(rule domain.AlertRule) {
	ms.mu.Lock()
	defer ms.mu.Unlock()

	ms.alerts = append(ms.alerts, rule)
}

// processEvents processes monitoring events
func (ms *MonitoringService) processEvents() {
	for event := range ms.eventChannel {
		ms.handleEvent(event)
	}
}

// handleEvent processes individual events
func (ms *MonitoringService) handleEvent(event MonitoringEvent) {
	switch event.Type {
	case "dashboard_state_transition":
		ms.handleDashboardStateTransition(event)
	case "dashboard_data_load":
		ms.handleDashboardDataLoad(event)
	case "user_interaction":
		ms.handleUserInteraction(event)
	case "error_occurred":
		ms.handleError(event)
	case "market_data_update":
		ms.handleMarketDataUpdate(event)
	case "performance_metric":
		ms.handlePerformanceMetric(event)
	default:
		log.Printf("[WARN] Unknown event type: %s", event.Type)
	}
}

// handleDashboardStateTransition processes dashboard state transitions
func (ms *MonitoringService) handleDashboardStateTransition(event MonitoringEvent) {
	duration, ok := event.Data["duration"].(float64)
	if !ok {
		return
	}

	fromState, _ := event.Data["from_state"].(string)
	toState, _ := event.Data["to_state"].(string)

	labels := map[string]string{
		"from_state": fromState,
		"to_state":   toState,
		"user_id":    event.UserID,
	}

	ms.RecordMetric("dashboard_state_transition_duration", duration, MetricTypeTiming, labels)
	ms.RecordMetric("dashboard_state_transitions_total", 1, MetricTypeCounter, labels)
}

// handleDashboardDataLoad processes dashboard data loading events
func (ms *MonitoringService) handleDashboardDataLoad(event MonitoringEvent) {
	duration, ok := event.Data["duration"].(float64)
	if !ok {
		return
	}

	dataType, _ := event.Data["data_type"].(string)
	success, _ := event.Data["success"].(bool)

	labels := map[string]string{
		"data_type": dataType,
		"success":   fmt.Sprintf("%t", success),
		"user_id":   event.UserID,
	}

	ms.RecordMetric("dashboard_data_load_duration", duration, MetricTypeTiming, labels)
	ms.RecordMetric("dashboard_data_loads_total", 1, MetricTypeCounter, labels)

	if !success {
		ms.RecordMetric("dashboard_data_load_errors_total", 1, MetricTypeCounter, labels)
	}
}

// handleUserInteraction processes user interaction events
func (ms *MonitoringService) handleUserInteraction(event MonitoringEvent) {
	action, _ := event.Data["action"].(string)
	component, _ := event.Data["component"].(string)

	labels := map[string]string{
		"action":    action,
		"component": component,
		"user_id":   event.UserID,
	}

	ms.RecordMetric("user_interactions_total", 1, MetricTypeCounter, labels)

	// Track engagement time
	if engagementTime, ok := event.Data["engagement_time"].(float64); ok {
		ms.RecordMetric("user_engagement_duration", engagementTime, MetricTypeTiming, labels)
	}
}

// handleError processes error events
func (ms *MonitoringService) handleError(event MonitoringEvent) {
	errorType, _ := event.Data["error_type"].(string)
	component, _ := event.Data["component"].(string)
	severity, _ := event.Data["severity"].(string)

	labels := map[string]string{
		"error_type": errorType,
		"component":  component,
		"severity":   severity,
		"user_id":    event.UserID,
	}

	ms.RecordMetric("errors_total", 1, MetricTypeCounter, labels)

	// Log error details
	log.Printf("[ERROR] Error recorded: %s in %s (severity: %s) for user %s", 
		errorType, component, severity, event.UserID)
}

// handleMarketDataUpdate processes market data update events
func (ms *MonitoringService) handleMarketDataUpdate(event MonitoringEvent) {
	source, _ := event.Data["source"].(string)
	assetCount, _ := event.Data["asset_count"].(float64)
	duration, _ := event.Data["duration"].(float64)
	success, _ := event.Data["success"].(bool)

	labels := map[string]string{
		"source":  source,
		"success": fmt.Sprintf("%t", success),
	}

	ms.RecordMetric("market_data_updates_total", 1, MetricTypeCounter, labels)
	ms.RecordMetric("market_data_update_duration", duration, MetricTypeTiming, labels)
	ms.RecordMetric("market_data_assets_updated", assetCount, MetricTypeGauge, labels)

	if !success {
		ms.RecordMetric("market_data_update_errors_total", 1, MetricTypeCounter, labels)
	}
}

// handlePerformanceMetric processes performance metric events
func (ms *MonitoringService) handlePerformanceMetric(event MonitoringEvent) {
	metricName, _ := event.Data["metric_name"].(string)
	value, _ := event.Data["value"].(float64)
	component, _ := event.Data["component"].(string)

	labels := map[string]string{
		"component": component,
		"user_id":   event.UserID,
	}

	ms.RecordMetric(fmt.Sprintf("performance_%s", metricName), value, MetricTypeGauge, labels)
}

// updateAggregations updates metric aggregations
func (ms *MonitoringService) updateAggregations(collector *MetricCollector) {
	if len(collector.Values) == 0 {
		return
	}

	values := collector.Values
	n := len(values)

	// Calculate basic aggregations
	sum := 0.0
	min := values[0]
	max := values[0]

	for _, v := range values {
		sum += v
		if v < min {
			min = v
		}
		if v > max {
			max = v
		}
	}

	collector.Aggregations["sum"] = sum
	collector.Aggregations["avg"] = sum / float64(n)
	collector.Aggregations["min"] = min
	collector.Aggregations["max"] = max
	collector.Aggregations["count"] = float64(n)

	// Calculate percentiles for timing metrics
	if collector.Type == MetricTypeTiming && n > 0 {
		sortedValues := make([]float64, n)
		copy(sortedValues, values)
		
		// Simple bubble sort for small arrays
		for i := 0; i < n-1; i++ {
			for j := 0; j < n-i-1; j++ {
				if sortedValues[j] > sortedValues[j+1] {
					sortedValues[j], sortedValues[j+1] = sortedValues[j+1], sortedValues[j]
				}
			}
		}

		collector.Aggregations["p50"] = sortedValues[n/2]
		collector.Aggregations["p95"] = sortedValues[int(float64(n)*0.95)]
		collector.Aggregations["p99"] = sortedValues[int(float64(n)*0.99)]
	}
}

// processAlerts processes alert rules
func (ms *MonitoringService) processAlerts() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		ms.checkAlerts()
	}
}

// checkAlerts checks all alert rules
func (ms *MonitoringService) checkAlerts() {
	ms.mu.RLock()
	alerts := make([]domain.AlertRule, len(ms.alerts))
	copy(alerts, ms.alerts)
	ms.mu.RUnlock()

	for _, alert := range alerts {
		if !alert.Enabled {
			continue
		}

		ms.checkAlert(alert)
	}
}

// checkAlert checks a specific alert rule
func (ms *MonitoringService) checkAlert(alert domain.AlertRule) {
	metric, exists := ms.GetMetric(alert.MetricName)
	if !exists || len(metric.Values) == 0 {
		return
	}

	// Get the latest aggregated value
	var currentValue float64
	var ok bool

	switch alert.Condition {
	case "avg":
		currentValue, ok = metric.Aggregations["avg"]
	case "max":
		currentValue, ok = metric.Aggregations["max"]
	case "min":
		currentValue, ok = metric.Aggregations["min"]
	default:
		// Use latest value
		if len(metric.Values) > 0 {
			currentValue = metric.Values[len(metric.Values)-1]
			ok = true
		}
	}

	if !ok {
		return
	}

	// Check threshold
	shouldFire := false
	switch alert.Condition {
	case "gt":
		shouldFire = currentValue > alert.Threshold
	case "lt":
		shouldFire = currentValue < alert.Threshold
	case "eq":
		shouldFire = currentValue == alert.Threshold
	}

	if shouldFire {
		ms.fireAlert(alert, currentValue)
	}
}

// fireAlert fires an alert
func (ms *MonitoringService) fireAlert(alert domain.AlertRule, currentValue float64) {
	now := time.Now()

	// Check if alert was recently fired (avoid spam)
	if alert.LastFired != nil && now.Sub(*alert.LastFired) < alert.Duration {
		return
	}

	// Update last fired time
	ms.mu.Lock()
	for i := range ms.alerts {
		if ms.alerts[i].ID == alert.ID {
			ms.alerts[i].LastFired = &now
			break
		}
	}
	ms.mu.Unlock()

	// Execute alert actions
	for _, action := range alert.Actions {
		ms.executeAlertAction(action, alert, currentValue)
	}

	log.Printf("[WARN] Alert fired: %s (current value: %f, threshold: %f)", 
		alert.Name, currentValue, alert.Threshold)
}

// executeAlertAction executes an alert action
func (ms *MonitoringService) executeAlertAction(action domain.AlertAction, alert domain.AlertRule, currentValue float64) {
	switch action.Type {
	case "log":
		log.Printf("[WARN] ALERT: %s - Current value: %f, Threshold: %f", 
			alert.Name, currentValue, alert.Threshold)
	case "webhook":
		// Implement webhook notification
		ms.sendWebhookAlert(action.Config, alert, currentValue)
	case "email":
		// Implement email notification
		ms.sendEmailAlert(action.Config, alert, currentValue)
	}
}

// sendWebhookAlert sends a webhook alert (placeholder)
func (ms *MonitoringService) sendWebhookAlert(config map[string]interface{}, alert domain.AlertRule, currentValue float64) {
	// Implementation would send HTTP POST to webhook URL
	log.Printf("[WARN] Webhook alert would be sent for: %s", alert.Name)
}

// sendEmailAlert sends an email alert (placeholder)
func (ms *MonitoringService) sendEmailAlert(config map[string]interface{}, alert domain.AlertRule, currentValue float64) {
	// Implementation would send email notification
	log.Printf("[WARN] Email alert would be sent for: %s", alert.Name)
}

// GetHealthStatus returns system health status
func (ms *MonitoringService) GetHealthStatus() map[string]interface{} {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	status := map[string]interface{}{
		"timestamp":     time.Now(),
		"metrics_count": len(ms.metrics),
		"alerts_count":  len(ms.alerts),
		"status":        "healthy",
	}

	// Check for critical metrics
	if errorMetric, exists := ms.metrics["errors_total"]; exists {
		if len(errorMetric.Values) > 0 {
			recentErrors := 0.0
			cutoff := time.Now().Add(-5 * time.Minute)
			
			for i, timestamp := range errorMetric.Timestamps {
				if timestamp.After(cutoff) {
					recentErrors += errorMetric.Values[i]
				}
			}

			status["recent_errors"] = recentErrors
			if recentErrors > 10 {
				status["status"] = "degraded"
			}
		}
	}

	return status
}