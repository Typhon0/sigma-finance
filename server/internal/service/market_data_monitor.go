package service

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"sigma_finance/internal/domain"
)

// MarketDataMonitor monitors market data quality and performance
type MarketDataMonitor struct {
	monitoringService *MonitoringService
	sources          map[string]*DataSourceMetrics
	mu               sync.RWMutex
	alertThresholds  domain.MarketDataAlertThresholds
}

// DataSourceMetrics tracks metrics for a specific market data source
type DataSourceMetrics struct {
	SourceName       string                 `json:"source_name"`
	LastUpdate       time.Time              `json:"last_update"`
	UpdateCount      int64                  `json:"update_count"`
	ErrorCount       int64                  `json:"error_count"`
	AvgLatency       time.Duration          `json:"avg_latency"`
	SuccessRate      float64                `json:"success_rate"`
	DataQuality      DataQualityMetrics     `json:"data_quality"`
	AssetCoverage    map[string]int         `json:"asset_coverage"` // asset_type -> count
	PriceValidation  PriceValidationMetrics `json:"price_validation"`
	Uptime           UptimeMetrics          `json:"uptime"`
}

// DataQualityMetrics tracks data quality indicators
type DataQualityMetrics struct {
	StaleDataCount     int64   `json:"stale_data_count"`
	InvalidPriceCount  int64   `json:"invalid_price_count"`
	MissingDataCount   int64   `json:"missing_data_count"`
	DuplicateCount     int64   `json:"duplicate_count"`
	QualityScore       float64 `json:"quality_score"` // 0-100
	LastQualityCheck   time.Time `json:"last_quality_check"`
}

// PriceValidationMetrics tracks price validation results
type PriceValidationMetrics struct {
	OutlierCount       int64     `json:"outlier_count"`
	NegativePriceCount int64     `json:"negative_price_count"`
	ZeroPriceCount     int64     `json:"zero_price_count"`
	SuspiciousChanges  int64     `json:"suspicious_changes"` // >50% change
	LastValidation     time.Time `json:"last_validation"`
}

// UptimeMetrics tracks source availability
type UptimeMetrics struct {
	TotalRequests    int64         `json:"total_requests"`
	SuccessfulRequests int64       `json:"successful_requests"`
	FailedRequests   int64         `json:"failed_requests"`
	UptimePercentage float64       `json:"uptime_percentage"`
	LastDowntime     *time.Time    `json:"last_downtime,omitempty"`
	DowntimeDuration time.Duration `json:"downtime_duration"`
}

// MarketDataAlertThresholds and MarketDataUpdate types are defined in domain package

// NewMarketDataMonitor creates a new market data monitor
func NewMarketDataMonitor(monitoringService *MonitoringService) *MarketDataMonitor {
	monitor := &MarketDataMonitor{
		monitoringService: monitoringService,
		sources:          make(map[string]*DataSourceMetrics),
		alertThresholds: domain.MarketDataAlertThresholds{
			MaxLatency:        5 * time.Second,
			MinSuccessRate:    0.95,
			MaxStaleDataAge:   15 * time.Minute,
			MinQualityScore:   85.0,
			MaxOutlierRate:    0.05,
			MinUptimePercent:  99.0,
		},
	}

	// Start monitoring routines
	go monitor.runQualityChecks()
	go monitor.runUptimeMonitoring()
	go monitor.runAlertChecking()

	return monitor
}

