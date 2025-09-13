package config

import (
	"time"

	"github.com/portfolio-tracker/server/internal/service"
)

// MonitoringConfig holds monitoring configuration
type MonitoringConfig struct {
	Enabled                bool                              `json:"enabled"`
	MetricsRetentionPeriod time.Duration                     `json:"metrics_retention_period"`
	AlertRules             []service.AlertRule               `json:"alert_rules"`
	MarketDataThresholds   service.MarketDataAlertThresholds `json:"market_data_thresholds"`
	PerformanceThresholds  PerformanceThresholds             `json:"performance_thresholds"`
	SamplingRates          SamplingRates                     `json:"sampling_rates"`
}

// PerformanceThresholds defines performance alert thresholds
type PerformanceThresholds struct {
	MaxResponseTime        time.Duration `json:"max_response_time"`
	MaxDashboardLoadTime   time.Duration `json:"max_dashboard_load_time"`
	MaxStateTransitionTime time.Duration `json:"max_state_transition_time"`
	MaxErrorRate           float64       `json:"max_error_rate"`
	MinSuccessRate         float64       `json:"min_success_rate"`
	MaxMemoryUsage         int64         `json:"max_memory_usage"` // bytes
}

// SamplingRates defines sampling rates for different types of events
type SamplingRates struct {
	UserInteractions    float64 `json:"user_interactions"`    // 0.0 to 1.0
	PerformanceMetrics  float64 `json:"performance_metrics"`  // 0.0 to 1.0
	ErrorEvents         float64 `json:"error_events"`         // 0.0 to 1.0 (usually 1.0)
	MarketDataUpdates   float64 `json:"market_data_updates"`  // 0.0 to 1.0
	StateTransitions    float64 `json:"state_transitions"`    // 0.0 to 1.0
}

// GetDefaultMonitoringConfig returns default monitoring configuration
func GetDefaultMonitoringConfig() MonitoringConfig {
	return MonitoringConfig{
		Enabled:                true,
		MetricsRetentionPeriod: 30 * 24 * time.Hour, // 30 days
		AlertRules:             getDefaultAlertRules(),
		MarketDataThresholds: service.MarketDataAlertThresholds{
			MaxLatency:        5 * time.Second,
			MinSuccessRate:    0.95,
			MaxStaleDataAge:   15 * time.Minute,
			MinQualityScore:   85.0,
			MaxOutlierRate:    0.05,
			MinUptimePercent:  99.0,
		},
		PerformanceThresholds: PerformanceThresholds{
			MaxResponseTime:        2 * time.Second,
			MaxDashboardLoadTime:   3 * time.Second,
			MaxStateTransitionTime: 500 * time.Millisecond,
			MaxErrorRate:           0.05, // 5%
			MinSuccessRate:         0.95, // 95%
			MaxMemoryUsage:         500 * 1024 * 1024, // 500MB
		},
		SamplingRates: SamplingRates{
			UserInteractions:   0.1,  // Sample 10% of user interactions
			PerformanceMetrics: 0.5,  // Sample 50% of performance metrics
			ErrorEvents:        1.0,  // Sample 100% of errors
			MarketDataUpdates:  0.2,  // Sample 20% of market data updates
			StateTransitions:   1.0,  // Sample 100% of state transitions
		},
	}
}

