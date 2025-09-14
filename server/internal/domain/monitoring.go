package domain

import (
	"time"
	"github.com/shopspring/decimal"
)

// AlertRule defines a monitoring alert rule
type AlertRule struct {
	ID         string                 `json:"id"`
	Name       string                 `json:"name"`
	MetricName string                 `json:"metric_name"`
	Condition  string                 `json:"condition"`
	Threshold  float64                `json:"threshold"`
	Duration   time.Duration          `json:"duration"`
	Labels     map[string]string      `json:"labels"`
	Actions    []AlertAction          `json:"actions"`
	Enabled    bool                   `json:"enabled"`
	LastFired  *time.Time             `json:"last_fired,omitempty"`
}

// AlertAction defines an action to take when an alert is triggered
type AlertAction struct {
	Type   string                 `json:"type"`
	Config map[string]interface{} `json:"config"`
}

// MarketDataAlertThresholds defines thresholds for market data alerts
type MarketDataAlertThresholds struct {
	MaxLatency        time.Duration `json:"max_latency"`
	MinSuccessRate    float64       `json:"min_success_rate"`
	MaxStaleDataAge   time.Duration `json:"max_stale_data_age"`
	MinQualityScore   float64       `json:"min_quality_score"`
	MaxOutlierRate    float64       `json:"max_outlier_rate"`
	MinUptimePercent  float64       `json:"min_uptime_percent"`
}

// MarketDataUpdate represents a market data update event
type MarketDataUpdate struct {
	Source      string           `json:"source"`
	AssetID     string           `json:"asset_id"`
	AssetType   string           `json:"asset_type"`
	Price       decimal.Decimal  `json:"price"`
	Volume      *decimal.Decimal `json:"volume,omitempty"`
	Timestamp   time.Time        `json:"timestamp"`
	Latency     time.Duration    `json:"latency"`
	Success     bool             `json:"success"`
	Error       error            `json:"error,omitempty"`
}

// PerformanceMetrics represents performance calculation results
type PerformanceMetrics struct {
	TotalReturn       decimal.Decimal `json:"total_return"`
	AnnualizedReturn  decimal.Decimal `json:"annualized_return"`
	Volatility        decimal.Decimal `json:"volatility"`
	SharpeRatio       decimal.Decimal `json:"sharpe_ratio"`
	MaxDrawdown       decimal.Decimal `json:"max_drawdown"`
	Alpha             decimal.Decimal `json:"alpha"`
	Beta              decimal.Decimal `json:"beta"`
	CalculatedAt      time.Time       `json:"calculated_at"`
}

// AssetAllocation represents asset allocation data
type AssetAllocation struct {
	AssetType   string          `json:"asset_type"`
	Percentage  decimal.Decimal `json:"percentage"`
	Value       decimal.Decimal `json:"value"`
	Count       int             `json:"count"`
}

// RiskMetrics represents risk calculation results
type RiskMetrics struct {
	VaR95         decimal.Decimal `json:"var_95"`
	VaR99         decimal.Decimal `json:"var_99"`
	CVaR95        decimal.Decimal `json:"cvar_95"`
	CVaR99        decimal.Decimal `json:"cvar_99"`
	Volatility    decimal.Decimal `json:"volatility"`
	Correlation   decimal.Decimal `json:"correlation"`
	Beta          decimal.Decimal `json:"beta"`
	CalculatedAt  time.Time       `json:"calculated_at"`
}