// RecordMarketDataUpdate records a market data update event
func (mdm *MarketDataMonitor) RecordMarketDataUpdate(update domain.MarketDataUpdate) {
	mdm.mu.Lock()
	defer mdm.mu.Unlock()

	// Get or create source metrics
	source, exists := mdm.sources[update.Source]
	if !exists {
		source = &DataSourceMetrics{
			SourceName:    update.Source,
			AssetCoverage: make(map[string]int),
		}
		mdm.sources[update.Source] = source
	}

	// Update basic metrics
	source.LastUpdate = update.Timestamp
	source.UpdateCount++

	if update.Success {
		// Update latency (moving average)
		if source.AvgLatency == 0 {
			source.AvgLatency = update.Latency
		} else {
			source.AvgLatency = time.Duration(
				(int64(source.AvgLatency)*9 + int64(update.Latency)) / 10,
			)
		}

		// Update asset coverage
		source.AssetCoverage[update.AssetType]++

		// Validate price data
		mdm.validatePriceData(source, update)
	} else {
		source.ErrorCount++
	}

	// Update success rate
	source.SuccessRate = float64(source.UpdateCount-source.ErrorCount) / float64(source.UpdateCount)

	// Update uptime metrics
	source.Uptime.TotalRequests++
	if update.Success {
		source.Uptime.SuccessfulRequests++
	} else {
		source.Uptime.FailedRequests++
	}
	source.Uptime.UptimePercentage = float64(source.Uptime.SuccessfulRequests) / float64(source.Uptime.TotalRequests) * 100

	// Record monitoring event
	mdm.monitoringService.RecordEvent(MonitoringEvent{
		Type: "market_data_update",
		Data: map[string]interface{}{
			"source":      update.Source,
			"asset_count": 1,
			"duration":    update.Latency.Seconds(),
			"success":     update.Success,
			"asset_type":  update.AssetType,
		},
	})

	// Record metrics
	labels := map[string]string{
		"source":     update.Source,
		"asset_type": update.AssetType,
		"success":    fmt.Sprintf("%t", update.Success),
	}

	mdm.monitoringService.RecordMetric("market_data_updates_total", 1, MetricTypeCounter, labels)
	mdm.monitoringService.RecordMetric("market_data_latency", update.Latency.Seconds(), MetricTypeTiming, labels)

	if !update.Success {
		mdm.monitoringService.RecordMetric("market_data_errors_total", 1, MetricTypeCounter, labels)
	}
}

// validatePriceData validates price data quality
func (mdm *MarketDataMonitor) validatePriceData(source *DataSourceMetrics, update domain.MarketDataUpdate) {
	// Check for negative prices
	if update.Price.IsNegative() {
		source.PriceValidation.NegativePriceCount++
		log.Printf("Warning: Negative price detected from %s for asset %s: %s", 
			update.Source, update.AssetID, update.Price.String())
	}

	// Check for zero prices
	if update.Price.IsZero() {
		source.PriceValidation.ZeroPriceCount++
		log.Printf("Warning: Zero price detected from %s for asset %s", 
			update.Source, update.AssetID)
	}

	// Check for suspicious price changes (>50% change)
	// This would require storing previous prices - simplified for now
	if update.Price.GreaterThan(decimal.NewFromFloat(1000000)) {
		source.PriceValidation.OutlierCount++
		log.Printf("Warning: Potential outlier price from %s for asset %s: %s", 
			update.Source, update.AssetID, update.Price.String())
	}

	source.PriceValidation.LastValidation = time.Now()
}

// runQualityChecks runs periodic data quality checks
func (mdm *MarketDataMonitor) runQualityChecks() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		mdm.performQualityChecks()
	}
}

// performQualityChecks performs data quality analysis
func (mdm *MarketDataMonitor) performQualityChecks() {
	mdm.mu.Lock()
	defer mdm.mu.Unlock()

	now := time.Now()

	for sourceName, source := range mdm.sources {
		// Check for stale data
		if now.Sub(source.LastUpdate) > mdm.alertThresholds.MaxStaleDataAge {
			source.DataQuality.StaleDataCount++
		}

		// Calculate quality score
		qualityScore := mdm.calculateQualityScore(source)
		source.DataQuality.QualityScore = qualityScore
		source.DataQuality.LastQualityCheck = now

		// Record quality metrics
		labels := map[string]string{
			"source": sourceName,
		}

		mdm.monitoringService.RecordMetric("market_data_quality_score", qualityScore, MetricTypeGauge, labels)
		mdm.monitoringService.RecordMetric("market_data_stale_count", float64(source.DataQuality.StaleDataCount), MetricTypeGauge, labels)
		mdm.monitoringService.RecordMetric("market_data_outlier_count", float64(source.PriceValidation.OutlierCount), MetricTypeGauge, labels)
	}
}

