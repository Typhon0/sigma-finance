package model

import (
	"time"
)

// ProviderRoutingConfig stores learned ticker→provider routing preferences per user.
type ProviderRoutingConfig struct {
	ID           string    `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID       string    `bun:"user_id,notnull"`
	Symbol       string    `bun:"symbol,notnull"`
	AssetType    string    `bun:"asset_type,notnull"`
	Provider     string    `bun:"provider,notnull"`
	SuccessCount int       `bun:"success_count,default:1"`
	FailCount    int       `bun:"fail_count,default:0"`
	CreatedAt    time.Time `bun:"created_at,default:current_timestamp"`
	UpdatedAt    time.Time `bun:"updated_at,default:current_timestamp"`
}

func (p ProviderRoutingConfig) GetID() string             { return p.ID }
func (p *ProviderRoutingConfig) SetID(id string)          { p.ID = id }
func (p ProviderRoutingConfig) GetCreatedAt() time.Time   { return p.CreatedAt }
func (p *ProviderRoutingConfig) SetCreatedAt(t time.Time) { p.CreatedAt = t }
func (p ProviderRoutingConfig) GetUpdatedAt() time.Time   { return p.UpdatedAt }
func (p *ProviderRoutingConfig) SetUpdatedAt(t time.Time) { p.UpdatedAt = t }
