package model

import "time"

// Alert represents a notification for a user about a specific condition.
type Alert struct {
	UserID      uint       `json:"user_id" bun:"user_id,notnull"`
	User        User       `json:"user" bun:"rel:belongs-to,join:user_id=id"`
	AssetID     *uint      `json:"asset_id,omitempty" bun:"asset_id"`
	Asset       *Asset     `json:"asset,omitempty" bun:"rel:belongs-to,join:asset_id=id"`
	Type        string     `json:"type" bun:"type,notnull"` // e.g., "PRICE_TARGET", "PERCENT_CHANGE"
	Threshold   float64    `json:"threshold" bun:"threshold,notnull"`
	TriggeredAt *time.Time `json:"triggered_at,omitempty" bun:"triggered_at"`
	DismissedAt *time.Time `json:"dismissed_at,omitempty" bun:"dismissed_at"`
	Message     string     `json:"message" bun:"message,notnull"`
}