// calculateQualityScore calculates a quality score (0-100) for a data source
func (mdm *MarketDataMonitor) calculateQualityScore(source *DataSourceMetrics) float64 {
	score := 100.0

	// Deduct points for errors
	if source.UpdateCount > 0 {
		errorRate := float64(source.ErrorCount) / float64(source.UpdateCount)
		score -= errorRate * 30 // Max 30 points deduction for errors
	}

	// Deduct points for stale data
	if source.DataQuality.StaleDataCount > 0 {
		score -= minFloat64(float64(source.DataQuality.StaleDataCount)*2, 20) // Max 20 points deduction
	}

	// Deduct points for invalid prices
	totalInvalidPrices := source.PriceValidation.NegativePriceCount + 
		source.PriceValidation.ZeroPriceCount + 
		source.PriceValidation.OutlierCount

	if source.UpdateCount > 0 {
		invalidRate := float64(totalInvalidPrices) / float64(source.UpdateCount)
		score -= invalidRate * 25 // Max 25 points deduction for invalid prices
	}

	// Deduct points for high latency
	if source.AvgLatency > mdm.alertThresholds.MaxLatency {
		latencyPenalty := float64(source.AvgLatency-mdm.alertThresholds.MaxLatency) / float64(mdm.alertThresholds.MaxLatency) * 15
		score -= minFloat64(latencyPenalty, 15) // Max 15 points deduction for latency
	}

	return maxFloat64(score, 0)
}

// runUptimeMonitoring monitors source uptime
func (mdm *MarketDataMonitor) runUptimeMonitoring() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		mdm.checkSourceUptime()
	}
}

// checkSourceUptime checks if sources are responding
func (mdm *MarketDataMonitor) checkSourceUptime() {
	mdm.mu.Lock()
	defer mdm.mu.Unlock()

	now := time.Now()

	for sourceName, source := range mdm.sources {
		// Check if source has been inactive for too long
		if now.Sub(source.LastUpdate) > 10*time.Minute {
			// Mark as potentially down
			if source.Uptime.LastDowntime == nil {
				downtime := now
				source.Uptime.LastDowntime = &downtime
			} else {
				source.Uptime.DowntimeDuration = now.Sub(*source.Uptime.LastDowntime)
			}

			// Record downtime event
			mdm.monitoringService.RecordEvent(MonitoringEvent{
				Type: "market_data_downtime",
				Data: map[string]interface{}{
					"source":            sourceName,
					"last_update":       source.LastUpdate,
					"downtime_duration": source.Uptime.DowntimeDuration.Seconds(),
				},
			})
		} else {
			// Source is active, clear downtime
			if source.Uptime.LastDowntime != nil {
				source.Uptime.LastDowntime = nil
				source.Uptime.DowntimeDuration = 0
			}
		}

		// Record uptime metrics
		labels := map[string]string{
			"source": sourceName,
		}

		mdm.monitoringService.RecordMetric("market_data_uptime_percentage", source.Uptime.UptimePercentage, MetricTypeGauge, labels)
	}
}

// runAlertChecking runs periodic alert checking
func (mdm *MarketDataMonitor) runAlertChecking() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		mdm.checkAlerts()
	}
}

