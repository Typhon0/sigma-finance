package model

import "time"

// MarketDataCredential stores a user-provided API key for a market data provider.
type MarketDataCredential struct {
    ID        int       `bun:"id,pk,autoincrement"`
    UserID    int       `bun:"user_id,notnull"`
    Provider  string    `bun:"provider,notnull"`
    APIKey    string    `bun:"api_key,notnull"` // TODO: encrypt at rest
    CreatedAt time.Time `bun:"created_at,default:current_timestamp"`
    UpdatedAt time.Time `bun:"updated_at,default:current_timestamp"`
}
