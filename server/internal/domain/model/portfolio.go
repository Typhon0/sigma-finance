package model

import (
	"time"

	"github.com/uptrace/bun"
)

// PortfolioWithAssets represents a portfolio and its assets
type PortfolioWithAssets struct {
	Portfolio  Portfolio
	Assets     []Asset
	Tags       []Tag
	TotalValue float64
}

// PerformanceMetrics represents portfolio performance data
type PerformanceMetrics struct {
	PortfolioID string  `bun:"portfolio_id"`
	Period      string  `bun:"period"`
	Return      float64 `bun:"return"`
	Volatility  float64 `bun:"volatility"`
}

type Portfolio struct {
	bun.BaseModel `bun:"table:sigma_finance.portfolio"`

	ID          string    `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID      string    `bun:"user_id,notnull,type:uuid"`
	Name        string    `bun:"name,notnull"`
	Description string    `bun:"description"`
	SortOrder   int       `bun:"sort_order,default:0"`
	CreatedAt   time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt   time.Time `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}

// Implement Entity interface
func (p Portfolio) GetID() string            { return p.ID }
func (p Portfolio) SetID(id string)          { p.ID = id }
func (p Portfolio) GetCreatedAt() time.Time  { return p.CreatedAt }
func (p Portfolio) SetCreatedAt(t time.Time) { p.CreatedAt = t }
func (p Portfolio) GetUpdatedAt() time.Time  { return p.UpdatedAt }
func (p Portfolio) SetUpdatedAt(t time.Time) { p.UpdatedAt = t }