// checkAlerts checks for alert conditions
func (mdm *MarketDataMonitor) checkAlerts() {
	mdm.mu.RLock()
	defer mdm.mu.RUnlock()

	for sourceName, source := range mdm.sources {
		// Check latency alert
		if source.AvgLatency > mdm.alertThresholds.MaxLatency {
			mdm.triggerAlert("high_latency", sourceName, map[string]interface{}{
				"current_latency": source.AvgLatency.Seconds(),
				"threshold":       mdm.alertThresholds.MaxLatency.Seconds(),
			})
		}

		// Check success rate alert
		if source.SuccessRate < mdm.alertThresholds.MinSuccessRate {
			mdm.triggerAlert("low_success_rate", sourceName, map[string]interface{}{
				"current_rate": source.SuccessRate,
				"threshold":    mdm.alertThresholds.MinSuccessRate,
			})
		}

		// Check quality score alert
		if source.DataQuality.QualityScore < mdm.alertThresholds.MinQualityScore {
			mdm.triggerAlert("low_quality_score", sourceName, map[string]interface{}{
				"current_score": source.DataQuality.QualityScore,
				"threshold":     mdm.alertThresholds.MinQualityScore,
			})
		}

		// Check uptime alert
		if source.Uptime.UptimePercentage < mdm.alertThresholds.MinUptimePercent {
			mdm.triggerAlert("low_uptime", sourceName, map[string]interface{}{
				"current_uptime": source.Uptime.UptimePercentage,
				"threshold":      mdm.alertThresholds.MinUptimePercent,
			})
		}
	}
}

// triggerAlert triggers an alert for market data issues
func (mdm *MarketDataMonitor) triggerAlert(alertType, sourceName string, data map[string]interface{}) {
	mdm.monitoringService.RecordEvent(MonitoringEvent{
		Type: "market_data_alert",
		Data: map[string]interface{}{
			"alert_type": alertType,
			"source":     sourceName,
			"details":    data,
		},
	})

	log.Printf("Market Data Alert: %s for source %s - %+v", alertType, sourceName, data)
}

// GetSourceMetrics returns metrics for a specific source
func (mdm *MarketDataMonitor) GetSourceMetrics(sourceName string) (*DataSourceMetrics, bool) {
	mdm.mu.RLock()
	defer mdm.mu.RUnlock()

	metrics, exists := mdm.sources[sourceName]
	return metrics, exists
}

// GetAllSourceMetrics returns metrics for all sources
func (mdm *MarketDataMonitor) GetAllSourceMetrics() map[string]*DataSourceMetrics {
	mdm.mu.RLock()
	defer mdm.mu.RUnlock()

	result := make(map[string]*DataSourceMetrics)
	for k, v := range mdm.sources {
		result[k] = v
	}
	return result
}

// GetMarketDataHealthSummary returns a summary of market data health
func (mdm *MarketDataMonitor) GetMarketDataHealthSummary() map[string]interface{} {
	mdm.mu.RLock()
	defer mdm.mu.RUnlock()

	totalSources := len(mdm.sources)
	healthySources := 0
	totalQualityScore := 0.0
	totalUptimePercentage := 0.0

	for _, source := range mdm.sources {
		if source.DataQuality.QualityScore >= mdm.alertThresholds.MinQualityScore &&
			source.SuccessRate >= mdm.alertThresholds.MinSuccessRate {
			healthySources++
		}
		totalQualityScore += source.DataQuality.QualityScore
		totalUptimePercentage += source.Uptime.UptimePercentage
	}

	avgQualityScore := 0.0
	avgUptimePercentage := 0.0
	if totalSources > 0 {
		avgQualityScore = totalQualityScore / float64(totalSources)
		avgUptimePercentage = totalUptimePercentage / float64(totalSources)
	}

	return map[string]interface{}{
		"total_sources":         totalSources,
		"healthy_sources":       healthySources,
		"avg_quality_score":     avgQualityScore,
		"avg_uptime_percentage": avgUptimePercentage,
		"health_percentage":     float64(healthySources) / float64(totalSources) * 100,
	}
}

// Helper functions for min and max
func minFloat64(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func maxFloat64(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}