// getDefaultAlertRules returns default alert rules
func getDefaultAlertRules() []service.AlertRule {
	return []service.AlertRule{
		{
			ID:         "high_error_rate",
			Name:       "High Error Rate",
			MetricName: "errors_total",
			Condition:  "gt",
			Threshold:  10,
			Duration:   5 * time.Minute,
			Labels:     map[string]string{},
			Actions: []service.AlertAction{
				{
					Type: "log",
					Config: map[string]interface{}{
						"level": "error",
					},
				},
			},
			Enabled: true,
		},
		{
			ID:         "slow_dashboard_transitions",
			Name:       "Slow Dashboard State Transitions",
			MetricName: "dashboard_state_transition_duration",
			Condition:  "avg",
			Threshold:  2.0, // 2 seconds average
			Duration:   10 * time.Minute,
			Labels:     map[string]string{},
			Actions: []service.AlertAction{
				{
					Type: "log",
					Config: map[string]interface{}{
						"level": "warning",
					},
				},
			},
			Enabled: true,
		},
		{
			ID:         "slow_data_loading",
			Name:       "Slow Data Loading",
			MetricName: "dashboard_data_load_duration",
			Condition:  "p95",
			Threshold:  5.0, // 5 seconds P95
			Duration:   15 * time.Minute,
			Labels:     map[string]string{},
			Actions: []service.AlertAction{
				{
					Type: "log",
					Config: map[string]interface{}{
						"level": "warning",
					},
				},
			},
			Enabled: true,
		},
		{
			ID:         "market_data_stale",
			Name:       "Stale Market Data",
			MetricName: "market_data_stale_count",
			Condition:  "gt",
			Threshold:  5,
			Duration:   5 * time.Minute,
			Labels:     map[string]string{},
			Actions: []service.AlertAction{
				{
					Type: "log",
					Config: map[string]interface{}{
						"level": "error",
					},
				},
			},
			Enabled: true,
		},
		{
			ID:         "low_market_data_quality",
			Name:       "Low Market Data Quality",
			MetricName: "market_data_quality_score",
			Condition:  "lt",
			Threshold:  80.0,
			Duration:   10 * time.Minute,
			Labels:     map[string]string{},
			Actions: []service.AlertAction{
				{
					Type: "log",
					Config: map[string]interface{}{
						"level": "warning",
					},
				},
			},
			Enabled: true,
		},
		{
			ID:         "high_memory_usage",
			Name:       "High Memory Usage",
			MetricName: "performance_memory_usage",
			Condition:  "gt",
			Threshold:  400000000, // 400MB
			Duration:   5 * time.Minute,
			Labels:     map[string]string{},
			Actions: []service.AlertAction{
				{
					Type: "log",
					Config: map[string]interface{}{
						"level": "warning",
					},
				},
			},
			Enabled: true,
		},
		{
			ID:         "low_user_engagement",
			Name:       "Low User Engagement",
			MetricName: "user_interactions_total",
			Condition:  "lt",
			Threshold:  10,
			Duration:   1 * time.Hour,
			Labels:     map[string]string{},
			Actions: []service.AlertAction{
				{
					Type: "log",
					Config: map[string]interface{}{
						"level": "info",
					},
				},
			},
			Enabled: true,
		},
	}
}

// MonitoringSetup initializes monitoring services with configuration
func MonitoringSetup(config MonitoringConfig) (*service.MonitoringService, *service.MarketDataMonitor) {
	// Create monitoring service
	monitoringService := service.NewMonitoringService()

	// Add alert rules
	for _, rule := range config.AlertRules {
		monitoringService.AddAlertRule(rule)
	}

	// Create market data monitor
	marketDataMonitor := service.NewMarketDataMonitor(monitoringService)

	return monitoringService, marketDataMonitor
}

// ShouldSample determines if an event should be sampled based on sampling rates
func (c *MonitoringConfig) ShouldSample(eventType string) bool {
	if !c.Enabled {
		return false
	}

	var rate float64
	switch eventType {
	case "user_interaction":
		rate = c.SamplingRates.UserInteractions
	case "performance_metric":
		rate = c.SamplingRates.PerformanceMetrics
	case "error_occurred":
		rate = c.SamplingRates.ErrorEvents
	case "market_data_update":
		rate = c.SamplingRates.MarketDataUpdates
	case "dashboard_state_transition":
		rate = c.SamplingRates.StateTransitions
	default:
		rate = 1.0 // Sample unknown events by default
	}

	// Simple sampling based on rate
	// In production, you might want to use more sophisticated sampling
	return rate >= 1.0 || (rate > 0 && (time.Now().UnixNano()%1000000)/1000000.0 < rate)
}

// GetPerformanceThresholds returns performance thresholds
func (c *MonitoringConfig) GetPerformanceThresholds() PerformanceThresholds {
	return c.PerformanceThresholds
}

// GetMarketDataThresholds returns market data thresholds
func (c *MonitoringConfig) GetMarketDataThresholds() service.MarketDataAlertThresholds {
	return c.MarketDataThresholds
}

// IsMonitoringEnabled returns whether monitoring is enabled
func (c *MonitoringConfig) IsMonitoringEnabled() bool {
	return c.Enabled
}

// GetMetricsRetentionPeriod returns metrics retention period
func (c *MonitoringConfig) GetMetricsRetentionPeriod() time.Duration {
	return c.MetricsRetentionPeriod
}